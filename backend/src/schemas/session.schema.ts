import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SessionDocument = HydratedDocument<CaisseSession>;

@Schema({ timestamps: true })
export class CaisseSession {
  @Prop({ required: true })
  cashierName: string;

  @Prop({ default: '' })
  cashierEmail: string;

  @Prop({ default: '' })
  caisseName: string;

  @Prop({ default: '' })
  caisseCode: string;

  @Prop({ default: Date.now })
  dateDebut: Date;

  @Prop({ default: null })
  dateFin: Date | null;

  @Prop({ default: 0, min: 0 })
  nbVentes: number;

  @Prop({ default: 0, min: 0 })
  totalEncaisse: number;

  /** true = session fermée */
  @Prop({ default: false })
  closed: boolean;
}

export const CaisseSessionSchema = SchemaFactory.createForClass(CaisseSession);
