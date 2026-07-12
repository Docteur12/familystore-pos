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

  @Prop({ default: '#FF0000' })
  couleurPrincipale: string;   // couleur de la boutique (interface + PDF)

  // Offre marketing imprimée en pied de facture — éditable (import/export CSV).
  // Les segments entre *astérisques* sont rendus en gras sur le ticket.
  @Prop({
    type: { titre: String, message: String, validite: String, cta: String, salutation: String },
    default: {
      titre:      '',
      message:    'Pour vous remercier, *Family Store vous offre 5 %* de réduction sur votre prochain achat. Présentez simplement cette facture à la caisse pour bénéficier de cette offre.',
      validite:   '',
      cta:        '',
      salutation: '',
    },
  })
  offreFacture: { titre: string; message: string; validite: string; cta: string; salutation: string };
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
