import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StockMovementDocument = HydratedDocument<StockMovement>;

export type MovementType = 'IN' | 'OUT';

/**
 * Motifs de mouvement de stock — LE tableau fait foi, le type en dérive.
 *
 * Miroir de `frontend/src/pages/Stocks.tsx › REASON_LABELS` (libellés FR et
 * EN), verrouillé par `motifs-stock-governance.spec.ts` : tout motif ajouté
 * ici doit recevoir ses deux libellés, sinon la CI casse.
 *
 * Gamme Caméléon : un profil n'ajoute que des LIGNES à ce tableau (fichier
 * partagé, ajouts seulement). Le type était une union littérale fermée qu'il
 * fallait réécrire à chaque motif — remontée de la session Snack par
 * `verifier:perimetre` le 12/09/2026.
 *
 *  - `reception_casier` : arrivage en casiers (snack-bar), converti en
 *    bouteilles à l'entrée en réserve ;
 *  - `casse` : bouteille cassée, produit perdu — sortie sans vente.
 */
export const MOVEMENT_REASONS = [
  'restock', 'sale', 'adjustment', 'reception',
  'annulation_vente', 'modification_vente', 'livraison_partenaire', 'retour_partenaire',
  'retour_entrepot', 'retour_fournisseur',
  // Gamme — profils
  'reception_casier', 'casse',
] as const;

export type MovementReason = (typeof MOVEMENT_REASONS)[number];

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ required: true, enum: ['IN', 'OUT'] })
  type: MovementType;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, enum: MOVEMENT_REASONS, default: 'restock' })
  reason: MovementReason;

  @Prop({ trim: true })
  note?: string;

  /** Clé d'idempotence — évite de compter deux fois le même ajout de stock
   *  lors de la synchronisation hors-ligne (rejeu réseau). */
  // Unicité PAR TENANT quand renseignée (index composite en bas de fichier).
  @Prop()
  idempotencyKey?: string;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);

// Idempotence du mouvement : clé unique par tenant, uniquement si renseignée.
StockMovementSchema.index(
  { tenant: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
