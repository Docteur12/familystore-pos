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

  /**
   * Seuils de relance déjà envoyés (14, 7, 3, 1). Empêche de renvoyer deux
   * fois le même rappel : la tâche tourne plusieurs fois par jour pour
   * survivre aux redémarrages, elle doit être idempotente.
   */
  @Prop({ type: [Number], default: [] })
  relancesEnvoyees: number[];

  @Prop({ default: 'active', enum: ['active', 'annulee'] })
  statut: string;
}

export const LicenceSchema = SchemaFactory.createForClass(Licence);

/**
 * Jours CALENDAIRES avant l'échéance : échéance aujourd'hui → 0, demain → 1,
 * dans deux semaines → 14.
 *
 * Compté de début de journée à début de journée, et surtout PAS en divisant
 * un écart d'instants : mesurer jusqu'à la fin de la journée d'échéance
 * gonflait le résultat d'une unité (une échéance à quatorze jours annonçait
 * quinze), et le premier seuil de relance était systématiquement manqué.
 *
 * À ne pas confondre avec la fin de couverture, qui court elle jusqu'à
 * 23 h 59 le jour de l'échéance — c'est elle qui décide du blocage.
 */
export function joursAvantEcheance(dateEcheance: Date, maintenant = new Date()): number {
  const debutJour = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  return Math.round((debutJour(dateEcheance) - debutJour(maintenant)) / 86_400_000);
}
