import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DemandeBoutiqueDocument = HydratedDocument<DemandeBoutique>;

export const STATUTS_DEMANDE = ['en_attente', 'acceptee', 'refusee'] as const;
export type StatutDemande = typeof STATUTS_DEMANDE[number];

/**
 * Demande d'ouverture d'une boutique — mode LICENCE MANUELLE.
 *
 * Sans paiement en ligne, un patron qui veut une boutique de plus ne peut pas
 * la « payer » dans l'application : il la DEMANDE. Le revendeur (superadmin)
 * voit la demande dans le back-office, encaisse de la main à la main, puis
 * l'ACCEPTE — c'est l'acceptation qui crée la boutique (via
 * `ProvisionnementService.creerBoutique`) et enregistre le règlement reçu.
 *
 * Même principe que le parcours payant : la boutique n'existe qu'à la
 * confirmation, jamais avant, et le mot de passe du futur patron attend ICI
 * déjà haché — jamais en clair.
 *
 * Le propriétaire est porté par e-mail et nom (pas par référence) : un patron
 * d'une instance d'avant le registre `Proprietaire` doit pouvoir demander ;
 * `creerBoutique` trouve ou crée le propriétaire à l'acceptation.
 */
@Schema({ timestamps: true, skipTenant: true } as any) // SKIP-TENANT: collection plateforme, au-dessus des boutiques
export class DemandeBoutique {
  @Prop({ type: Object, required: true })
  proprietaire: { email: string; nom: string };

  @Prop({ required: true, trim: true })
  nom: string;

  @Prop({ default: 'Douala', trim: true })
  ville: string;

  @Prop({ type: Object, required: true })
  patron: { nom: string; email: string; motDePasseHash: string };

  /** Numéro où le revendeur rappelle le demandeur. */
  @Prop({ default: '' })
  telephone: string;

  /** Mot du demandeur (quartier, date souhaitée…). */
  @Prop({ default: '' })
  message: string;

  @Prop({ required: true, enum: STATUTS_DEMANDE, default: 'en_attente', index: true })
  statut: StatutDemande;

  @Prop({ type: Date, default: null })
  traiteeLe: Date | null;

  @Prop({ default: '' })
  traiteePar: string;

  @Prop({ default: '' })
  motifRefus: string;

  /** Boutique créée à l'acceptation. */
  @Prop({ type: Types.ObjectId, ref: 'Boutique', default: null })
  boutique: Types.ObjectId | null;

  /** Référence du règlement manuel enregistré à l'acceptation. */
  @Prop({ default: '' })
  referencePaiement: string;
}

export const DemandeBoutiqueSchema = SchemaFactory.createForClass(DemandeBoutique);
DemandeBoutiqueSchema.index({ 'proprietaire.email': 1, statut: 1 });
