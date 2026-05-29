import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BonLivraisonDocument = HydratedDocument<BonLivraison>;

@Schema({ timestamps: true })
export class BonLivraison {
  @Prop({ required: true, trim: true })
  numeroBL: string;

  @Prop({ required: true, trim: true })
  fournisseur: string;

  @Prop({ trim: true, default: '' })
  date: string;

  @Prop({
    type: [{
      productId:      { type: Types.ObjectId, ref: 'Product' },
      productName:    String,
      unit:           String,
      qteAttendue:    { type: Number, default: 0 },
      qteRecue:       { type: Number, default: 0 },
      datePeremption: { type: String, default: '' },
      etatEmballage:  { type: String, default: '' },
    }],
    default: [],
  })
  lignes: {
    productId: Types.ObjectId;
    productName: string;
    unit: string;
    qteAttendue: number;
    qteRecue: number;
    datePeremption: string;
    etatEmballage: string;
  }[];

  @Prop({ default: 0 })
  totalEcarts: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creePar: Types.ObjectId;
}

export const BonLivraisonSchema = SchemaFactory.createForClass(BonLivraison);
