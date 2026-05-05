import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

export interface AuditEntry {
  type:      string;
  module:    string;
  actorName: string;
  actorRole: string;
  detail:    string;
  meta?:     Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private model: Model<AuditLogDocument>,
  ) {}

  // Fire-and-forget — ne bloque jamais le flux principal
  log(entry: AuditEntry): void {
    this.model.create(entry).catch(() => {});
  }

  async findAll(params: {
    type?:   string;
    module?: string;
    search?: string;
    limit?:  number;
  }) {
    const q: Record<string, any> = {};
    if (params.type)   q.type   = params.type;
    if (params.module) q.module = params.module;
    if (params.search) {
      const r = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ detail: r }, { actorName: r }];
    }
    return this.model
      .find(q)
      .sort({ createdAt: -1 })
      .limit(params.limit ?? 200)
      .lean();
  }

  async getStats() {
    const types = ['vente', 'connexion', 'creation', 'modification', 'suppression'];
    const counts: Record<string, number> = {};
    await Promise.all(
      types.map(async t => {
        counts[t] = await this.model.countDocuments({ type: t });
      }),
    );
    counts.total = await this.model.countDocuments();
    return counts;
  }
}
