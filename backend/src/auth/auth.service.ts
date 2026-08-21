import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { User, UserDocument } from '../schemas/user.schema';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';
import { Settings, SettingsDocument } from '../settings/settings.schema';
import { runWithTenant } from '../tenancy/tenant-context';

// Hachage bcrypt d'une valeur qui n'est le mot de passe de personne. Sert
// uniquement à consommer le même temps de calcul quand l'e-mail est inconnu,
// pour que la durée de réponse ne trahisse pas l'existence d'un compte.
const HASH_LEURRE = bcrypt.hashSync('mot-de-passe-leurre-jamais-utilise', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)     private userModel:     Model<UserDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
    private jwtService: JwtService,
  ) {}

  /**
   * Connexion à deux champs, y compris en multi-magasin — pas de code boutique.
   *
   * L'e-mail est cherché dans TOUS les magasins (il n'est unique que par
   * tenant depuis le cloisonnement), puis le mot de passe est vérifié sur
   * chaque candidat. Selon le nombre de couples valides :
   *   0 → réponse neutre, identique à un mot de passe faux ;
   *   1 → connexion directe, comme aujourd'hui ;
   *   n → écran « quelle boutique ? », limité aux magasins où le couple est
   *       valide, via un jeton de sélection de 5 minutes.
   *
   * Aucune information n'est donnée avant validation du mot de passe : un
   * e-mail inconnu et un mot de passe faux sont indiscernables, y compris en
   * durée de réponse (voir le calcul à vide plus bas). L'oracle d'énumération
   * corrigé le 03/08 ne doit pas se rouvrir ici.
   */
  async login(email: string, password: string) {
    const emailNormalise = email.toLowerCase();

    const candidats = await this.userModel
      .find({ email: emailNormalise })
      .setOptions({ skipTenant: true }); // SKIP-TENANT: résolution multi-tenant au login, la boutique est inconnue à ce stade

    const valides: UserDocument[] = [];
    for (const candidat of candidats) {
      if (await bcrypt.compare(password, candidat.password)) valides.push(candidat);
    }

    if (valides.length === 0) {
      // Comparaison à vide : sans elle, un e-mail inconnu répondrait beaucoup
      // plus vite qu'un mot de passe faux — un oracle d'énumération au chrono.
      if (candidats.length === 0) await bcrypt.compare(password, HASH_LEURRE);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (valides.length === 1) return this.emettreJeton(valides[0]);

    return this.proposerChoixBoutique(valides);
  }

  /** Deuxième écran : la liste ne contient QUE les magasins déjà authentifiés. */
  private async proposerChoixBoutique(valides: UserDocument[]) {
    const boutiques = [];
    for (const utilisateur of valides) {
      const tenantId = String((utilisateur as any).tenant);
      const nom = await runWithTenant(tenantId, async () => {
        const s: any = await this.settingsModel.findOne().lean();
        return (s?.nomMagasin as string) || 'Magasin';
      });
      boutiques.push({ tenantId, nom });
    }

    // Le jeton porte les comptes validés : au second appel, le client ne peut
    // choisir QUE parmi eux — un tenantId arbitraire est refusé.
    const selectionToken = await this.jwtService.signAsync(
      {
        typ: 'choix-boutique',
        comptes: valides.map(u => ({ tenantId: String((u as any).tenant), userId: String(u._id) })),
      },
      { expiresIn: '5m' },
    );

    return { choixBoutique: true as const, selectionToken, boutiques };
  }

  /** Finalise une connexion après le choix de la boutique. */
  async loginBoutique(selectionToken: string, tenantId: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(selectionToken);
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
    if (payload?.typ !== 'choix-boutique') throw new UnauthorizedException('Token invalide ou expiré');

    const compte = (payload.comptes ?? []).find((c: any) => c.tenantId === String(tenantId));
    if (!compte) throw new UnauthorizedException('Accès non autorisé');

    // `await` À L'INTÉRIEUR du contexte : une Query Mongoose est paresseuse,
    // elle ne s'exécute qu'au moment où on l'attend. L'attendre au dehors la
    // ferait tourner hors contexte tenant — et le plugin lèverait.
    const user = await runWithTenant(compte.tenantId, async () => this.userModel.findById(compte.userId).exec());
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    return this.emettreJeton(user);
  }

  /**
   * Renouvellement glissant : un jeton encore valide (vérifié par l'AuthGuard)
   * est réémis pour une nouvelle période. Utilisé quotidiennement, on ne se
   * reconnecte jamais ; inutilisé 24 h, la session expire. Le contenu est
   * relu en base : un utilisateur supprimé ou une caisse modifiée (PIN…)
   * ne se renouvelle pas à l'identique.
   */
  async refresh(userId: string) {
    const user = await this.userModel.findById(userId).populate('caisseId');
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    return this.emettreJeton(user);
  }

  // Émission du jeton (login et renouvellement) pour un utilisateur authentifié.
  private async emettreJeton(userDoc: any) {
    const tenantId = String(userDoc.tenant);
    // La caisse est chargée DANS le contexte du magasin : au login en mode
    // multi, aucun tenant n'est encore posé par l'interceptor, et le plugin
    // lèverait. C'est aussi ce qui garantit qu'on ne peut pas rattacher la
    // caisse d'un autre magasin.
    const user = await runWithTenant(tenantId, () => userDoc.populate('caisseId'));

    const caisse = user.caisseId
      ? {
          _id:   user.caisseId._id,
          nom:   user.caisseId.nom,
          code:  user.caisseId.code,
          ville: user.caisseId.ville,
          // Dérivation PBKDF2 du PIN + sel : jamais le PIN en clair. Permet à
          // la caisse de vérifier le PIN hors-ligne (WebCrypto, utils/pin.ts).
          pinKdf:  user.caisseId.pinKdf,
          pinSalt: user.caisseId.pinSalt,
        }
      : null;
    // v2 : jetons sans PIN en clair, durée 24 h. L'AuthGuard rejette les
    // jetons antérieurs (30 jours, PIN lisible) — reconnexion unique.
    // tenantId : lu par TenantInterceptor en mode multi pour poser le contexte.
    const payload = { v: 2, sub: user._id, email: user.email, name: user.name, role: user.role, tenantId, caisse };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, caisse },
    };
  }

  async register(name: string, email: string, password: string, role: string, phone?: string, caisseId?: string, assignedLocation?: string) {
    const existing = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.userModel.create({
      name, email, password: hashed, role,
      phone:            phone            ?? '',
      caisseId:         caisseId         ?? null,
      assignedLocation: assignedLocation ?? '',
    });
    return { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone };
  }

  async findAll() {
    return this.userModel.find().select('-password');
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findByIdAndDelete(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return { deleted: true };
  }

  async updateUser(id: string, data: { name?: string; email?: string; phone?: string; password?: string; oldPassword?: string }) {
    // Verify old password if changing password
    if (data.password) {
      const user = await this.userModel.findById(id);
      if (!user) throw new NotFoundException('Utilisateur introuvable');
      if (data.oldPassword) {
        const isMatch = await bcrypt.compare(data.oldPassword, user.password);
        if (!isMatch) throw new BadRequestException('Ancien mot de passe incorrect');
      }
    }

    const update: Record<string, any> = {};
    if (data.name?.trim())        update.name     = data.name.trim();
    if (data.email?.trim())       update.email    = data.email.toLowerCase().trim();
    if (data.phone !== undefined) update.phone    = data.phone.trim();
    if (data.password?.trim())    update.password = await bcrypt.hash(data.password.trim(), 10);
    if ('caisseId' in data)          update.caisseId          = (data as any).caisseId ?? null;
    if ('assignedLocation' in data)  update.assignedLocation  = (data as any).assignedLocation ?? '';

    if (Object.keys(update).length === 0) return this.userModel.findById(id).select('-password');
    const user = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // ── GET /api/auth/users/activity — users enrichis avec données AuditLog ──────

  async getUserActivity() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [users, auditStats] = await Promise.all([
      this.userModel.find().select('-password').lean(),
      this.auditLogModel.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id:              '$actorName',
            lastActionAt:     { $first: '$createdAt' },
            lastActionDetail: { $first: '$detail' },
            allCreatedAt:     { $push: '$createdAt' },
          },
        },
        {
          $project: {
            lastActionAt:     1,
            lastActionDetail: 1,
            actionsToday: {
              $size: {
                $filter: {
                  input: '$allCreatedAt',
                  cond:  { $gte: ['$$this', todayStart] },
                },
              },
            },
          },
        },
      ]),
    ]);

    const byName = new Map<string, { lastActionAt: Date; actionsToday: number; lastActionDetail: string }>(
      auditStats.map(a => [a._id as string, a]),
    );

    return users.map(u => {
      const audit = byName.get(u.name);
      return {
        _id:              String(u._id),
        name:             u.name,
        email:            u.email,
        role:             u.role,
        phone:            u.phone ?? '',
        caisseId:         u.caisseId ? String(u.caisseId) : null,
        lastActionAt:     audit?.lastActionAt     ?? null,
        actionsToday:     audit?.actionsToday     ?? 0,
        lastActionDetail: audit?.lastActionDetail ?? null,
      };
    });
  }

  // Mot de passe temporaire tiré du générateur cryptographique du système.
  // Math.random() ne convient pas : sa graine est devinable, donc le mot de
  // passe envoyé par email l'est aussi.
  private generateTempPassword(length = 12): string {
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    // 248 = plus grand multiple de 62 sous 256 : au-delà, l'octet est rejeté
    // plutôt que replié par modulo, ce qui biaiserait les premières lettres.
    const maxUnbiased = 256 - (256 % ALPHABET.length);
    let out = '';
    while (out.length < length) {
      for (const byte of randomBytes(length)) {
        if (byte >= maxUnbiased) continue;
        out += ALPHABET[byte % ALPHABET.length];
        if (out.length === length) break;
      }
    }
    return out;
  }

  // Réponse volontairement identique que le compte existe ou non : renvoyer
  // « aucun compte associé » permettrait d'énumérer les utilisateurs.
  async forgotPassword(email: string) {
    const REPONSE_NEUTRE = {
      message: 'Si un compte existe avec cet email, un message a été envoyé.',
    };

    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) return REPONSE_NEUTRE;

    // Identité du magasin pour l'e-mail (nom, couleur, signature).
    let st: any = null;
    try { st = await this.settingsModel.findOne().lean(); } catch { /* défaut */ }
    const app   = `${(st?.nomMagasin || 'Family Store').trim()} POS`;
    const brand = /^#[0-9A-Fa-f]{6}$/.test(st?.couleurPrincipale ?? '') ? st.couleurPrincipale : '#7A1D2E';
    const signature = (st?.signatureTicket ?? '').trim();

    const tempPassword = this.generateTempPassword();
    user.password = await bcrypt.hash(tempPassword, 10);
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    // Une erreur d'envoi ne doit pas remonter en 500 : le code HTTP
    // trahirait à lui seul l'existence du compte.
    try {
      await transporter.sendMail({
        from: `"${app}" <${process.env.MAIL_USER}>`,
        to: user.email,
        subject: `Réinitialisation de votre mot de passe — ${app}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: ${brand};">${app}</h2>
          <p>Bonjour <strong>${user.name}</strong>,</p>
          <p>Votre mot de passe temporaire est :</p>
          <div style="background: #f5f0e8; padding: 16px; border-radius: 8px; text-align: center; font-size: 22px; font-weight: bold; letter-spacing: 0.1em; color: ${brand}; font-family: monospace;">
            ${tempPassword}
          </div>
          <p style="margin-top: 16px; color: #666;">Connectez-vous avec ce mot de passe, puis changez-le immédiatement depuis les paramètres de votre compte.</p>
          <p style="font-size: 12px; color: #999; margin-top: 24px;">${app}${signature ? ' — ' + signature.toLowerCase() : ''}</p>
        </div>
      `,
      });
    } catch (err) {
      // Le mot de passe a déjà été remplacé en base : si l'envoi échoue,
      // l'utilisateur ne peut plus se connecter et ne reçoit rien. Tracé ici
      // pour que le patron puisse le constater dans les logs Render.
      this.logger.error(
        `Échec d'envoi du mot de passe temporaire à ${user.email} : ${err instanceof Error ? err.message : err}`,
      );
    }

    return REPONSE_NEUTRE;
  }
}
