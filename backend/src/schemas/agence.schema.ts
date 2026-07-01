import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AgenceDocument = HydratedDocument<Agence>;

// Agence = point/agence d'un partenaire structuré (ex. « Santa Lucia — Agence Akwa »).
// Une agence peut « régler sa propre dette » (independante) ou être en « dette commune ».
@Schema({ timestamps: true })
export class Agence {
  @Prop({ type: Types.ObjectId, ref: 'Partenaire', required: true, index: true })
  partenaire: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nom: string;

  @Prop({ trim: true, default: '' })
  ville: string;

  @Prop({ trim: true, default: '' })
  quartier: string;

  @Prop({ trim: true, default: '' })
  telephone: string;

  @Prop({ trim: true, default: '' })
  responsable: string;

  // true  = règle sa propre dette (versements rattachés à l'agence)
  // false = dette commune du partenaire (avances libres)
  @Prop({ default: false })
  independante: boolean;

  // true = conservée pour l'historique et les totaux, mais retirée des nouvelles opérations
  @Prop({ default: false })
  archivee: boolean;
}

export const AgenceSchema = SchemaFactory.createForClass(Agence);
