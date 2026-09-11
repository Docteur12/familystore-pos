import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { DemandeBoutique, DemandeBoutiqueDocument, StatutDemande, STATUTS_DEMANDE } from './schemas/demande-boutique.schema';
import { ProvisionnementService } from './provisionnement.service';
import { PaiementService } from './paiement/paiement.service';

export interface NouvelleDemandeBoutique {
  nom: string;
  ville?: string;
  patron: { nom: string; email: string; motDePasse: string };
  telephone?: string;
  message?: string;
}

/**
 * Demandes d'ouverture de boutique — le parcours du mode manuel.
 *
 * Le patron demande ; le superadmin accepte ou refuse. L'acceptation est
 * l'équivalent de la confirmation d'un paiement en ligne : elle crée la
 * boutique (une seule fois — une demande déjà traitée est refusée) et laisse
 * un `Paiement` confirmé, source « manuel », objet « creation_boutique ».
 */
@Injectable()
export class DemandesBoutiqueService {
  constructor(
    @InjectModel(DemandeBoutique.name) private demandeModel: Model<DemandeBoutiqueDocument>,
    private provisionnement: ProvisionnementService,
    private paiements: PaiementService,
  ) {}

  async creer(demandeur: { email: string; name?: string }, d: NouvelleDemandeBoutique) {
    if (!d?.nom?.trim()) throw new BadRequestException('Le nom de la boutique est obligatoire');
    if (!d?.patron?.nom?.trim()) throw new BadRequestException('Le nom du patron est obligatoire');
    if (!d?.patron?.email?.trim()) throw new BadRequestException("L'e-mail du patron est obligatoire");
    if (!d?.patron?.motDePasse || d.patron.motDePasse.length < 8) {
      throw new BadRequestException('Le mot de passe du patron doit compter au moins 8 caractères');
    }
    const email = demandeur.email.toLowerCase().trim();

    // Une seule demande en attente par propriétaire et par nom : le patron qui
    // clique deux fois n'en crée pas deux.
    const doublon = await this.demandeModel.findOne({ 'proprietaire.email': email, nom: d.nom.trim(), statut: 'en_attente' });
    if (doublon) return this.vue(doublon);

    const demande = await this.demandeModel.create({
      proprietaire: { email, nom: (demandeur.name ?? '').trim() || email },
      nom: d.nom.trim(),
      ville: d.ville?.trim() || 'Douala',
      patron: {
        nom: d.patron.nom.trim(),
        email: d.patron.email.toLowerCase().trim(),
        motDePasseHash: await bcrypt.hash(d.patron.motDePasse, 10),
      },
      telephone: (d.telephone ?? '').trim(),
      message: (d.message ?? '').trim(),
    });
    return this.vue(demande);
  }

  /** Les demandes d'un propriétaire — les siennes seulement. */
  async listerPour(emailProprietaire: string) {
    const demandes = await this.demandeModel
      .find({ 'proprietaire.email': emailProprietaire.toLowerCase() }).sort({ createdAt: -1 }).limit(50);
    return demandes.map(d => this.vue(d));
  }

  /** Toutes les demandes — back-office. En attente d'abord, puis les plus récentes. */
  async listerToutes(statut?: string) {
    const filtre: Record<string, unknown> = {};
    if (statut) {
      if (!(STATUTS_DEMANDE as readonly string[]).includes(statut)) throw new BadRequestException(`Statut inconnu : « ${statut} »`);
      filtre.statut = statut;
    }
    const demandes = await this.demandeModel.find(filtre).sort({ createdAt: -1 }).limit(200);
    const rang = (s: StatutDemande) => (s === 'en_attente' ? 0 : 1);
    return demandes
      .sort((a, b) => rang(a.statut) - rang(b.statut))
      .map(d => this.vue(d));
  }

  /**
   * Acceptation : crée la boutique, enregistre le règlement, clôt la demande.
   *
   * L'ordre compte : la demande est marquée acceptée par une écriture
   * ATOMIQUE avant de créer quoi que ce soit — deux clics simultanés ne
   * créent qu'une boutique. Si la création échoue ensuite, la demande est
   * remise en attente et l'erreur remonte.
   */
  async accepter(
    id: string,
    reglement: { montant?: number; moyen?: string; note?: string },
    acteur: { name?: string; email?: string },
  ) {
    const auteur = acteur?.email ?? acteur?.name ?? '';
    const demande = await this.demandeModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), statut: 'en_attente' },
      { $set: { statut: 'acceptee', traiteeLe: new Date(), traiteePar: auteur } },
      { new: true },
    );
    if (!demande) {
      const existe = await this.demandeModel.exists({ _id: new Types.ObjectId(id) });
      throw existe ? new BadRequestException('Demande déjà traitée') : new NotFoundException('Demande introuvable');
    }

    try {
      const cree = await this.provisionnement.creerBoutique({
        nom: demande.nom,
        ville: demande.ville,
        proprietaire: { email: demande.proprietaire.email, nom: demande.proprietaire.nom, telephone: demande.telephone },
        patron: { nom: demande.patron.nom, email: demande.patron.email, motDePasseHash: demande.patron.motDePasseHash },
      });
      const { paiement } = await this.paiements.enregistrerReglementManuel(
        cree.boutique.id, reglement, acteur, 'creation_boutique',
      );
      demande.boutique = new Types.ObjectId(cree.boutique.id);
      demande.referencePaiement = paiement.reference;
      // Le mot de passe haché n'a plus d'utilité : on ne garde pas un secret
      // dont on n'a plus besoin.
      demande.patron = { ...demande.patron, motDePasseHash: '' };
      await demande.save();
      return { demande: this.vue(demande), boutique: cree.boutique, licence: cree.licence, paiement };
    } catch (e) {
      await this.demandeModel.updateOne(
        { _id: demande._id },
        { $set: { statut: 'en_attente', traiteeLe: null, traiteePar: '' } },
      );
      throw e;
    }
  }

  async refuser(id: string, motif: string, acteur: { name?: string; email?: string }) {
    if (!motif?.trim()) throw new BadRequestException('Le motif du refus est obligatoire');
    const demande = await this.demandeModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), statut: 'en_attente' },
      {
        $set: {
          statut: 'refusee', traiteeLe: new Date(), traiteePar: acteur?.email ?? acteur?.name ?? '',
          motifRefus: motif.trim(), 'patron.motDePasseHash': '',
        },
      },
      { new: true },
    );
    if (!demande) {
      const existe = await this.demandeModel.exists({ _id: new Types.ObjectId(id) });
      throw existe ? new BadRequestException('Demande déjà traitée') : new NotFoundException('Demande introuvable');
    }
    return this.vue(demande);
  }

  /** Vue exposée — jamais le hachage du mot de passe. */
  private vue(d: DemandeBoutiqueDocument) {
    return {
      id: String(d._id),
      nom: d.nom,
      ville: d.ville,
      proprietaire: d.proprietaire,
      patron: { nom: d.patron.nom, email: d.patron.email },
      telephone: d.telephone,
      message: d.message,
      statut: d.statut,
      traiteeLe: d.traiteeLe,
      traiteePar: d.traiteePar,
      motifRefus: d.motifRefus,
      boutiqueId: d.boutique ? String(d.boutique) : null,
      referencePaiement: d.referencePaiement,
      cree: (d as any).createdAt ?? null,
    };
  }
}
