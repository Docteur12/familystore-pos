import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RetourFournisseurDocument = HydratedDocument<RetourFournisseur>;

// Retour de marchandises À un fournisseur (invendus, périmés, défectueux…).
// La quantité sort du stock choisi (boutique ou entrepôt) avec un mouvement tracé.
// N'affecte PAS la dette : on ne doit au fournisseur que ce qui a été VENDU.
@Schema({ timestamps: true })
export class RetourFournisseur {
  @Prop({ required: true, trim: true })
  fournisseur: string;

  @Prop({
    type: [{
      productId:   { type: Types.ObjectId, ref: 'Product' },
      productName: String,
      quantite:    { type: Number, default: 0 },
      prixAchat:   { type: Number, default: 0 },   // valeur unitaire (info)
      origine:     { type: String, enum: ['boutique', 'entrepot'], default: 'entrepot' },
    }],
    default: [],
  })
  lignes: {
    productId: Types.ObjectId;
    productName: string;
    quantite: number;
    prixAchat: number;
    origine: string;
  }[];

  // Valeur totale du retour au prix d'achat (info / traçabilité)
  @Prop({ default: 0, min: 0 })
  total: number;

  @Prop({ default: '', trim: true })
  note: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creePar: Types.ObjectId;
}

export const RetourFournisseurSchema = SchemaFactory.createForClass(RetourFournisseur);
RetourFournisseurSchema.index({ fournisseur: 1, createdAt: -1 });
