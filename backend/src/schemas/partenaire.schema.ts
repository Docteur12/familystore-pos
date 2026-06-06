import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PartenaireDocument = HydratedDocument<Partenaire>;

// Partenaire = client grossiste / revendeur livré depuis l'entrepôt.
@Schema({ timestamps: true })
export class Partenaire {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  phone: string;

  @Prop({ trim: true, default: '' })
  lieu: string;

  @Prop({ trim: true, default: '' })
  note: string;
}

export const PartenaireSchema = SchemaFactory.createForClass(Partenaire);
