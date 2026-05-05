import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CaisseDocument = HydratedDocument<Caisse>;

@Schema({ timestamps: true })
export class Caisse {
  @Prop({ required: true, trim: true })
  nom: string; // "Caisse 01"

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string; // "C01" — identifiant court unique

  @Prop({ required: true })
  pin: string; // 4 chiffres en clair — stocké dans le JWT pour vérification offline

  @Prop({ default: 'Douala' })
  ville: string;
}

export const CaisseSchema = SchemaFactory.createForClass(Caisse);
