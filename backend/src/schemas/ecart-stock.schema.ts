import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EcartStockDocument = HydratedDocument<EcartStock>;

@Schema({ timestamps: true })
export class EcartStock {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  produit: Types.ObjectId;

  @Prop({ required: true })
  nomProduit: string;

  @Prop({ required: true })
  stockSysteme: number;      // stock avant la vente

  @Prop({ required: true })
  quantiteVendue: number;

  @Prop({ required: true })
  ecart: number;             // toujours négatif

  @Prop({ required: true })
  caissiereName: string;

  @Prop({ default: '' })
  caissiereEmail: string;

  @Prop({ type: Types.ObjectId, ref: 'Sale', default: null })
  saleId: Types.ObjectId | null;

  @Prop({ default: 'Vente forcée' })
  justification: string;

  @Prop({ default: 'en_attente' }) // 'en_attente' | 'resolu'
  statut: string;

  @Prop({ default: null })
  dateResolu: Date | null;
}

export const EcartStockSchema = SchemaFactory.createForClass(EcartStock);
