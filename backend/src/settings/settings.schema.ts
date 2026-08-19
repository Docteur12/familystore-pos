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

  @Prop({ default: '#B8893E' })
  couleurSecondaire: string;   // palette « gold » (accents, titres de la caisse)

  // ── Identité imprimée (tickets, PDF, e-mails) ────────────────────────────
  // Historiquement codée en dur « Family Store / BY RDCT / Beauté • Saveur •
  // Bien-être ». Chaque tenant porte désormais la sienne.
  @Prop({ default: '' })
  slogan: string;              // ex. « Beauté • Saveur • Bien-être »

  @Prop({ default: '' })
  signatureTicket: string;     // ex. « BY RDCT » — vide pour ne rien imprimer

  @Prop({ default: '' })
  mentionsLegales: string;     // ex. « NIU : … • RC : … »

  @Prop({ type: [String], default: [] })
  telephonesTicket: string[];  // numéros imprimés sur le ticket (2-3 max)

  // ── Modules optionnels ───────────────────────────────────────────────────
  // Modules activés pour ce magasin (voir MODULES_DISPONIBLES). Un module
  // absent n'apparaît ni dans les menus ni dans les routes du frontend.
  // Vide = tous actifs (rétro-compatibilité des documents existants).
  @Prop({ type: [String], default: [] })
  modules: string[];

  // ── Règles métier paramétrables ──────────────────────────────────────────
  @Prop({
    type: { inactiviteMinutes: Number, seedFournisseursDemo: Boolean },
    default: { inactiviteMinutes: 10, seedFournisseursDemo: true },
  })
  metier: { inactiviteMinutes: number; seedFournisseursDemo: boolean };

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

/** Modules pouvant être désactivés par magasin (frontend : menus + routes). */
export const MODULES_DISPONIBLES = ['partenaires'] as const;
export type ModuleId = (typeof MODULES_DISPONIBLES)[number];
