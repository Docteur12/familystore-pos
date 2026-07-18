import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VersementFournisseurDocument = HydratedDocument<VersementFournisseur>;

// Versement d'argent à un fournisseur (règlement des marchandises vendues).
// Le fournisseur est identifié par son NOM (même champ libre que Product.fournisseur).
@Schema({ timestamps: true })
export class VersementFournisseur {
  @Prop({ required: true, trim: true })
  fournisseur: string;

  @Prop({ required: true, min: 0 })
  montant: number;

  @Prop({ default: '', trim: true })
  note: string;

  // Date du versement au format AAAA-MM-JJ (saisie ; createdAt = enregistrement)
  @Prop({ default: '', trim: true })
  date: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creePar: Types.ObjectId;
}

export const VersementFournisseurSchema = SchemaFactory.createForClass(VersementFournisseur);
VersementFournisseurSchema.index({ fournisseur: 1, createdAt: -1 });
