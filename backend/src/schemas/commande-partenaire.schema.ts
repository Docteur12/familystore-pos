import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommandePartenaireDocument = HydratedDocument<CommandePartenaire>;

// Commande passée par un partenaire grossiste (demande d'approvisionnement).
@Schema({ timestamps: true })
export class CommandePartenaire {
  @Prop({ required: true, trim: true })
  numero: string;

  @Prop({ type: Types.ObjectId, ref: 'Partenaire', required: true })
  partenaire: Types.ObjectId;

  // Agence concernée (optionnel ; null = partenaire sans agence / particulier)
  @Prop({ type: Types.ObjectId, ref: 'Agence', default: null })
  agence: Types.ObjectId | null;

  @Prop({
    type: [{
      productId:      { type: Types.ObjectId, ref: 'Product' },
      productName:    String,
      unit:           { type: String, default: '' },
      quantite:       { type: Number, default: 0 },   // quantité commandée
      quantiteLivree: { type: Number, default: 0 },   // cumul réellement servi (reliquat = quantite - quantiteLivree)
      prixUnitaire:   { type: Number, default: 0 },
    }],
    default: [],
  })
  lignes: {
    productId: Types.ObjectId;
    productName: string;
    unit: string;
    quantite: number;
    quantiteLivree: number;
    prixUnitaire: number;
  }[];

  @Prop({ enum: ['comptant', 'credit', 'depot_vente'], default: 'credit' })
  modePaiement: string;

  @Prop({ default: 0 })
  delai: number;   // délai de livraison en jours

  // 'partielle' = partiellement livrée (reliquat ouvert)
  @Prop({ enum: ['recue', 'preparee', 'partielle', 'livree'], default: 'recue' })
  statut: string;

  @Prop({ trim: true, default: '' })
  note: string;

  // Bon de livraison généré à partir de cette commande (le cas échéant)
  @Prop({ type: Types.ObjectId, ref: 'LivraisonPartenaire', default: null })
  livraison: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creePar: Types.ObjectId;
}

export const CommandePartenaireSchema = SchemaFactory.createForClass(CommandePartenaire);
