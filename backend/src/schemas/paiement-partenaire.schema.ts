import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaiementPartenaireDocument = HydratedDocument<PaiementPartenaire>;

// Règlement d'une créance par un partenaire (hors paiement à la livraison).
@Schema({ timestamps: true })
export class PaiementPartenaire {
  @Prop({ type: Types.ObjectId, ref: 'Partenaire', required: true })
  partenaire: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  montant: number;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ trim: true, default: '' })
  date: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creePar: Types.ObjectId;
}

export const PaiementPartenaireSchema = SchemaFactory.createForClass(PaiementPartenaire);
