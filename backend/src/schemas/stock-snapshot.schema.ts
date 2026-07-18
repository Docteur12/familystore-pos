import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StockSnapshotDocument = HydratedDocument<StockSnapshot>;

// Photo quotidienne de la valeur du stock (boutique + entrepôt), prise
// automatiquement une fois par jour — sert aux courbes d'évolution.
@Schema({ timestamps: true })
export class StockSnapshot {
  // Clé du jour au format AAAA-MM-JJ (un seul snapshot par jour)
  @Prop({ required: true, unique: true })
  dateKey: string;

  // Valeur au prix d'ACHAT (coût de la marchandise immobilisée)
  @Prop({ default: 0 })
  achatBoutique: number;

  @Prop({ default: 0 })
  achatEntrepot: number;

  // Valeur au prix de VENTE (potentiel de chiffre d'affaires)
  @Prop({ default: 0 })
  venteBoutique: number;

  @Prop({ default: 0 })
  venteEntrepot: number;

  // Quantités totales (info)
  @Prop({ default: 0 })
  qteBoutique: number;

  @Prop({ default: 0 })
  qteEntrepot: number;
}

export const StockSnapshotSchema = SchemaFactory.createForClass(StockSnapshot);
