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
    caissier?: string;
    paymentMethod?: string;
    page?:     number;
    limit?:    number;
  } = {}): Promise<{ data: FactureDocument[]; total: number; totalMontant: number; caissiers: string[]; modesPaiement: string[] }> {
    const filter: Record<string, unknown> = {};
    // Accepte « YYYY-MM-DD » (on complète l'heure) ou un ISO complet (tel quel)
    const parseDate = (v: string, suffix: string) => new Date(v.includes('T') ? v : v + suffix);
    if (query.dateFrom || query.dateTo) {
      filter['createdAt'] = {};
      if (query.dateFrom) (filter['createdAt'] as any)['$gte'] = parseDate(query.dateFrom, 'T00:00:00');
      if (query.dateTo)   (filter['createdAt'] as any)['$lte'] = parseDate(query.dateTo,   'T23:59:59');
    }
    if (query.caissier) filter['caissier'] = query.caissier;
    if (query.paymentMethod) filter['paymentMethod'] = query.paymentMethod;

    const limit = Math.min(Number(query.limit) || 50, 100);
    const skip  = (Number(query.page) || 0) * limit;

    const [data, total, sommes, caissiers, modesPaiement] = await Promise.all([
      this.factureModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.factureModel.countDocuments(filter).exec(),
      // CA TOTAL du filtre (toutes pages confondues) — pas seulement la page affichée
      this.factureModel.aggregate([{ $match: filter }, { $group: { _id: null, montant: { $sum: '$montant' } } }]).exec(),
      this.factureModel.distinct('caissier').exec(),
      this.factureModel.distinct('paymentMethod').exec(),
    ]);
    return {
      data, total,
      totalMontant: sommes[0]?.montant ?? 0,
      caissiers: (caissiers as string[]).filter(Boolean).sort(),
      modesPaiement: (modesPaiement as string[]).filter(Boolean).sort(),
    };
  }

  async findOne(id: string): Promise<FactureDocument | null> {
    return this.factureModel.findById(id).exec();
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    await this.factureModel.findByIdAndDelete(id).exec();
    return { ok: true };
  }
}
