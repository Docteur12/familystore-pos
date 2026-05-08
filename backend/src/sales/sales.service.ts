import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument }             from '../schemas/sale.schema';
import { Product, ProductDocument }       from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { MailService }                    from '../mail/mail.service';
import { CreateSaleDto }                  from './dto/create-sale.dto';

export interface StockAlert {
  alert:          true;
  productId:      string;
  productName:    string;
  stock:          number;
  alertThreshold: number;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectModel(Sale.name)          private saleModel:    Model<SaleDocument>,
    @InjectModel(Product.name)       private productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovementDocument>,
    private mailService: MailService,
  ) {}

  // ── POST /api/sales ─────────────────────────────────────────────────────────

  async create(dto: CreateSaleDto, actor?: { name?: string; email?: string; caisse?: { nom?: string } }) {

    // ── 1. Vérification stock AVANT toute écriture ────────────────────────────
    const productIds = dto.items.map(i => new Types.ObjectId(i.product));
    const products   = await this.productModel
      .find({ _id: { $in: productIds } })
      .lean();

    const productMap = new Map(products.map(p => [String(p._id), p]));
    const stockErrors: string[] = [];

    for (const item of dto.items) {
      const p = productMap.get(item.product);
      if (!p) {
        stockErrors.push(`Produit introuvable : ${item.name}`);
        continue;
      }
      if (p.stock < item.quantity) {
        stockErrors.push(
          `Stock insuffisant pour "${p.name}" : disponible ${p.stock}, demandé ${item.quantity}`,
        );
      }
    }

    if (stockErrors.length > 0) {
      throw new BadRequestException(stockErrors.join(' | '));
    }

    // ── 2. Calcul monnaie rendue ──────────────────────────────────────────────
    const change = Math.max(0, dto.amountPaid - dto.total);

    // ── 3. Enregistrement de la vente ─────────────────────────────────────────
    const sale = await this.saleModel.create({
      items:         dto.items,
      total:         dto.total,
      paymentMethod: dto.paymentMethod,
      amountPaid:    dto.amountPaid,
      change,
      cashierName:   actor?.name        ?? '',
      cashierEmail:  actor?.email       ?? '',
      caisseName:    actor?.caisse?.nom ?? '',
      sessionId:     dto.sessionId      ?? '',
    });

    // ── 4. Décrémentation stock + création mouvements (parallèle) ─────────────
    const updateResults = await Promise.all(
      dto.items.map(item =>
        this.productModel
          .findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } }, { new: true })
          .then(updated => ({ item, updated })),
      ),
    );

    await this.movementModel.insertMany(
      dto.items.map(item => ({
        productId: new Types.ObjectId(item.product),
        type:      'OUT',
        quantity:  item.quantity,
        reason:    'sale',
      })),
    );

    const stockAlerts: StockAlert[] = [];

    for (const { item, updated } of updateResults) {
      if (!updated) {
        this.logger.warn(`Produit introuvable après vérification : ${item.product}`);
        continue;
      }

      if (updated.stock <= updated.alertThreshold) {
        stockAlerts.push({
          alert:          true,
          productId:      String(updated._id),
          productName:    updated.name,
          stock:          updated.stock,
          alertThreshold: updated.alertThreshold,
        });

        // Email alerte — fire & forget
        this.mailService
          .sendStockAlert(updated.name, updated.stock, updated.alertThreshold)
          .catch(err =>
            this.logger.error(`[MailAlert] "${updated.name}": ${err.message}`),
          );
      }
    }

    return { sale, change, alerts: stockAlerts };
  }

  // ── GET /api/sales ──────────────────────────────────────────────────────────

  findAll(params?: { dateFrom?: string; dateTo?: string }) {
    const q: Record<string, any> = {};
    if (params?.dateFrom || params?.dateTo) {
      q.createdAt = {};
      if (params.dateFrom) q.createdAt.$gte = new Date(params.dateFrom);
      if (params.dateTo)   q.createdAt.$lt  = new Date(params.dateTo);
    }
    return this.saleModel
      .find(q)
      .populate('items.product', 'name barcode unit costPrice')
      .sort({ createdAt: -1 })
      .lean();
  }

  // ── GET /api/sales/:id ──────────────────────────────────────────────────────

  async findOne(id: string) {
    const sale = await this.saleModel
      .findById(id)
      .populate('items.product', 'name barcode unit price')
      .lean();
    if (!sale) throw new NotFoundException('Vente introuvable');
    return sale;
  }

  // ── GET /api/sales/stats/today ─────────────────────────────────────────────

  async statsToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    // Même jour la semaine dernière pour comparaison
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(prevStart);
    prevEnd.setDate(prevEnd.getDate() + 1);

    const [sales, prevSales] = await Promise.all([
      this.saleModel
        .find({ createdAt: { $gte: start, $lt: end } })
        .populate('items.product', 'costPrice name')
        .lean(),
      this.saleModel
        .find({ createdAt: { $gte: prevStart, $lt: prevEnd } })
        .lean(),
    ]);

    const totalCA  = sales.reduce((s, v) => s + v.total, 0);
    const prevCA   = prevSales.reduce((s, v) => s + v.total, 0);
    const nbVentes = sales.length;

    let benefice = 0;
    for (const sale of sales) {
      for (const item of sale.items as any[]) {
        const costPrice: number = item.product?.costPrice ?? 0;
        benefice += (item.unitPrice - costPrice) * item.quantity;
      }
    }

    return {
      date:    start.toISOString().split('T')[0],
      totalCA,
      prevCA,
      nbVentes,
      benefice,
      marge:   totalCA > 0 ? Math.round((benefice / totalCA) * 100) : 0,
    };
  }

  // ── GET /api/sales/stats/recent — 5 dernières ventes du jour ──────────────

  async recentToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return this.saleModel
      .find({ createdAt: { $gte: start, $lt: end } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('total paymentMethod amountPaid change createdAt items')
      .lean();
  }

  // ── GET /api/sales/stats/period?days=N — données pour graphe ──────────────

  async statsPeriod(days: number) {
    const now   = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const sales = await this.saleModel
      .find({ createdAt: { $gte: start } })
      .select('total createdAt')
      .lean();

    if (days <= 30) {
      // Regroupement journalier
      const byDay: Record<string, { totalCA: number; nbVentes: number }> = {};
      for (const sale of sales) {
        const key = new Date(sale.createdAt).toISOString().split('T')[0];
        if (!byDay[key]) byDay[key] = { totalCA: 0, nbVentes: 0 };
        byDay[key].totalCA  += sale.total;
        byDay[key].nbVentes += 1;
      }
      return Array.from({ length: days }, (_, i) => {
        const d   = new Date(now);
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().split('T')[0];
        return {
          date:     key,
          label:    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          totalCA:  byDay[key]?.totalCA  ?? 0,
          nbVentes: byDay[key]?.nbVentes ?? 0,
        };
      });
    }

    if (days <= 90) {
      // Regroupement hebdomadaire
      const mondayOf = (d: Date): string => {
        const copy = new Date(d);
        const dow  = copy.getDay();
        copy.setDate(copy.getDate() - (dow === 0 ? 6 : dow - 1));
        copy.setHours(0, 0, 0, 0);
        return copy.toISOString().split('T')[0];
      };
      const byWeek: Record<string, { totalCA: number; nbVentes: number }> = {};
      for (const sale of sales) {
        const key = mondayOf(new Date(sale.createdAt));
        if (!byWeek[key]) byWeek[key] = { totalCA: 0, nbVentes: 0 };
        byWeek[key].totalCA  += sale.total;
        byWeek[key].nbVentes += 1;
      }
      return Object.entries(byWeek)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, d]) => ({
          date:     key,
          label:    new Date(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          totalCA:  d.totalCA,
          nbVentes: d.nbVentes,
        }));
    }

    // Regroupement mensuel (365 jours)
    const byMonth: Record<string, { totalCA: number; nbVentes: number }> = {};
    for (const sale of sales) {
      const d   = new Date(sale.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { totalCA: 0, nbVentes: 0 };
      byMonth[key].totalCA  += sale.total;
      byMonth[key].nbVentes += 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => {
        const [y, m] = key.split('-').map(Number);
        return {
          date:     key,
          label:    new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          totalCA:  d.totalCA,
          nbVentes: d.nbVentes,
        };
      });
  }

  // ── GET /api/sales/stats/payment?scope=week — répartition modes paiement ──

  async paymentBreakdown(scope: 'today' | 'week') {
    const start = new Date();
    if (scope === 'today') {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    }

    const sales = await this.saleModel
      .find({ createdAt: { $gte: start } })
      .select('total paymentMethod')
      .lean();

    const totalCA = sales.reduce((s, v) => s + v.total, 0);
    const byPm: Record<string, { total: number; count: number }> = {};
    for (const sale of sales) {
      if (!byPm[sale.paymentMethod]) byPm[sale.paymentMethod] = { total: 0, count: 0 };
      byPm[sale.paymentMethod].total += sale.total;
      byPm[sale.paymentMethod].count += 1;
    }

    const PM_LABELS: Record<string, string> = {
      cash:         'Espèces',       mtn_momo:    'MTN MoMo',
      orange_money: 'Orange Money',  card:        'Carte bancaire',
      mobile_money: 'Mobile Money',  credit:      'Crédit',
    };

    return Object.entries(byPm)
      .map(([mode, d]) => ({
        mode,
        label: PM_LABELS[mode] ?? mode,
        total: d.total,
        count: d.count,
        pct:   totalCA > 0 ? Math.round((d.total / totalCA) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  // ── GET /api/sales/stats/week ─────────────────────────────────────────────

  async statsWeek() {
    const days: Array<{
      date: string; label: string; totalCA: number; nbVentes: number;
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [agg] = await this.saleModel.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, totalCA: { $sum: '$total' }, nbVentes: { $sum: 1 } } },
      ]);

      days.push({
        date:     start.toISOString().split('T')[0],
        label:    start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        totalCA:  agg?.totalCA  ?? 0,
        nbVentes: agg?.nbVentes ?? 0,
      });
    }

    return days;
  }

  // ── GET /api/sales/stats/top-products ─────────────────────────────────────

  topProducts() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    return this.saleModel.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $unwind: '$items' },
      {
        $group: {
          _id:          '$items.product',
          totalQty:     { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products', localField: '_id', foreignField: '_id', as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 1, name: '$product.name', category: '$product.category',
          unit: '$product.unit', totalQty: 1, totalRevenue: 1,
        },
      },
    ]);
  }
}
