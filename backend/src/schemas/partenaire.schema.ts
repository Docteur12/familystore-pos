import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PartenaireDocument = HydratedDocument<Partenaire>;

// Partenaire = client grossiste / revendeur livré depuis l'entrepôt.
@Schema({ timestamps: true })
export class Partenaire {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  phone: string;

  @Prop({ trim: true, default: '' })
  lieu: string;

  @Prop({ trim: true, default: '' })
  ville: string;

  @Prop({ trim: true, default: '' })
  quartier: string;

  @Prop({ trim: true, default: '' })
  responsable: string;

  @Prop({ trim: true, default: '' })
  email: string;

  @Prop({ trim: true, default: '' })
  note: string;

  // structure = avec agences ; particulier = revendeur sans agence
  @Prop({ enum: ['structure', 'particulier'], default: 'structure' })
  type: string;

  // Créance existante AVANT l'enregistrement dans le système (report de solde).
  // S'ajoute à la dette commune ; les versements la réduisent normalement.
  @Prop({ default: 0, min: 0 })
  ancienneDette: number;

  // archivé = conservé pour l'historique, retiré des nouvelles opérations
  @Prop({ default: false })
  archivee: boolean;
}

export const PartenaireSchema = SchemaFactory.createForClass(Partenaire);
