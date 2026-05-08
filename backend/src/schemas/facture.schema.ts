import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FactureDocument = HydratedDocument<Facture>;

@Schema({ timestamps: true })
export class Facture {
  @Prop({ required: true })
  numero: string;

  @Prop({ required: true })
  caissier: string;

  @Prop({ required: true, min: 0 })
  montant: number;

  @Prop({ required: true, default: 0, min: 0 })
  tva: number;

  @Prop({ required: true })
  paymentMethod: string;

  @Prop({
    type: [{
      name:      { type: String, required: true },
      quantity:  { type: Number, required: true },
      unitPrice: { type: Number, required: true },
    }],
    required: true,
  })
  items: { name: string; quantity: number; unitPrice: number }[];

  @Prop({ required: true })
  pdfBase64: string;

  @Prop({ default: Date.now })
  date: Date;
}

export const FactureSchema = SchemaFactory.createForClass(Facture);
