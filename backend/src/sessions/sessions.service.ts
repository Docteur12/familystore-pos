import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CaisseSession, SessionDocument } from '../schemas/session.schema';
import { Sale, SaleDocument } from '../schemas/sale.schema';

export interface OpenSessionDto {
  cashierName:  string;
  cashierEmail: string;
  caisseName:   string;
  caisseCode:   string;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(CaisseSession.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Sale.name)          private saleModel:    Model<SaleDocument>,
  ) {}

  async open(dto: OpenSessionDto): Promise<SessionDocument> {
    return this.sessionModel.create({
      ...dto,
      dateDebut: new Date(),
      closed:    false,
    });
  }

  async findById(id: string): Promise<SessionDocument | null> {
    return this.sessionModel.findById(id).lean().exec();
  }

  async findActive(cashierEmail: string): Promise<(SessionDocument & { liveCount: number }) | null> {
    const session = await this.sessionModel
      .findOne({ cashierEmail, closed: false })
      .sort({ dateDebut: -1 })
      .lean()
      .exec();
    if (!session) return null;
    const liveCount = await this.saleModel.countDocuments({ sessionId: session._id.toString() });
    return { ...session, liveCount } as any;
  }

  async close(id: string): Promise<SessionDocument | null> {
    // Calculer les stats depuis les ventes liées à cette session
    const sales = await this.saleModel.find({ sessionId: id }).lean();
    const nbVentes     = sales.length;
    const totalEncaisse = sales.reduce((s, v) => s + v.total, 0);

    return this.sessionModel.findByIdAndUpdate(
      id,
      { dateFin: new Date(), closed: true, nbVentes, totalEncaisse },
      { new: true },
    ).exec();
  }

  async findAll(params?: {
    dateFrom?:   string;
    dateTo?:     string;
    cashier?:    string;
    page?:       number;
    limit?:      number;
    activeOnly?: boolean;
  }): Promise<{ data: SessionDocument[]; total: number }> {
    const filter: Record<string, unknown> = {};

    if (params?.dateFrom || params?.dateTo) {
      filter['dateDebut'] = {};
      if (params.dateFrom) (filter['dateDebut'] as any)['$gte'] = new Date(params.dateFrom);
      if (params.dateTo)   (filter['dateDebut'] as any)['$lte'] = new Date(params.dateTo);
    }
    if (params?.cashier) {
      filter['cashierName'] = { $regex: params.cashier, $options: 'i' };
    }
    if (params?.activeOnly) {
      filter['closed'] = false;
    }

    const limit = Math.min(Number(params?.limit) || 50, 100);
    const skip  = (Number(params?.page) || 0) * limit;

    const [data, total] = await Promise.all([
      this.sessionModel.find(filter).sort({ dateDebut: -1 }).skip(skip).limit(limit).exec(),
      this.sessionModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }
}
