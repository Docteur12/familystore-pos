import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DemandeStockDocument = HydratedDocument<DemandeStock>;

@Schema({ timestamps: true })
export class DemandeStock {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  produit: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantiteDemandee: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  demandePar: Types.ObjectId;

  @Prop({ enum: ['en_attente', 'envoyé', 'reçu'], default: 'en_attente' })
  statut: string;

  @Prop()
  dateEnvoi: Date;
}

export const DemandeStockSchema = SchemaFactory.createForClass(DemandeStock);
