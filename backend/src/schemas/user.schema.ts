import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  // Unicité de l'email PAR TENANT (index composite en bas de fichier).
  // NOTE mode multi : cela autorise deux magasins à partager une adresse. Si
  // l'on veut garder une connexion à deux champs (email + mot de passe) sans
  // code boutique, il faudra rebasculer cet index en unicité GLOBALE avant le
  // lancement du SaaS mutualisé — décision à trancher (voir AUDIT-SAAS §2.4).
  // En mode single (production actuelle), les deux sont équivalents.
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: ['caissier', 'patron', 'gestionnaire', 'magazinier', 'commercial', 'superadmin'], default: 'caissier' })
  role: string;

  @Prop({ required: false, trim: true, default: '' })
  phone: string;

  // Caisse assignée (uniquement pour les caissiers)
  @Prop({ type: Types.ObjectId, ref: 'Caisse', default: null })
  caisseId: Types.ObjectId | null;

  // Dépôt/magasin assigné (gestionnaire et magasinier)
  @Prop({ default: '' })
  assignedLocation: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Unicité de l'email par tenant (voir NOTE sur le champ email).
UserSchema.index({ tenant: 1, email: 1 }, { unique: true });
