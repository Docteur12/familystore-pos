import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReceptionCasierDocument = HydratedDocument<ReceptionCasier>;

/**
 * Réception de casiers en réserve — trace du détail « casier » que le
 * `StockMovement` (exprimé en bouteilles) ne porte pas : combien de casiers,
 * de quelle contenance, combien de vides rendus au livreur en échange.
 */
@Schema({ timestamps: true, collection: 'receptions_casier' })
export class ReceptionCasier {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nomProduit: string;

  @Prop({ required: true, min: 1 })
  casiers: number;

  @Prop({ required: true, min: 1 })
  bouteillesParCasier: number;

  /** casiers × bouteillesParCasier — ce qui a été ajouté à `Product.stock`. */
  @Prop({ required: true, min: 1 })
  bouteilles: number;

  /** Bouteilles vides rendues au livreur à cette occasion. */
  @Prop({ required: true, default: 0, min: 0 })
  videsRendus: number;

  @Prop({ default: '' })
  note: string;

  @Prop({ default: '' })
  auteurNom: string;

  @Prop({ default: '' })
  auteurEmail: string;

  @Prop()
  idempotencyKey?: string;
}

export const ReceptionCasierSchema = SchemaFactory.createForClass(ReceptionCasier);

ReceptionCasierSchema.index(
  { tenant: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
