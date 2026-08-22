import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BoutiqueDocument = HydratedDocument<Boutique>;

/**
 * Boutique — le registre plateforme d'un magasin.
 *
 * `tenantId` est la clé de cloisonnement des données métier : c'est ce même
 * identifiant que porte le champ `tenant` de chaque vente, produit, caisse…
 * et que le jeton transporte. Le registre fait donc le lien entre un
 * propriétaire et un espace de données.
 */
@Schema({ timestamps: true, skipTenant: true } as any) // SKIP-TENANT: collection plateforme, au-dessus des boutiques
export class Boutique {
  @Prop({ required: true, trim: true })
  nom: string;

  /** Identifiant de cloisonnement des données métier de cette boutique. */
  @Prop({ type: Types.ObjectId, required: true, unique: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Proprietaire', required: true, index: true })
  proprietaire: Types.ObjectId;

  @Prop({ default: 'Douala', trim: true })
  ville: string;

  /**
   * `suspendue` : décision de la plateforme (impayé constaté, fraude…).
   * À distinguer d'une licence expirée, qui met en lecture seule sans
   * suspendre — voir la garde de licence.
   */
  @Prop({ default: 'active', enum: ['active', 'suspendue'] })
  statut: string;
}

export const BoutiqueSchema = SchemaFactory.createForClass(Boutique);
