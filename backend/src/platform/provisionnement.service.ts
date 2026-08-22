import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Proprietaire, ProprietaireDocument } from './schemas/proprietaire.schema';
import { Boutique, BoutiqueDocument } from './schemas/boutique.schema';
import { Licence, LicenceDocument, MONTANT_LICENCE_ANNUELLE, joursAvantEcheance } from './schemas/licence.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Settings, SettingsDocument } from '../settings/settings.schema';
import { runWithTenant } from '../tenancy/tenant-context';

/** État de licence consommé par la garde et par le bandeau de préavis. */
export interface EtatLicence {
  montant: number;
  devise: string;
  dateEcheance: Date;
  /** Dernier instant couvert : fin de la journée d'échéance. */
  finCouverture: Date;
  expiree: boolean;
  joursRestants: number;
}

export interface DemandeBoutique {
  nom: string;
  ville?: string;
  /** Propriétaire : rattachement à un existant, ou création à la volée. */
  proprietaire: { email: string; nom?: string; telephone?: string };
  /** Compte patron créé dans la nouvelle boutique. */
  patron: { nom: string; email: string; motDePasse: string };
}

/**
 * Provisionnement d'une boutique — ce que faisait le seed, désormais par tenant.
 *
 * Créer une boutique, c'est fabriquer un ESPACE DE DONNÉES neuf : un
 * `tenantId` inédit, puis, **dans le contexte de ce tenant**, les documents
 * initiaux (paramètres, compte patron). Le plugin de cloisonnement les
 * estampille alors normalement — aucun `skipTenant` n'est nécessaire, la
 * traversée se fait en entrant dans un contexte, pas en retirant la barrière.
 *
 * L'opération est faite pour être rejouable : si elle échoue à mi-chemin, la
 * boutique reste identifiable par son `tenantId` et rien n'est écrit dans un
 * autre espace.
 */
@Injectable()
export class ProvisionnementService {
  constructor(
    @InjectModel(Proprietaire.name) private proprietaireModel: Model<ProprietaireDocument>,
    @InjectModel(Boutique.name)     private boutiqueModel:     Model<BoutiqueDocument>,
    @InjectModel(Licence.name)      private licenceModel:      Model<LicenceDocument>,
    @InjectModel(User.name)         private userModel:         Model<UserDocument>,
    @InjectModel(Settings.name)     private settingsModel:     Model<SettingsDocument>,
  ) {}

  /** Cache court des états de licence, partagé par toutes les requêtes. */
  private static cacheLicences = new Map<string, { etat: EtatLicence | null; jusqua: number }>();

  /** Boutiques d'un propriétaire, par e-mail. Vide si l'e-mail est inconnu. */
  async boutiquesDuProprietaire(email: string): Promise<BoutiqueDocument[]> {
    const proprietaire = await this.proprietaireModel.findOne({ email: email.toLowerCase() }).lean();
    if (!proprietaire) return [];
    return this.boutiqueModel
      .find({ proprietaire: proprietaire._id, statut: 'active' })
      .sort({ nom: 1 });
  }

  /**
   * Toutes les boutiques avec l'état de leur licence — vue du back-office.
   *
   * Ne lit que des collections plateforme : aucune donnée métier n'est
   * touchée, donc aucun contexte tenant n'est nécessaire ici.
   */
  async listerBoutiques() {
    const boutiques = await this.boutiqueModel.find().sort({ nom: 1 }).populate('proprietaire').lean();
    const maintenant = new Date();

    const lignes = [];
    for (const b of boutiques as any[]) {
      const licence = await this.licenceModel
        .findOne({ boutique: b._id, statut: 'active' })
        .sort({ dateEcheance: -1 })
        .lean();

      const echeance = licence?.dateEcheance ? new Date(licence.dateEcheance) : null;
      const finDeCouverture = echeance ? new Date(echeance) : null;
      finDeCouverture?.setHours(23, 59, 59, 999);

      lignes.push({
        id: String(b._id),
        nom: b.nom,
        ville: b.ville,
        tenantId: String(b.tenantId),
        statut: b.statut,
        proprietaire: b.proprietaire ? { nom: b.proprietaire.nom, email: b.proprietaire.email } : null,
        licence: licence
          ? {
              montant: licence.montant,
              devise: licence.devise,
              dateEcheance: licence.dateEcheance,
              expiree: !!finDeCouverture && maintenant > finDeCouverture,
              joursRestants: joursAvantEcheance(licence.dateEcheance, maintenant),
            }
          : null,
      });
    }
    return lignes;
  }

  /**
   * État de licence d'une boutique, tel que consommé par la garde et par le
   * bandeau de préavis.
   *
   * `null` quand la boutique n'est pas au registre : c'est le cas des
   * instances d'avant le module plateforme, qui ne doivent surtout pas se
   * retrouver bloquées. Pas de licence connue = pas de blocage.
   *
   * Résultat mis en cache une minute — une garde qui interroge la base à
   * chaque écriture coûterait cher en caisse. Le cache est vidé
   * explicitement à la prolongation : le déblocage doit être immédiat, sans
   * reconnexion ni redéploiement.
   */
  async etatLicence(tenantId: string): Promise<EtatLicence | null> {
    const enCache = ProvisionnementService.cacheLicences.get(tenantId);
    if (enCache && enCache.jusqua > Date.now()) return enCache.etat;

    const licence = await this.licenceCourante(tenantId);
    let etat: EtatLicence | null = null;
    if (licence) {
      // Dernier instant COUVERT : la fin de la journée d'échéance. L'échéance
      // ne doit jamais tomber au milieu d'une vente.
      const finCouverture = new Date(licence.dateEcheance);
      finCouverture.setHours(23, 59, 59, 999);
      const maintenant = new Date();
      etat = {
        montant: licence.montant,
        devise: licence.devise,
        dateEcheance: licence.dateEcheance,
        finCouverture,
        expiree: maintenant > finCouverture,
        joursRestants: joursAvantEcheance(licence.dateEcheance, maintenant),
      };
    }
    ProvisionnementService.cacheLicences.set(tenantId, { etat, jusqua: Date.now() + 60_000 });
    return etat;
  }

