import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  // 'vente' | 'connexion' | 'creation' | 'modification' | 'suppression'
  @Prop({ required: true, index: true })
  type: string;

  // 'auth' | 'produits' | 'ventes' | 'stock' | 'caisses' | 'paramètres'
  @Prop({ required: true, index: true })
  module: string;

  @Prop({ required: true })
  actorName: string;

  @Prop({ required: true })
  actorRole: string;

  @Prop({ required: true })
  detail: string;

  // Données complémentaires libres (montant, ticket, etc.)
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  meta: Record<string, any>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Index TTL optionnel — garder les logs 365 jours
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });
