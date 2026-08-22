import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Proprietaire, ProprietaireDocument } from './schemas/proprietaire.schema';
import { Boutique, BoutiqueDocument } from './schemas/boutique.schema';
import { Licence, LicenceDocument, MONTANT_LICENCE_ANNUELLE } from './schemas/licence.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Settings, SettingsDocument } from '../settings/settings.schema';
import { runWithTenant } from '../tenancy/tenant-context';

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

  /** Boutiques d'un propriétaire, par e-mail. Vide si l'e-mail est inconnu. */
  async boutiquesDuProprietaire(email: string): Promise<BoutiqueDocument[]> {
    const proprietaire = await this.proprietaireModel.findOne({ email: email.toLowerCase() }).lean();
    if (!proprietaire) return [];
    return this.boutiqueModel
      .find({ proprietaire: proprietaire._id, statut: 'active' })
      .sort({ nom: 1 });
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
