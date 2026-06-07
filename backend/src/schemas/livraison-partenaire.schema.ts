import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LivraisonPartenaireDocument = HydratedDocument<LivraisonPartenaire>;

// Bon de livraison vers un partenaire grossiste (sortie d'entrepôt).
@Schema({ timestamps: true })
export class LivraisonPartenaire {
  @Prop({ required: true, trim: true })
  numeroBL: string;

  @Prop({ type: Types.ObjectId, ref: 'Partenaire', required: true })
  partenaire: Types.ObjectId;

  @Prop({
    type: [{
      productId:     { type: Types.ObjectId, ref: 'Product' },
      productName:   String,
      unit:          { type: String, default: '' },
      quantite:      { type: Number, default: 0 },
      prixUnitaire:  { type: Number, default: 0 },  // prix négocié pour ce partenaire
    }],
    default: [],
  })
  lignes: {
    productId: Types.ObjectId;
    productName: string;
    unit: string;
    quantite: number;
    prixUnitaire: number;
  }[];

  @Prop({ required: true, default: 0, min: 0 })
  total: number;

  @Prop({ default: 0, min: 0 })
  montantPaye: number;   // payé à la livraison (le reste = créance)

  @Prop({ enum: ['comptant', 'credit', 'depot_vente'], default: 'credit' })
  modePaiement: string;

  @Prop({ trim: true, default: '' })
  date: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creePar: Types.ObjectId;
}

export const LivraisonPartenaireSchema = SchemaFactory.createForClass(LivraisonPartenaire);
