import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RetourPartenaireDocument = HydratedDocument<RetourPartenaire>;

// Retour d'invendus d'un partenaire (dépôt-vente) : remis en stock entrepôt.
@Schema({ timestamps: true })
export class RetourPartenaire {
  @Prop({ type: Types.ObjectId, ref: 'Partenaire', required: true })
  partenaire: Types.ObjectId;

  @Prop({
    type: [{
      productId:    { type: Types.ObjectId, ref: 'Product' },
      productName:  String,
      quantite:     { type: Number, default: 0 },
      prixUnitaire: { type: Number, default: 0 },
    }],
    default: [],
  })
  lignes: {
    productId: Types.ObjectId;
    productName: string;
    quantite: number;
    prixUnitaire: number;
  }[];

  @Prop({ required: true, default: 0, min: 0 })
  total: number;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creePar: Types.ObjectId;
}

export const RetourPartenaireSchema = SchemaFactory.createForClass(RetourPartenaire);