  /** Vide le cache d'une boutique — ou de toutes si aucune n'est précisée. */
  static oublierLicence(tenantId?: string) {
    if (tenantId) ProvisionnementService.cacheLicences.delete(tenantId);
    else ProvisionnementService.cacheLicences.clear();
  }

  /** Licence en cours d'une boutique (la plus récente non annulée). */
  async licenceCourante(tenantId: string) {
    const boutique = await this.boutiqueModel.findOne({ tenantId: new Types.ObjectId(tenantId) }).lean();
    if (!boutique) return null;
    return this.licenceModel
      .findOne({ boutique: boutique._id, statut: 'active' })
      .sort({ dateEcheance: -1 })
      .lean();
  }

  /**
   * Crée une boutique : registre plateforme, licence d'un an, puis les
   * documents initiaux DANS le tenant neuf.
   */
  async creerBoutique(demande: DemandeBoutique) {
    if (!demande?.nom?.trim()) throw new BadRequestException('Le nom de la boutique est obligatoire');
    if (!demande?.patron?.motDePasse || demande.patron.motDePasse.length < 6) {
      throw new BadRequestException('Le mot de passe du patron doit compter au moins 6 caractères');
    }

    const proprietaire = await this.trouverOuCreerProprietaire(demande.proprietaire);

    const tenantId = new Types.ObjectId();
    const boutique = await this.boutiqueModel.create({
      nom: demande.nom.trim(),
      ville: demande.ville?.trim() || 'Douala',
      tenantId,
      proprietaire: proprietaire._id,
    });

    const licence = await this.creerLicence(boutique._id as Types.ObjectId, new Date());

    // Documents initiaux, écrits DANS le tenant de la nouvelle boutique.
    await runWithTenant(tenantId, async () => {
      await this.settingsModel.create({ nomMagasin: demande.nom.trim(), ville: demande.ville?.trim() || 'Douala' });
      await this.userModel.create({
        name: demande.patron.nom.trim(),
        email: demande.patron.email.toLowerCase().trim(),
        password: await bcrypt.hash(demande.patron.motDePasse, 10),
        role: 'patron',
      });
    });

    return { boutique: this.vueBoutique(boutique), licence: this.vueLicence(licence) };
  }

  /** Prolonge la licence d'un an à partir de l'échéance en cours (ou d'aujourd'hui si dépassée). */
  async prolongerLicence(boutiqueId: string) {
    const boutique = await this.boutiqueModel.findById(boutiqueId);
    if (!boutique) throw new BadRequestException('Boutique introuvable');

    const courante = await this.licenceModel
      .findOne({ boutique: boutique._id, statut: 'active' })
      .sort({ dateEcheance: -1 });

    // Repart de l'échéance si elle est encore devant : le client ne perd pas
    // les jours qu'il a déjà payés en renouvelant en avance.
    const depart = courante && courante.dateEcheance > new Date() ? courante.dateEcheance : new Date();
    const licence = await this.creerLicence(boutique._id as Types.ObjectId, depart);
    // Déblocage IMMÉDIAT : la garde ne doit pas continuer de refuser les
    // écritures pendant la minute de cache qui suit un paiement.
    ProvisionnementService.oublierLicence(String(boutique.tenantId));
    return this.vueLicence(licence);
  }

  async changerStatutBoutique(boutiqueId: string, statut: 'active' | 'suspendue') {
    const boutique = await this.boutiqueModel.findByIdAndUpdate(boutiqueId, { statut }, { new: true });
    if (!boutique) throw new BadRequestException('Boutique introuvable');
    return this.vueBoutique(boutique);
  }

  private async trouverOuCreerProprietaire(p: DemandeBoutique['proprietaire']) {
    const email = p?.email?.toLowerCase().trim();
    if (!email) throw new BadRequestException("L'e-mail du propriétaire est obligatoire");

    const existant = await this.proprietaireModel.findOne({ email });
    if (existant) return existant;
    if (!p.nom?.trim()) throw new ConflictException('Propriétaire inconnu : son nom est requis pour le créer');
    return this.proprietaireModel.create({ nom: p.nom.trim(), email, telephone: p.telephone ?? '' });
  }

  private async creerLicence(boutique: Types.ObjectId, depart: Date) {
    const dateEcheance = new Date(depart);
    dateEcheance.setFullYear(dateEcheance.getFullYear() + 1);
    return this.licenceModel.create({
      boutique, montant: MONTANT_LICENCE_ANNUELLE, dateDebut: depart, dateEcheance,
    });
  }

  private vueBoutique(b: BoutiqueDocument) {
    return {
      id: String(b._id), nom: b.nom, ville: b.ville,
      tenantId: String(b.tenantId), statut: b.statut,
    };
  }

  private vueLicence(l: LicenceDocument) {
    return {
      id: String(l._id), montant: l.montant, devise: l.devise,
      dateDebut: l.dateDebut, dateEcheance: l.dateEcheance, statut: l.statut,
    };
  }
}
