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
    // Sécurité : ferme toute session encore ouverte de cette caissière
    // (oubli de fermeture la veille) avant d'en ouvrir une nouvelle.
    const ouvertes = await this.sessionModel.find({ cashierEmail: dto.cashierEmail, closed: false }).lean().exec();
    for (const s of ouvertes) await this.closeSession(s._id.toString());

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
    await this.autoCloseStale();
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
    return this.closeSession(id);
  }

  // Ferme une session ; dateFin = dernière vente (activité réelle), sinon
  // la valeur fournie, sinon maintenant (fermeture manuelle).
  private async closeSession(id: string, dateFin?: Date): Promise<SessionDocument | null> {
    const sales = await this.saleModel.find({ sessionId: id }).sort({ createdAt: -1 }).lean();
    const nbVentes      = sales.length;
    const totalEncaisse = sales.reduce((s, v) => s + v.total, 0);
    const fin = dateFin ?? (sales.length ? new Date((sales[0] as any).createdAt) : new Date());

    return this.sessionModel.findByIdAndUpdate(
      id,
      { dateFin: fin, closed: true, nbVentes, totalEncaisse },
      { new: true },
    ).exec();
  }

  // Ferme les sessions restées ouvertes depuis un jour précédent.
  // Heure de fermeture = dernière vente de la session, sinon l'heure de début
  // (session sans activité) — pour que la durée reste juste.
  private async autoCloseStale(): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const stale = await this.sessionModel
      .find({ closed: false, dateDebut: { $lt: startOfToday } })
      .lean()
      .exec();
    for (const s of stale) {
      const lastSale = await this.saleModel.find({ sessionId: s._id.toString() }).sort({ createdAt: -1 }).limit(1).lean();
      const fin = lastSale.length ? new Date((lastSale[0] as any).createdAt) : new Date(s.dateDebut);
      await this.closeSession(s._id.toString(), fin);
    }
  }

  // Correction unique : recale dateFin des sessions DÉJÀ fermées dont la durée
  // est manifestement gonflée (> seuil), à l'heure de la dernière vente (ou au
  // début si aucune vente). Ne rallonge jamais, ne touche pas les sessions normales.
  async corrigerDureesAnciennes(seuilHeures = 16): Promise<{ corrected: number }> {
    const seuilMs = seuilHeures * 3_600_000;
    const closed = await this.sessionModel.find({ closed: true, dateFin: { $ne: null } }).lean().exec();
    let corrected = 0;
    for (const s of closed) {
      const debut = new Date(s.dateDebut).getTime();
      const fin   = s.dateFin ? new Date(s.dateFin).getTime() : debut;
      if (fin - debut <= seuilMs) continue; // durée plausible → on ne touche pas
      const lastSale = await this.saleModel.find({ sessionId: s._id.toString() }).sort({ createdAt: -1 }).limit(1).lean();
      const newFin = lastSale.length ? new Date((lastSale[0] as any).createdAt) : new Date(s.dateDebut);
      if (newFin.getTime() >= fin) continue; // ne jamais rallonger
      await this.sessionModel.findByIdAndUpdate(s._id, { dateFin: newFin }).exec();
      corrected++;
    }
    return { corrected };
  }

  async findAll(params?: {
    dateFrom?:   string;
    dateTo?:     string;
    cashier?:    string;
    page?:       number;
    limit?:      number;
    activeOnly?: boolean;
  }): Promise<{ data: SessionDocument[]; total: number }> {
    await this.autoCloseStale();
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
