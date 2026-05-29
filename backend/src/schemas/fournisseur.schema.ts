import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FournisseurDocument = HydratedDocument<Fournisseur>;

@Schema({ timestamps: true })
export class Fournisseur {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  contact: string;

  @Prop({ default: '', trim: true })
  phone: string;

  @Prop({ default: '', trim: true })
  email: string;

  @Prop({ default: '', trim: true })
  adresse: string;

  @Prop({ default: 'comptant', enum: ['comptant', '30j', '60j', ''] })
  conditionsPaiement: string;

  @Prop({ default: '0' })
  remise: string;

  @Prop({ default: 3, min: 1, max: 5 })
  note: number;

  @Prop({ type: [String], default: [] })
  categories: string[];
}

export const FournisseurSchema = SchemaFactory.createForClass(Fournisseur);
