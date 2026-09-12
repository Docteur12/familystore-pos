import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MouvementConsigneDocument = HydratedDocument<MouvementConsigne>;

export const SENS_CONSIGNE = ['encaissee', 'rendue'] as const;
export type SensConsigne = (typeof SENS_CONSIGNE)[number];

/**
 * Mouvement de consigne — la consigne n'est pas du chiffre d'affaires.
 *
 *  - `encaissee` : le client paie la consigne avec sa bouteille. Aujourd'hui
 *    elle est portée par la VENTE elle-même (ligne « Consigne … », `divers`),
 *    source de vérité de la caisse ; le sens est réservé pour un enregistrement
 *    serveur ultérieur.
 *  - `rendue` : le client rapporte le vide, on lui rembourse. Chaque retour
 *    crée une `Expense` (catégorie « Consigne rendue ») référencée ici : la
 *    caisse du soir reste juste (`Sale.unitPrice` a `min: 0`, une ligne
 *    négative est impossible).
 */
@Schema({ timestamps: true, collection: 'mouvements_consigne' })
export class MouvementConsigne {
  @Prop({ required: true, enum: SENS_CONSIGNE })
  sens: SensConsigne;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  /** Snapshot du nom (le produit peut changer). */
  @Prop({ required: true, trim: true })
  nomProduit: string;

  @Prop({ required: true, min: 1 })
  quantite: number;

  @Prop({ required: true, min: 0 })
  montantUnitaire: number;

  @Prop({ required: true, min: 0 })
  montant: number;

  @Prop({ type: Types.ObjectId, ref: 'Expense', required: false })
  expense?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Sale', required: false })
  sale?: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  date: Date;

  @Prop({ default: '' })
  auteurNom: string;

  @Prop({ default: '' })
  auteurEmail: string;

  /** Idempotence (double tap, rejeu réseau) — unique par tenant si renseignée. */
  @Prop()
  idempotencyKey?: string;
}

export const MouvementConsigneSchema = SchemaFactory.createForClass(MouvementConsigne);

MouvementConsigneSchema.index(
  { tenant: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
