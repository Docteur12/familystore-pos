import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StockMovementDocument = HydratedDocument<StockMovement>;

export type MovementType   = 'IN' | 'OUT';
export type MovementReason =
  | 'restock' | 'sale' | 'adjustment' | 'reception'
  | 'annulation_vente' | 'modification_vente' | 'livraison_partenaire' | 'retour_partenaire'
  | 'retour_entrepot' | 'retour_fournisseur';

const MOVEMENT_REASONS: MovementReason[] = [
  'restock', 'sale', 'adjustment', 'reception',
  'annulation_vente', 'modification_vente', 'livraison_partenaire', 'retour_partenaire',
  'retour_entrepot', 'retour_fournisseur',
];

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
