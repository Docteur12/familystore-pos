import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Facture, FactureDocument } from '../schemas/facture.schema';

export interface CreateFactureDto {
  numero:        string;
  caissier:      string;
  montant:       number;
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
    // Déduplication par numéro : réimprimer un reçu ne crée pas de doublon.
    // $setOnInsert n'écrit qu'à la création ; si le numéro existe déjà, on
    // renvoie la facture existante telle quelle.
    return this.factureModel.findOneAndUpdate(
      { numero: dto.numero },
      { $setOnInsert: dto },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
  }

  async findAll(query: {
    dateFrom?: string;
    dateTo?:   string;
    page?:     number;
    limit?:    number;
  } = {}): Promise<{ data: FactureDocument[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.dateFrom || query.dateTo) {
      filter['createdAt'] = {};
      if (query.dateFrom) (filter['createdAt'] as any)['$gte'] = new Date(query.dateFrom + 'T00:00:00');
      if (query.dateTo)   (filter['createdAt'] as any)['$lte'] = new Date(query.dateTo   + 'T23:59:59');
    }

    const limit = Math.min(Number(query.limit) || 50, 100);
    const skip  = (Number(query.page) || 0) * limit;

    const [data, total] = await Promise.all([
      this.factureModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.factureModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async findOne(id: string): Promise<FactureDocument | null> {
    return this.factureModel.findById(id).exec();
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    await this.factureModel.findByIdAndDelete(id).exec();
    return { ok: true };
  }
}
