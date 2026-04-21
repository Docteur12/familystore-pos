import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sale, SaleDocument } from '../schemas/sale.schema';
import { Product, ProductDocument } from '../schemas/product.schema';
import { MailService } from '../mail/mail.service';
import { CreateSaleDto } from './dto/create-sale.dto';

interface StockAlert {
  alert: true;
  productId: string;
  productName: string;
  stock: number;
  alertThreshold: number;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectModel(Sale.name)    private saleModel:    Model<SaleDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private mailService: MailService,
  ) {}

  // ── POST /sales ────────────────────────────────────────────────────────────

  async create(dto: CreateSaleDto) {
    const sale = await this.saleModel.create(dto);
    const stockAlerts: StockAlert[] = [];

    for (const item of dto.items) {
      const product = await this.productModel.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity } },
        { new: true },
      );

      if (!product) {
        this.logger.warn(`Produit introuvable pour décrémentation : ${item.product}`);
        continue;
      }

      if (product.stock <= product.alertThreshold) {
        stockAlerts.push({
          alert: true,
          productId:      String(product._id),
          productName:    product.name,
          stock:          product.stock,
          alertThreshold: product.alertThreshold,
        });

        // fire & forget — la réponse HTTP n'attend pas l'envoi mail
        this.mailService
          .sendStockAlert(product.name, product.stock, product.alertThreshold)
          .catch(err =>
            this.logger.error(`[MailAlert] "${product.name}": ${err.message}`),
          );
      }
    }

    return { sale, alerts: stockAlerts };
  }

  // ── GET /sales/stats/week ─────────────────────────────────────────────────

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

  // ── GET /sales/stats/top-products ─────────────────────────────────────────

  async topProducts() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6); // 7 derniers jours

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
          from:         'products',
          localField:   '_id',
          foreignField: '_id',
          as:           'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id:          1,
          name:         '$product.name',
          category:     '$product.category',
          unit:         '$product.unit',
          totalQty:     1,
          totalRevenue: 1,
        },
      },
    ]);
  }

  // ── GET /sales ─────────────────────────────────────────────────────────────

  findAll() {
    return this.saleModel
      .find()
      .populate('items.product', 'name barcode unit')
      .sort({ createdAt: -1 });
  }

  // ── GET /sales/stats/today ─────────────────────────────────────────────────

  async statsToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const sales = await this.saleModel
      .find({ createdAt: { $gte: start, $lt: end } })
      .populate('items.product', 'costPrice name')
      .lean();

    const totalCA  = sales.reduce((s, v) => s + v.total, 0);
    const nbVentes = sales.length;

    let benefice = 0;
    for (const sale of sales) {
      for (const item of sale.items as any[]) {
        const costPrice: number = item.product?.costPrice ?? 0;
        benefice += (item.unitPrice - costPrice) * item.quantity;
      }
    }

    return {
      date:      start.toISOString().split('T')[0],
      totalCA,
      nbVentes,
      benefice,
      marge:     totalCA > 0 ? Math.round((benefice / totalCA) * 100) : 0,
    };
  }
}
