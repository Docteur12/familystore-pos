import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SaleDocument = HydratedDocument<Sale>;

/**
 * Ligne d'article dans une vente.
 * `name` est un snapshot du nom au moment de la vente (le produit peut changer).
 */
class SaleItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: false })
  product?: Types.ObjectId;

  @Prop({ default: false })
  divers?: boolean;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ default: 0, min: 0, max: 100 })
  discount: number;        // % de réduction appliqué (0 = aucune)

  @Prop({ default: 0, min: 0 })
  originalPrice: number;   // prix avant réduction (0 si aucune)
}

@Schema({ timestamps: true })
export class Sale {
  @Prop({
    type: [{
      product:       { type: MongooseSchema.Types.ObjectId, ref: 'Product', required: false },
      name:          { type: String, required: true },
      quantity:      { type: Number, required: true, min: 1 },
      unitPrice:     { type: Number, required: true, min: 0 },
      discount:      { type: Number, default: 0, min: 0, max: 100 },
      originalPrice: { type: Number, default: 0, min: 0 },
      divers:        { type: Boolean, default: false },
    }],
    required: true,
  })
  items: SaleItem[];

  @Prop({ required: true, min: 0 })
  total: number;

  /** Sous-total avant réduction facture (0 = pas de réduction, total = subtotal) */
  @Prop({ default: 0, min: 0 })
  subtotal: number;

  /** % de réduction facture appliqué à la caisse (offre fidélité, ex : 5) */
  @Prop({ default: 0, min: 0, max: 100 })
  offrePct: number;

  /** Montant déduit par la réduction facture */
  @Prop({ default: 0, min: 0 })
  offreAmt: number;

  /** Date réelle de la vente quand elle diffère de createdAt (synchro hors-ligne) */
  @Prop({ required: false })
  dateVente?: Date;

  /** true = vente enregistrée hors-ligne puis synchronisée */
  @Prop({ default: false })
  syncOffline: boolean;

  @Prop({
    required: true,
    enum: ['cash', 'mtn_momo', 'orange_money', 'card', 'mobile_money', 'credit'],
    default: 'cash',
  })
  paymentMethod: string;

  /** Montant remis par le client */
  @Prop({ required: true, min: 0 })
  amountPaid: number;

  /** Monnaie rendue (amountPaid - total, toujours >= 0) */
  @Prop({ required: true, default: 0, min: 0 })
  change: number;

  // ── Traçabilité caissière ──────────────────────────────────────────────────
  @Prop({ default: '' })
  cashierName: string;

  @Prop({ default: '' })
  cashierEmail: string;

  @Prop({ default: '' })
  caisseName: string;

  @Prop({ default: '' })
  sessionId: string;

  /** Clé d'idempotence : empêche l'enregistrement en double d'une même vente
   *  (réessais réseau / synchro hors-ligne). Unique mais facultative (sparse). */
  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const SaleSchema = SchemaFactory.createForClass(Sale);
