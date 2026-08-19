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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)     private userModel:     Model<UserDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .populate('caisseId');
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    const caisse = user.caisseId
      ? {
          _id:   (user.caisseId as any)._id,
          nom:   (user.caisseId as any).nom,
          code:  (user.caisseId as any).code,
          pin:   (user.caisseId as any).pin,
          ville: (user.caisseId as any).ville,
        }
      : null;
    const payload = {
      sub:    user._id,
      email:  user.email,
      name:   user.name,
      role:   user.role,
      caisse,
    };
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
