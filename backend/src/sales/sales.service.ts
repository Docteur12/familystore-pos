import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument }             from '../schemas/sale.schema';
import { Product, ProductDocument }       from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { EcartStock, EcartStockDocument } from '../schemas/ecart-stock.schema';
import { MailService }                    from '../mail/mail.service';
import { CreateSaleDto }                  from './dto/create-sale.dto';
import { ModifierVenteDto }               from './dto/modifier-vente.dto';
import { nomProduit }                     from '../common/nom-produit';

/**
 * Fenêtre pendant laquelle le patron peut corriger ou supprimer une vente.
 *
 * Garde-fou comptable : au-delà, le mois est considéré comme arrêté (rapports
 * édités, comptes remis). Rouvrir une vente ancienne changerait un chiffre
 * d'affaires déjà communiqué, sans que personne ne s'en aperçoive.
 */
export const FENETRE_CORRECTION_JOURS = 30;

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
    @InjectModel(Sale.name)          private saleModel:     Model<SaleDocument>,
    @InjectModel(Product.name)       private productModel:  Model<ProductDocument>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovementDocument>,
    @InjectModel(EcartStock.name)    private ecartModel:    Model<EcartStockDocument>,
    private mailService: MailService,
  ) {}

  // ── POST /api/sales ─────────────────────────────────────────────────────────

  async create(dto: CreateSaleDto, actor?: { name?: string; email?: string; role?: string; caisse?: { nom?: string } }) {

    // ── 0. Idempotence : si cette vente a déjà été enregistrée, on la renvoie ──
    //      telle quelle (aucune nouvelle écriture, aucun re-décrément de stock).
    if (dto.idempotencyKey) {
      const existing = await this.saleModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
      if (existing) {
        return { sale: existing, change: existing.change, alerts: [] };
      }
    }

    // ── 1. Vérification stock AVANT toute écriture ────────────────────────────
    // Les articles « divers » (non référencés) n'ont pas de produit → on les ignore.
    const realItems = dto.items.filter(i => !i.divers && i.product);
    const productIds = realItems.map(i => new Types.ObjectId(i.product!));
    const products   = await this.productModel
      .find({ _id: { $in: productIds } })
      .lean();

    const productMap = new Map(products.map(p => [String(p._id), p]));
    const stockErrors: string[] = [];

    for (const item of realItems) {
      const p = productMap.get(item.product!);
      if (!p) {
        stockErrors.push(`Produit introuvable : ${item.name}`);
        continue;
      }
      // Si forceVente → on autorise même si stock insuffisant
      if (!dto.forceVente && p.stock < item.quantity) {
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
    // Date réelle de la vente si fournie et valide (synchro hors-ligne)
    const dateVente = dto.dateVente && !isNaN(Date.parse(dto.dateVente)) ? new Date(dto.dateVente) : undefined;
    let sale: SaleDocument;
    try {
      sale = await this.saleModel.create({
        items:         dto.items,
        total:         dto.total,
        subtotal:      dto.subtotal ?? 0,
        offrePct:      dto.offrePct ?? 0,
        offreAmt:      dto.offreAmt ?? 0,
        ...(dateVente ? { dateVente, syncOffline: true } : {}),
        paymentMethod: dto.paymentMethod,
        amountPaid:    dto.amountPaid,
        change,
        cashierName:   actor?.name        ?? '',
        cashierEmail:  actor?.email       ?? '',
        // Le patron n'a pas de caisse assignée : ses ventes (dépannage) sont
        // attribuées clairement plutôt que laissées sans caisse.
        caisseName:    actor?.caisse?.nom || (actor?.role === 'patron' ? `Dépannage — ${actor?.name ?? 'Admin'}` : ''),
        sessionId:     dto.sessionId      ?? '',
        idempotencyKey: dto.idempotencyKey,
      });
    } catch (err: any) {
      // Course entre deux requêtes simultanées portant la même clé : l'index
      // unique rejette la 2e (code 11000). On renvoie la vente déjà créée
      // sans re-décrémenter le stock.
      if (dto.idempotencyKey && err?.code === 11000) {
        const existing = await this.saleModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
        if (existing) return { sale: existing, change: existing.change, alerts: [] };
      }
      throw err;
    }

    // ── 3b. Enregistrement des écarts si vente forcée ────────────────────────
    if (dto.forceVente && dto.ecarts?.length) {
      await Promise.all(dto.ecarts.map(e =>
        this.ecartModel.create({
          produit:        new Types.ObjectId(e.produit),
          nomProduit:     e.nomProduit,
          stockSysteme:   e.stockSysteme,
          quantiteVendue: e.quantiteVendue,
          ecart:          e.ecart,
          caissiereName:  actor?.name  ?? '',
          caissiereEmail: actor?.email ?? '',
          saleId:         sale._id,
          justification:  'Vente forcée',
          statut:         'en_attente',
        }),
      ));
    }

    // ── 4. Décrémentation stock + création mouvements (parallèle) ─────────────
    //      (uniquement pour les articles référencés — pas les « divers »)
    const updateResults = await Promise.all(
      realItems.map(item =>
        this.productModel
          .findByIdAndUpdate(item.product!, { $inc: { stock: -item.quantity } }, { new: true })
          .then(updated => ({ item, updated })),
      ),
    );

    if (realItems.length > 0) {
      await this.movementModel.insertMany(
        realItems.map(item => ({
          productId: new Types.ObjectId(item.product!),
          type:      'OUT',
          quantity:  item.quantity,
          reason:    'sale',
        })),
      );
    }

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

  // ── GET /api/sales/divers ─────────────────────────────────────────────────
  // Liste à plat les articles « divers » vendus (non référencés), à régulariser.

  async getDiversSales(limit = 300) {
    const sales = await this.saleModel
      .find({ 'items.divers': true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const rows: Array<{
      saleId: string; name: string; unitPrice: number; quantity: number;
      total: number; cashierName: string; caisseName: string; createdAt: Date;
    }> = [];

    for (const s of sales) {
      for (const it of (s.items ?? [])) {
        if ((it as any).divers) {
          rows.push({
            saleId:      String(s._id),
            name:        it.name,
            unitPrice:   it.unitPrice,
            quantity:    it.quantity,
            total:       it.unitPrice * it.quantity,
            cashierName: s.cashierName ?? '',
            caisseName:  s.caisseName ?? '',
            createdAt:   (s as any).createdAt,
          });
        }
      }
    }
    return rows;
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

  // ── DELETE /api/sales/:id ─────────────────────────────────────────────────
  // Supprime une vente (ex. vente de test) : restaure le stock des articles
  // référencés, trace un mouvement d'annulation, puis efface la vente.
  /**
   * Garde-fou temporel commun à la correction et à la suppression.
   * Lève si la vente est hors de la fenêtre de correction.
   */
  private verifierFenetre(sale: SaleDocument) {
    const dateVente = sale.dateVente ?? sale.createdAt;
    const jours = Math.floor((Date.now() - new Date(dateVente).getTime()) / 86_400_000);
    if (jours > FENETRE_CORRECTION_JOURS) {
      throw new BadRequestException(
        `Vente trop ancienne (${jours} jours) : au-delà de ${FENETRE_CORRECTION_JOURS} jours, ` +
        `la comptabilité est considérée comme arrêtée. Passez par un avoir plutôt que par une correction.`,
      );
    }
  }

  /**
   * PATCH /api/sales/:id — correction d'une vente (client revenu avec le ticket).
   *
   * Le stock est ajusté au DELTA, pas remis à zéro : si la quantité passe de 3 à
   * 1, on remet 2 en stock ; si elle passe de 1 à 3, on en sort 2 (et on refuse
   * si le stock ne suit pas). Les montants sont recalculés ici, jamais repris du
   * client. L'état d'avant est conservé dans `sale.modifications`.
   */
  async modifier(
    id: string,
    dto: ModifierVenteDto,
    actor?: { name?: string; email?: string },
  ) {
    const sale = await this.saleModel.findById(id);
    if (!sale) throw new NotFoundException('Vente introuvable');

    this.verifierFenetre(sale);

    // ── 1. Quantités par produit, avant et après ──────────────────────────────
    const quantites = (items: { product?: any; divers?: boolean; quantity: number }[]) => {
      const m = new Map<string, number>();
      for (const it of items) {
        if (it.divers || !it.product) continue;   // « divers » : aucun stock à bouger
        const k = String(it.product);
        m.set(k, (m.get(k) ?? 0) + it.quantity);
      }
      return m;
    };
    const avant = quantites(sale.items as any[]);
    const apres = quantites(dto.items as any[]);

    // ── 2. Contrôle du stock AVANT toute écriture ─────────────────────────────
    const ids = new Set([...avant.keys(), ...apres.keys()]);
    const produits = await this.productModel
      .find({ _id: { $in: [...ids].map(i => new Types.ObjectId(i)) } })
      .lean();
    const parId = new Map(produits.map(p => [String(p._id), p]));

    const erreurs: string[] = [];
    const deltas: { id: string; delta: number }[] = [];
    for (const pid of ids) {
      const delta = (apres.get(pid) ?? 0) - (avant.get(pid) ?? 0);   // > 0 = il faut sortir du stock
      if (delta === 0) continue;
      const p = parId.get(pid);
      if (!p) { erreurs.push(`Produit introuvable dans le catalogue (${pid})`); continue; }
      if (delta > 0 && p.stock < delta) {
        erreurs.push(
          `Stock insuffisant pour "${nomProduit(p.name)}" : disponible ${p.stock}, il en faut ${delta} de plus`,
        );
      }
      deltas.push({ id: pid, delta });
    }
    if (erreurs.length > 0) throw new BadRequestException(erreurs.join(' | '));

    // ── 3. Recalcul des montants — côté serveur uniquement ────────────────────
    const subtotal      = dto.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const offrePct      = dto.offrePct ?? sale.offrePct ?? 0;
    const offreAmt      = Math.round(subtotal * offrePct / 100);
    const total         = subtotal - offreAmt;
    const paymentMethod = dto.paymentMethod ?? sale.paymentMethod;
    const amountPaid    = dto.amountPaid    ?? sale.amountPaid;

    if (paymentMethod !== 'credit' && amountPaid < total) {
      throw new BadRequestException(
        `Montant remis (${amountPaid} XAF) inférieur au nouveau total (${total} XAF) : ` +
        `encaissez le complément et saisissez le nouveau montant remis.`,
      );
    }
    const change = Math.max(0, amountPaid - total);

    // ── 4. Ajustement du stock + mouvements tracés ────────────────────────────
    const ref = String(sale._id).slice(-6).toUpperCase();
    for (const { id: pid, delta } of deltas) {
      await this.productModel.findByIdAndUpdate(pid, { $inc: { stock: -delta } });
      await this.movementModel.create({
        productId: new Types.ObjectId(pid),
        type:      delta > 0 ? 'OUT' : 'IN',
        quantity:  Math.abs(delta),
        reason:    'modification_vente',
        note:      `Correction vente ${ref} — ${dto.motif}`,
      });
    }

    // ── 5. Trace de l'état d'avant, puis écriture ─────────────────────────────
    sale.modifications = [
      ...(sale.modifications ?? []),
      {
        date:         new Date(),
        parNom:       actor?.name  ?? '',
        parEmail:     actor?.email ?? '',
        motif:        dto.motif,
        ancienTotal:  sale.total,
        nouveauTotal: total,
        anciensItems: (sale.items as any[]).map(it => ({
          product: it.product ? String(it.product) : undefined,
          name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, divers: it.divers ?? false,
        })),
      },
    ];

    const ancienTotal = sale.total;
    sale.items         = dto.items as any;
    sale.subtotal      = subtotal;
    sale.offrePct      = offrePct;
    sale.offreAmt      = offreAmt;
    sale.total         = total;
    sale.paymentMethod = paymentMethod;
    sale.amountPaid    = amountPaid;
    sale.change        = change;
    await sale.save();

    return { sale: sale.toObject(), ancienTotal, nouveauTotal: total, ref };
  }

  async remove(id: string, motif?: string) {
    const sale = await this.saleModel.findById(id);
    if (!sale) throw new NotFoundException('Vente introuvable');

    this.verifierFenetre(sale);

    for (const item of sale.items) {
      if (item.divers || !item.product) continue; // les articles divers n'ont pas de stock
      await this.productModel.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
      await this.movementModel.create({
        productId: item.product,
        type:      'IN',
        quantity:  item.quantity,
        reason:    'annulation_vente',
        note:      `Annulation vente ${String(sale._id).slice(-6).toUpperCase()}${motif ? ` — ${motif}` : ''}`,
      });
    }

    await this.saleModel.findByIdAndDelete(id);
    return { ok: true, total: sale.total, caisseName: sale.caisseName ?? '', motif: motif ?? '' };
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

    const totals    = sales.map(s => s.total);
    const minTicket = totals.length > 0 ? Math.min(...totals) : 0;
    const maxTicket = totals.length > 0 ? Math.max(...totals) : 0;
    const avgTicket = nbVentes > 0 ? Math.round(totalCA / nbVentes) : 0;

    return {
      date:    start.toISOString().split('T')[0],
      totalCA,
      prevCA,
      nbVentes,
      benefice,
      marge:   totalCA > 0 ? Math.round((benefice / totalCA) * 100) : 0,
      minTicket, maxTicket, avgTicket,
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

  async statsPeriod(days: number, dateFrom?: string, dateTo?: string) {
    const now = new Date();
    let start: Date, end: Date;
    if (dateFrom) {
      start = new Date(dateFrom + 'T00:00:00');
      end   = dateTo ? new Date(dateTo + 'T23:59:59') : new Date();
      days  = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
    } else {
      end   = now;
      start = new Date(now);
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
    }

    const sales = await this.saleModel
      .find({ createdAt: { $gte: start, $lte: end } })
      .select('total createdAt')
      .lean();

    type PeriodBucket = { totalCA: number; nbVentes: number; totals: number[] };
    const ticketStats = (b: PeriodBucket) => ({
      minTicket: b.totals.length > 0 ? Math.min(...b.totals) : 0,
      maxTicket: b.totals.length > 0 ? Math.max(...b.totals) : 0,
      avgTicket: b.totals.length > 0 ? Math.round(b.totalCA / b.totals.length) : 0,
    });

    if (days <= 30) {
      // Regroupement journalier
      const byDay: Record<string, PeriodBucket> = {};
      for (const sale of sales) {
        const key = new Date(sale.createdAt).toISOString().split('T')[0];
        if (!byDay[key]) byDay[key] = { totalCA: 0, nbVentes: 0, totals: [] };
        byDay[key].totalCA  += sale.total;
        byDay[key].nbVentes += 1;
        byDay[key].totals.push(sale.total);
      }
      return Array.from({ length: days }, (_, i) => {
        const d   = new Date(now);
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().split('T')[0];
        const b   = byDay[key] ?? { totalCA: 0, nbVentes: 0, totals: [] };
        return {
          date: key,
          label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          totalCA: b.totalCA,
          nbVentes: b.nbVentes,
          ...ticketStats(b),
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
      const byWeek: Record<string, PeriodBucket> = {};
      for (const sale of sales) {
        const key = mondayOf(new Date(sale.createdAt));
        if (!byWeek[key]) byWeek[key] = { totalCA: 0, nbVentes: 0, totals: [] };
        byWeek[key].totalCA  += sale.total;
        byWeek[key].nbVentes += 1;
        byWeek[key].totals.push(sale.total);
      }
      return Object.entries(byWeek)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, b]) => ({
          date: key,
          label: new Date(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          totalCA: b.totalCA,
          nbVentes: b.nbVentes,
          ...ticketStats(b),
        }));
    }

    // Regroupement mensuel (365 jours)
    const byMonth: Record<string, PeriodBucket> = {};
    for (const sale of sales) {
      const d   = new Date(sale.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { totalCA: 0, nbVentes: 0, totals: [] };
      byMonth[key].totalCA  += sale.total;
      byMonth[key].nbVentes += 1;
      byMonth[key].totals.push(sale.total);
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, b]) => {
        const [y, m] = key.split('-').map(Number);
        return {
          date: key,
          label: new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          totalCA: b.totalCA,
          nbVentes: b.nbVentes,
          ...ticketStats(b),
        };
      });
  }

  // ── GET /api/sales/stats/by-product — journal par produit ──────────────────

  async byProduct(params?: { dateFrom?: string; dateTo?: string }) {
    const q: Record<string, any> = {};
    if (params?.dateFrom || params?.dateTo) {
      q.createdAt = {};
      if (params?.dateFrom) q.createdAt.$gte = new Date(params.dateFrom);
      if (params?.dateTo) {
        const dt = new Date(params.dateTo);
        dt.setDate(dt.getDate() + 1);
        q.createdAt.$lt = dt;
      }
    }
    const sales = await this.saleModel.find(q).select('items').lean();

    const map: Record<string, { productId: string | null; name: string; qty: number; ca: number; nbTx: number }> = {};
    for (const sale of sales) {
      for (const item of sale.items as any[]) {
        const key  = item.product ? String(item.product) : `n:${item.name}`;
        const name = item.name || '?';
        if (!map[key]) map[key] = { productId: item.product ? String(item.product) : null, name, qty: 0, ca: 0, nbTx: 0 };
        map[key].qty   += item.quantity;
        map[key].ca    += item.unitPrice * item.quantity;
        map[key].nbTx  += 1;
      }
    }

    return Object.values(map)
      .map(d => ({
        productId:      d.productId,   // permet au front de retrouver la fiche produit (infobulle)
        name:           d.name,
        qtySold:        d.qty,
        caGenere:       Math.round(d.ca),
        nbTransactions: d.nbTx,
        prixMoyenVente: d.qty > 0 ? Math.round(d.ca / d.qty) : 0,
      }))
      .sort((a, b) => b.caGenere - a.caGenere);
  }

  // ── GET /api/sales/stats/comparisons — comparaisons semaine/mois/année ─────

  async comparisons() {
    const now = new Date();

    const helper = async (start: Date, end: Date) => {
      const sales = await this.saleModel
        .find({ createdAt: { $gte: start, $lt: end } })
        .select('total')
        .lean();
      const totals = sales.map(s => s.total);
      const ca     = totals.reduce((s, v) => s + v, 0);
      const nb     = totals.length;
      return { ca, nb, min: nb > 0 ? Math.min(...totals) : 0, max: nb > 0 ? Math.max(...totals) : 0, avg: nb > 0 ? Math.round(ca / nb) : 0 };
    };

    const dow = now.getDay() || 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dow - 1));
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);

    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);

    const yearStart     = new Date(now.getFullYear(), 0, 1);
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevYearEnd   = new Date(now.getFullYear(), 0, 1);

    const [week, prevWeek, month, prevMonth, year, prevYear] = await Promise.all([
      helper(weekStart,     new Date()),
      helper(prevWeekStart, prevWeekEnd),
      helper(monthStart,    new Date()),
      helper(prevMonthStart, prevMonthEnd),
      helper(yearStart,     new Date()),
      helper(prevYearStart, prevYearEnd),
    ]);

    return { week, prevWeek, month, prevMonth, year, prevYear };
  }

  // ── GET /api/sales/stats/payment?scope=week — répartition modes paiement ──

  async paymentBreakdown(params?: { days?: number; dateFrom?: string; dateTo?: string }) {
    const end = params?.dateTo ? new Date(params.dateTo + 'T23:59:59') : new Date();
    let start: Date;
    if (params?.dateFrom) {
      start = new Date(params.dateFrom + 'T00:00:00');
    } else {
      start = new Date(end);
      start.setDate(start.getDate() - ((params?.days ?? 7) - 1));
      start.setHours(0, 0, 0, 0);
    }

    const sales = await this.saleModel
      .find({ createdAt: { $gte: start, $lte: end } })
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

  // ── GET /api/sales/stats/multi-year — comparaison N dernières années ──────

  async multiYear(yearsCount = 5) {
    const now         = new Date();
    const currentYear = now.getFullYear();
    const years       = Array.from({ length: yearsCount }, (_, i) => currentYear - (yearsCount - 1 - i));

    return Promise.all(years.map(async year => {
      const start = new Date(year, 0, 1);
      const end   = new Date(year + 1, 0, 1);
      const sales = await this.saleModel
        .find({ createdAt: { $gte: start, $lt: end } })
        .select('total createdAt')
        .lean();

      const byMonth = new Array(12).fill(0);
      for (const sale of sales) {
        byMonth[new Date(sale.createdAt).getMonth()] += sale.total;
      }

      return {
        year,
        months:  byMonth.map(Math.round),
        totalCA: Math.round(sales.reduce((s, v) => s + v.total, 0)),
      };
    }));
  }

  // ── GET /api/sales/stats/top-products ─────────────────────────────────────

  topProducts(params?: { days?: number; dateFrom?: string; dateTo?: string }) {
    const end = params?.dateTo ? new Date(params.dateTo + 'T23:59:59') : new Date();
    let start: Date;
    if (params?.dateFrom) {
      start = new Date(params.dateFrom + 'T00:00:00');
    } else {
      start = new Date(end);
      start.setDate(start.getDate() - ((params?.days ?? 7) - 1));
      start.setHours(0, 0, 0, 0);
    }

    return this.saleModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
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
