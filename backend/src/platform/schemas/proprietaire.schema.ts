import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProprietaireDocument = HydratedDocument<Proprietaire>;

/**
 * Propriétaire — personne qui possède une ou plusieurs boutiques.
 *
 * Collection de PLATEFORME : elle vit au-dessus des magasins, donc hors
 * cloisonnement. C'est l'usage prévu de `skipTenant` (schémas Tenant, Plan…),
 * pas une dérogation arrachée.
 *
 * L'e-mail est unique ici, au niveau plateforme — contrairement aux comptes
 * utilisateurs, uniques seulement PAR boutique.
 */
@Schema({ timestamps: true, skipTenant: true } as any) // SKIP-TENANT: collection plateforme, au-dessus des boutiques
export class Proprietaire {
  @Prop({ required: true, trim: true })
  nom: string;

  @Prop({ required: true, lowercase: true, trim: true, unique: true })
  email: string;

  @Prop({ default: '', trim: true })
  telephone: string;
}

export const ProprietaireSchema = SchemaFactory.createForClass(Proprietaire);
