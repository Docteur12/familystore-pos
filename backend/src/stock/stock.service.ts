import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { AddStockDto } from './dto/add-stock.dto';
import { RemoveStockDto } from './dto/remove-stock.dto';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,

    @InjectModel(StockMovement.name)
    private movementModel: Model<StockMovementDocument>,
  ) {}

  // ── Ajouter du stock (restock) ─────────────────────────────────────────────

  async addStock(dto: AddStockDto) {
    // Idempotence : si cet ajout a déjà été enregistré (rejeu de la
    // synchronisation hors-ligne), on ne ré-incrémente PAS le stock.
    if (dto.idempotencyKey) {
      const dejaFait = await this.movementModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
      if (dejaFait) {
        const product = await this.productModel.findById(dto.productId);
        if (!product) throw new NotFoundException('Produit introuvable');
        return { product, newStock: product.stock };
      }
    }

    const product = await this.productModel.findByIdAndUpdate(
      dto.productId,
      { $inc: { stock: dto.quantity } },
      { new: true },
    );
    if (!product) throw new NotFoundException('Produit introuvable');

    try {
      await this.movementModel.create({
        productId: new Types.ObjectId(dto.productId),
        type:      'IN',
        quantity:  dto.quantity,
        reason:    'restock',
        note:      dto.note,
        ...(dto.idempotencyKey ? { idempotencyKey: dto.idempotencyKey } : {}),
      });
    } catch (err: any) {
      // Course entre deux rejeux simultanés : l'index unique rejette le 2e —
      // on annule l'incrément fait en trop et on renvoie l'état actuel.
      if (dto.idempotencyKey && err?.code === 11000) {
        const corrige = await this.productModel.findByIdAndUpdate(
          dto.productId,
          { $inc: { stock: -dto.quantity } },
          { new: true },
        );
        return { product: corrige, newStock: corrige?.stock ?? 0 };
      }
      throw err;
    }

    return { product, newStock: product.stock };
  }

  // ── Retirer du stock (ajustement manuel) ──────────────────────────────────

  async removeStock(dto: RemoveStockDto) {
    const product = await this.productModel.findById(dto.productId);
    if (!product) throw new NotFoundException('Produit introuvable');

    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `Stock insuffisant : disponible ${product.stock}, demandé ${dto.quantity}`,
      );
    }

    const updated = await this.productModel.findByIdAndUpdate(
      dto.productId,
      { $inc: { stock: -dto.quantity } },
      { new: true },
    );

    await this.movementModel.create({
      productId: new Types.ObjectId(dto.productId),
      type:      'OUT',
      quantity:  dto.quantity,
      reason:    dto.reason,
      note:      dto.note,
    });

    return { product: updated, newStock: updated!.stock };
  }

  // ── Enregistrer un mouvement de vente (appelé par SalesService) ────────────

  async recordSaleMovement(productId: string, quantity: number) {
    await this.movementModel.create({
      productId: new Types.ObjectId(productId),
      type:      'OUT',
      quantity,
      reason:    'sale',
    });
  }

  // ── GET /stock/low ─────────────────────────────────────────────────────────

  getLowStock() {
    return this.productModel
      .find({ $expr: { $lte: ['$stock', '$alertThreshold'] } })
      .sort({ stock: 1 })
      .lean();
  }

  // ── GET /stock/movements ──────────────────────────────────────────────────

  getMovements(productId?: string) {
    const filter = productId ? { productId: new Types.ObjectId(productId) } : {};
    return this.movementModel
      .find(filter)
      .populate('productId', 'name barcode unit')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  }

  // ── GET /stock/:productId (stock actuel + mouvements récents) ─────────────

  async getProductStock(productId: string) {
    const product = await this.productModel.findById(productId).lean();
    if (!product) throw new NotFoundException('Produit introuvable');

    const movements = await this.movementModel
      .find({ productId: new Types.ObjectId(productId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return { product, movements };
  }
}
