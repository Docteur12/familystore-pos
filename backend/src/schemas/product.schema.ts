import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ unique: true, sparse: true, trim: true })
  barcode: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  costPrice: number;

  @Prop({ required: true, default: 0, min: 0 })
  stock: number;

  @Prop({ default: 5, min: 0 })
  alertThreshold: number;

  @Prop({ trim: true })
  category: string;

  @Prop({ default: 'pce', trim: true })
  unit: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
