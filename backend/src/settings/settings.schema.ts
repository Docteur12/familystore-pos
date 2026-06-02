import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SettingsDocument = HydratedDocument<Settings>;

@Schema({ timestamps: true })
export class Settings {
  @Prop({ default: 'Family Store' })
  nomMagasin: string;

  @Prop({ default: '' })
  adresse: string;

  @Prop({ default: 'Douala' })
  ville: string;

  @Prop({ default: '' })
  telephone: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: 'XAF' })
  devise: string;

  @Prop({ default: '' })
  logoUrl: string;   // base64 ou URL

  @Prop({ type: { ouverture: String, fermeture: String }, default: { ouverture: '08:00', fermeture: '20:00' } })
  horaires: { ouverture: string; fermeture: string };

  @Prop({ type: { facebook: String, whatsapp: String }, default: { facebook: '', whatsapp: '' } })
  reseauxSociaux: { facebook: string; whatsapp: string };

  @Prop({ default: 'fr', enum: ['fr', 'en'] })
  langue: string;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
