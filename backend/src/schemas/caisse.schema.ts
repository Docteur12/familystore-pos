import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CaisseDocument = HydratedDocument<Caisse>;

@Schema({ timestamps: true })
export class Caisse {
  @Prop({ required: true, trim: true })
  nom: string; // "Caisse 01"

  // Unicité désormais PAR TENANT (voir index composite en bas de fichier) :
  // deux magasins peuvent avoir chacun une caisse « C01 ».
  @Prop({ required: true, uppercase: true, trim: true })
  code: string; // "C01" — identifiant court, unique au sein du magasin

  @Prop({ required: true })
  pin: string; // 4 chiffres en clair — stocké dans le JWT pour vérification offline

  @Prop({ default: 'Douala' })
  ville: string;
}

export const CaisseSchema = SchemaFactory.createForClass(Caisse);

// Unicité du code par tenant (le champ `tenant` est ajouté par tenantPlugin).
CaisseSchema.index({ tenant: 1, code: 1 }, { unique: true });
