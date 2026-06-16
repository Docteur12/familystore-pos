import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

// Taxonomie éditable (sans toucher au code) : une ligne = (catégorie, sous-catégorie).
// Une catégorie sans sous-catégorie est stockée avec subCategory = ''.
@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ trim: true, default: '' })
  subCategory: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ category: 1, subCategory: 1 }, { unique: true });
