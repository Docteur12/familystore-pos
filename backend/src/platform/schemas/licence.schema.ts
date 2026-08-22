import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LicenceDocument = HydratedDocument<Licence>;

/** Tarif annuel d'une licence, en FCFA. */
export const MONTANT_LICENCE_ANNUELLE = 120_000;

/**
 * Licence d'une boutique — un an, renouvelable.
 *
 * Expirée, elle ne coupe PAS l'accès : la boutique passe en lecture seule
 * (voir `LicenceGuard`). Un commerçant qui a oublié de payer doit pouvoir
 * consulter ses données et terminer sa journée.
 */
@Schema({ timestamps: true, skipTenant: true } as any) // SKIP-TENANT: collection plateforme, au-dessus des boutiques
export class Licence {
  @Prop({ type: Types.ObjectId, ref: 'Boutique', required: true, index: true })
  boutique: Types.ObjectId;

  @Prop({ default: MONTANT_LICENCE_ANNUELLE, min: 0 })
  montant: number;

  @Prop({ default: 'XAF' })
  devise: string;

  @Prop({ required: true })
  dateDebut: Date;

  /**
   * Dernier jour COUVERT par la licence. Les écritures restent permises
   * jusqu'à la fin de cette journée : l'échéance ne tombe jamais au milieu
   * d'une vente.
   */
  @Prop({ required: true })
  dateEcheance: Date;

  @Prop({ default: 'active', enum: ['active', 'annulee'] })
  statut: string;
}

export const LicenceSchema = SchemaFactory.createForClass(Licence);
