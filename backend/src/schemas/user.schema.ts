import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: ['caissier', 'patron', 'gestionnaire', 'magazinier'], default: 'caissier' })
  role: string;

  @Prop({ required: false, trim: true, default: '' })
  phone: string;

  // Caisse assignée (uniquement pour les caissiers)
  @Prop({ type: Types.ObjectId, ref: 'Caisse', default: null })
  caisseId: Types.ObjectId | null;

  // Dépôt/magasin assigné (gestionnaire et magazinier)
  @Prop({ default: '' })
  assignedLocation: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
