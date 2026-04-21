import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExpenseDocument = HydratedDocument<Expense>;

@Schema({ timestamps: true })
export class Expense {
  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ required: true, default: Date.now })
  date: Date;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
