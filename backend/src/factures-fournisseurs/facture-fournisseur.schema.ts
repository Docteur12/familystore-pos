import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FactureFournisseurDocument = HydratedDocument<FactureFournisseur>;

/**
 * Facture fournisseur importée (photo, scan ou PDF) et lue automatiquement.
 *
 * Cycle : `a_verifier` (extraction faite, en attente du contrôle humain) →
 * `validee` (réception fournisseur créée, stock entrepôt mis à jour) ou
 * `rejetee`. Le justificatif est ARCHIVÉ dans le document (`fichier`) : pas de
 * stockage de fichiers à mettre en place, et il reste attaché à sa réception.
 *
 * Le champ `fichier` est exclu des lectures par défaut (`select: false`) :
 * une liste de factures ne doit pas charger des mégaoctets d'images.
 */
export type LigneFacture = {
  designation: string;
  quantite: number;
  prixUnitaire: number | null;
  prixTotal: number | null;
  reference: string | null;
  /** Proposition d'appariement : produit existant, ou à créer. */
  produitId: Types.ObjectId | null;
  produitNom: string | null;
  appariement: 'existant' | 'nouveau';
};

@Schema({ timestamps: true })
export class FactureFournisseur {
  @Prop({ required: true, trim: true })
  nomFichier: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  taille: number;

  @Prop({ type: Buffer, required: true, select: false })
  fichier: Buffer;

  @Prop({ default: 'a_verifier', enum: ['a_verifier', 'validee', 'rejetee'] })
  statut: 'a_verifier' | 'validee' | 'rejetee';

  // ── Ce que l'extraction a lu ─────────────────────────────────────────────
  @Prop({ default: '' })
  fournisseur: string;

  @Prop({ default: '' })
  numeroFacture: string;

  @Prop({ default: '' })
  dateFacture: string;

  @Prop({ default: null })
  total: number | null;

  @Prop({ default: 'moyenne', enum: ['haute', 'moyenne', 'basse'] })
  confiance: 'haute' | 'moyenne' | 'basse';

  @Prop({ default: '' })
  remarques: string;

  @Prop({ type: Array, default: [] })
  lignes: LigneFacture[];

  /** Extracteur employé (« claude » ou « simule ») — pour l'audit. */
  @Prop({ default: '' })
  extracteur: string;

  // ── Cycle de vie ─────────────────────────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  importeePar: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  valideePar: Types.ObjectId | null;

  @Prop({ default: null })
  valideeLe: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Reception', default: null })
  receptionId: Types.ObjectId | null;

  @Prop({ default: '' })
  motifRejet: string;
}

export const FactureFournisseurSchema = SchemaFactory.createForClass(FactureFournisseur);
FactureFournisseurSchema.index({ tenant: 1, statut: 1, createdAt: -1 });
