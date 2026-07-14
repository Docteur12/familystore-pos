import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReceptionDocument = HydratedDocument<Reception>;

@Schema({ timestamps: true })
export class Reception {
  @Prop({ required: true, trim: true })
  fournisseur: string;

  @Prop({
    type: [{ productId: { type: Types.ObjectId, ref: 'Product' }, productName: String, quantity: Number }],
    default: [],
  })
  items: { productId: Types.ObjectId; productName: string; quantity: number }[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creePar: Types.ObjectId;

  @Prop({ default: '' })
  note: string;

  /** Clé d'idempotence — évite d'enregistrer deux fois la même réception
   *  lors de la synchronisation hors-ligne (rejeu réseau). */
  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;
}

export const ReceptionSchema = SchemaFactory.createForClass(Reception);
