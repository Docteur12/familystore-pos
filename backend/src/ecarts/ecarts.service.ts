import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EcartStock, EcartStockDocument } from '../schemas/ecart-stock.schema';

@Injectable()
export class EcartsService {
  constructor(
    @InjectModel(EcartStock.name) private ecartModel: Model<EcartStockDocument>,
  ) {}

  async findAll(params?: { statut?: string; page?: number; limit?: number }) {
    const filter: Record<string, unknown> = {};
    if (params?.statut) filter['statut'] = params.statut;

    const limit = Math.min(Number(params?.limit) || 50, 100);
    const skip  = (Number(params?.page) || 0) * limit;

    const [data, total] = await Promise.all([
      this.ecartModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.ecartModel.countDocuments(filter),
    ]);
    return { data, total };
  }

  async countEnAttente(): Promise<number> {
    return this.ecartModel.countDocuments({ statut: 'en_attente' });
  }

  async marquerResolu(id: string) {
    return this.ecartModel.findByIdAndUpdate(
      id,
      { statut: 'resolu', dateResolu: new Date() },
      { new: true },
    );
  }

  async stats() {
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const start = new Date(year, month - 1, 1);

    const [total, parMois, topProduits, topCaissieres] = await Promise.all([
      this.ecartModel.countDocuments({}),
      this.ecartModel.aggregate([
        { $group: {
          _id:   { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
          ecartTotal: { $sum: '$ecart' },
        }},
        { $sort: { _id: -1 } },
        { $limit: 12 },
      ]),
      this.ecartModel.aggregate([
        { $group: {
          _id:   '$nomProduit',
          count: { $sum: 1 },
          ecartTotal: { $sum: '$ecart' },
        }},
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      this.ecartModel.aggregate([
        { $group: {
          _id:   '$caissiereName',
          count: { $sum: 1 },
          ecartTotal: { $sum: '$ecart' },
        }},
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return { total, parMois, topProduits, topCaissieres };
  }
}
