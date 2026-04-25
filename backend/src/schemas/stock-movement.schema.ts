import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StockMovementDocument = HydratedDocument<StockMovement>;

export type MovementType   = 'IN' | 'OUT';
export type MovementReason = 'restock' | 'sale' | 'adjustment';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ required: true, enum: ['IN', 'OUT'] })
  type: MovementType;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, enum: ['restock', 'sale', 'adjustment'], default: 'restock' })
  reason: MovementReason;

  @Prop({ trim: true })
  note?: string;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
