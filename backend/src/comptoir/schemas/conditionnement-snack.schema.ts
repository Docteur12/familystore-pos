import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConditionnementSnackDocument = HydratedDocument<ConditionnementSnack>;

/**
 * Conditionnement d'un produit vendu au comptoir — collection PROPRE au
 * module Snack, un document par produit.
 *
 * Pourquoi une collection à part plutôt que des champs sur `Product` :
 * `product.schema.ts` est un fichier partagé (phase 1 : intouchable), et ces
 * données (casier, consigne, vides détenus) n'ont de sens que pour un
 * snack-bar. `Product.stock` reste l'unique compteur de bouteilles : un casier
 * reçu s'y ajoute converti, rien n'est compté deux fois.
 */
@Schema({ timestamps: true, collection: 'conditionnements_snack' })
export class ConditionnementSnack {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  /** Bouteilles par casier (unité d'achat → unité de vente). */
  @Prop({ required: true, min: 1 })
  bouteillesParCasier: number;

  /** Consigne par bouteille, en F. 0 = pas de consigne. */
  @Prop({ required: true, default: 0, min: 0 })
  consigne: number;

  /** Bouteilles vides détenues en réserve (retours clients), à rendre au livreur. */
  @Prop({ required: true, default: 0, min: 0 })
  videsEnReserve: number;
}

export const ConditionnementSnackSchema = SchemaFactory.createForClass(ConditionnementSnack);

// Un seul conditionnement par produit ET par tenant.
ConditionnementSnackSchema.index({ tenant: 1, product: 1 }, { unique: true });
