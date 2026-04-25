import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SaleDocument = HydratedDocument<Sale>;

/**
 * Ligne d'article dans une vente.
 * `name` est un snapshot du nom au moment de la vente (le produit peut changer).
 */
class SaleItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;           // snapshot nom produit

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

@Schema({ timestamps: true })
export class Sale {
  @Prop({
    type: [{
      product:   { type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true },
      name:      { type: String, required: true },
      quantity:  { type: Number, required: true, min: 1 },
      unitPrice: { type: Number, required: true, min: 0 },
    }],
    required: true,
  })
  items: SaleItem[];

  @Prop({ required: true, min: 0 })
  total: number;

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

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const SaleSchema = SchemaFactory.createForClass(Sale);
