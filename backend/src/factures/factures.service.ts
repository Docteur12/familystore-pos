import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Facture, FactureDocument } from '../schemas/facture.schema';

export interface CreateFactureDto {
  numero:        string;
  caissier:      string;
  montant:       number;
  tva:           number;
  paymentMethod: string;
  items:         { name: string; quantity: number; unitPrice: number }[];
  pdfBase64:     string;
  date?:         string;
}

@Injectable()
export class FacturesService {
  constructor(
    @InjectModel(Facture.name) private factureModel: Model<FactureDocument>,
  ) {}

  async create(dto: CreateFactureDto): Promise<FactureDocument> {
    return this.factureModel.create(dto);
  }

  async findAll(query: {
    dateFrom?: string;
    dateTo?:   string;
    page?:     number;
    limit?:    number;
  } = {}): Promise<{ data: FactureDocument[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.dateFrom || query.dateTo) {
      filter['date'] = {};
      if (query.dateFrom) (filter['date'] as any)['$gte'] = new Date(query.dateFrom);
      if (query.dateTo)   (filter['date'] as any)['$lte'] = new Date(query.dateTo);
    }

    const limit = Math.min(Number(query.limit) || 50, 100);
    const skip  = (Number(query.page) || 0) * limit;

    const [data, total] = await Promise.all([
      this.factureModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      this.factureModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async findOne(id: string): Promise<FactureDocument | null> {
    return this.factureModel.findById(id).exec();
  }
}
