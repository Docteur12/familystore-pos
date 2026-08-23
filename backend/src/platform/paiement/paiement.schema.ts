import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { STATUTS, StatutPaiement } from './machine-etats';

export type PaiementDocument = HydratedDocument<Paiement>;

/** Ce qu'un paiement achète. */
export type ObjetPaiement = 'creation_boutique' | 'renouvellement_licence';

/**
 * Boutique à créer une fois le paiement confirmé.
 *
 * Conservée ici parce que **la boutique n'existe pas encore** : on ne crée
 * rien avant d'être payé. Le mot de passe du patron est stocké DÉJÀ HACHÉ —
 * un paiement peut rester en attente une demi-heure, et rien ne justifie de
 * garder un mot de passe en clair pendant ce temps, ni de le voir passer
 * dans un journal.
 */
export interface DemandeBoutiqueEnAttente {
  nom: string;
  ville?: string;
  patronNom: string;
  patronEmail: string;
  patronMotDePasseHash: string;
}

/** Une ligne du journal : qui a annoncé quoi, et quand. */
export interface EntreeJournal {
  le: Date;
  de: StatutPaiement;
  vers: StatutPaiement;
  source: 'creation' | 'webhook' | 'reconciliation' | 'manuel';
  detail?: string;
}

/**
 * Paiement — création de boutique ou renouvellement de licence.
 *
 * Trois garanties portées par ce schéma :
 *
 * 1. **`reference` est notre clé d'idempotence**, générée par nous et unique.
 *    Elle voyage jusqu'au prestataire et revient dans ses annonces : deux
 *    webhooks pour le même paiement portent la même référence, et le second
 *    ne produit rien.
 *
 * 2. **`referenceFournisseur` est unique elle aussi** (index partiel : elle
 *    n'existe qu'une fois le paiement créé chez le prestataire). Sans cet
 *    index, un doublon côté opérateur pourrait prolonger deux fois la même
 *    licence.
 *
 * 3. **`effetApplique` garde l'effet métier**. Le webhook et la
 *    réconciliation courent en parallèle et arrivent parfois ensemble ; c'est
 *    ce drapeau, posé par une écriture atomique, qui décide lequel des deux
 *    crée la boutique. L'autre ne fait rien.
 */
@Schema({ timestamps: true, skipTenant: true } as any) // SKIP-TENANT: collection plateforme, au-dessus des boutiques
export class Paiement {
  /** Clé d'idempotence, générée par nous. Voyage jusqu'au prestataire. */
  @Prop({ required: true, unique: true, index: true })
  reference: string;

  /** Nom du prestataire ayant traité le paiement (`mycoolpay`, `simule`…). */
  @Prop({ required: true })
  fournisseur: string;

  /** Identifiant de transaction chez le prestataire, connu après création. */
  @Prop({ type: String, default: null })
  referenceFournisseur: string | null;

  /** Page de paiement à ouvrir, quand le prestataire en fournit une. */
  @Prop({ type: String, default: null })
  urlPaiement: string | null;

  @Prop({ required: true, enum: ['creation_boutique', 'renouvellement_licence'] })
  objet: ObjetPaiement;

  @Prop({ type: Types.ObjectId, ref: 'Proprietaire', required: true, index: true })
  proprietaire: Types.ObjectId;

  /**
   * Renouvellement : la boutique concernée, connue d'avance.
   * Création : `null` jusqu'à la confirmation, puis renseignée.
   */
  @Prop({ type: Types.ObjectId, ref: 'Boutique', default: null, index: true })
  boutique: Types.ObjectId | null;

  /** Création de boutique : ce qui sera provisionné une fois payé. */
  @Prop({ type: Object, default: null })
  demandeBoutique: DemandeBoutiqueEnAttente | null;

  /**
   * Numéro Mobile Money débité, normalisé (9 chiffres).
   *
   * Conservé pour deux raisons : une nouvelle tentative le reprend sans le
   * redemander, et un litige avec l'opérateur se règle sur le numéro
   * réellement présenté — c'est la première question posée.
   */
  @Prop({ default: '' })
  telephonePayeur: string;

  @Prop({ required: true, min: 0 })
  montant: number;

  @Prop({ default: 'XAF' })
  devise: string;

  @Prop({ required: true, enum: STATUTS, default: 'en_attente', index: true })
  statut: StatutPaiement;

  /** Nombre d'interrogations déjà faites — commande l'espacement des suivantes. */
  @Prop({ default: 0 })
  tentativesReconciliation: number;

  @Prop({ type: Date, default: null })
  derniereVerification: Date | null;

  /**
   * CHAÎNE DE TENTATIVES.
   *
   * MyCoolPay refuse une référence déjà vue (« Duplicate transaction
   * reference », 409) : réessayer impose donc une référence NEUVE, donc un
   * nouveau document. Sans lien entre eux, on perdrait la trace de ce que le
   * client a tenté — et surtout, deux tentatives confirmées créeraient deux
   * boutiques.
   *
   * `chaine` porte l'identifiant de la PREMIÈRE tentative (lui-même pour
   * elle). C'est le document racine qui sert de verrou : l'effet métier est
   * appliqué une fois par CHAÎNE, pas une fois par tentative. Le cas n'est
   * pas théorique — une tentative déclarée expirée peut être confirmée
   * tardivement, après qu'une seconde a déjà abouti.
   */
  @Prop({ type: Types.ObjectId, required: true, index: true })
  chaine: Types.ObjectId;

  /** Rang de la tentative : 1 pour la première. */
  @Prop({ default: 1, min: 1 })
  tentative: number;

  /** Tentative précédente, quand celle-ci la remplace. */
  @Prop({ type: Types.ObjectId, ref: 'Paiement', default: null })
  paiementPrecedent: Types.ObjectId | null;

  /**
   * Effet métier appliqué (boutique créée, licence prolongée).
   *
   * Porté par la RACINE de la chaîne, et posé par une écriture atomique :
   * c'est ce drapeau qui empêche le double effet, y compris entre deux
   * tentatives distinctes.
   */
  @Prop({ default: false })
  effetApplique: boolean;

  @Prop({ type: Date, default: null })
  effetLe: Date | null;

  /**
   * Tout ce qui est arrivé à ce paiement, dans l'ordre.
   *
   * Un litige sur un paiement Mobile Money se règle sur des traces : qui a
   * annoncé quoi, à quelle heure, et par quel canal. Sans ce journal, on
   * n'aurait qu'un statut final et aucun moyen d'expliquer une divergence
   * avec le relevé de l'opérateur.
   */
  @Prop({ type: [Object], default: [] })
  journal: EntreeJournal[];
}

export const PaiementSchema = SchemaFactory.createForClass(Paiement);

// Unicité de la référence prestataire, seulement quand elle existe : un
// paiement tout juste créé n'en a pas encore, et un index unique ordinaire
// refuserait le deuxième document à `null`.
PaiementSchema.index(
  { referenceFournisseur: 1 },
  { unique: true, partialFilterExpression: { referenceFournisseur: { $type: 'string' } } },
);

// Balayage de la réconciliation : les paiements encore en jeu, du plus
// ancien vérifié au plus récent.
PaiementSchema.index({ statut: 1, derniereVerification: 1 });
