import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { BonLivraison, BonLivraisonDocument } from '../schemas/bon-livraison.schema';

interface BLLineInput {
  productId: string;
  qteAttendue?: number;
  qteRecue: number;
  datePeremption?: string;
  etatEmballage?: string;
}

@Injectable()
export class BonsLivraisonService {
  constructor(
    @InjectModel(Product.name)       private productModel:  Model<ProductDocument>,
    @InjectModel(StockMovement.name) private movementModel: Model<StockMovementDocument>,
    @InjectModel(BonLivraison.name)  private blModel:       Model<BonLivraisonDocument>,
  ) {}

  // ── POST /bons-livraison ──────────────────────────────────────────────────
  // Incrémente le stock caisse de chaque ligne reçue + trace le mouvement,
  // puis persiste le bon de livraison.

  async create(
    body: { numeroBL?: string; fournisseur: string; date?: string; lignes: BLLineInput[] },
    userId: string,
  ) {
    const validLines = (body.lignes ?? []).filter(l => l.productId && Number(l.qteRecue) > 0);

    const lignes: BonLivraisonDocument['lignes'] = [];
    let totalEcarts = 0;

    for (const l of validLines) {
      const qteRecue = Math.floor(Number(l.qteRecue));
      const product = await this.productModel.findByIdAndUpdate(
        l.productId,
        { $inc: { stock: qteRecue } },
        { new: true },
      );
      if (!product) throw new NotFoundException(`Produit introuvable : ${l.productId}`);

      await this.movementModel.create({
        productId: new Types.ObjectId(l.productId),
        type:      'IN',
        quantity:  qteRecue,
        reason:    'restock',
        note:      `BL ${body.numeroBL || '—'} · ${body.fournisseur}`,
      });

      const qteAttendue = Math.max(0, Math.floor(Number(l.qteAttendue) || 0));
      totalEcarts += qteRecue - qteAttendue;

      lignes.push({
        productId:      new Types.ObjectId(l.productId),
        productName:    product.name,
        unit:           product.unit,
        qteAttendue,
        qteRecue,
        datePeremption: l.datePeremption ?? '',
        etatEmballage:  l.etatEmballage ?? '',
      });
    }

    return this.blModel.create({
      numeroBL:    body.numeroBL || `BL-${Date.now().toString().slice(-6)}`,
      fournisseur: body.fournisseur,
      date:        body.date ?? '',
      lignes,
      totalEcarts,
      creePar:     new Types.ObjectId(userId),
    });
  }

  // ── GET /bons-livraison ───────────────────────────────────────────────────

  getAll() {
    return this.blModel
      .find()
      .populate('creePar', 'name role')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  }
}
