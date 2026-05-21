import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { DemandeStock, DemandeStockDocument } from '../schemas/demande-stock.schema';
import { Reception, ReceptionDocument } from '../schemas/reception.schema';

@Injectable()
export class MagazinierService {
  constructor(
    @InjectModel(Product.name)       private productModel:   Model<ProductDocument>,
    @InjectModel(StockMovement.name) private movementModel:  Model<StockMovementDocument>,
    @InjectModel(DemandeStock.name)  private demandeModel:   Model<DemandeStockDocument>,
    @InjectModel(Reception.name)     private receptionModel: Model<ReceptionDocument>,
  ) {}

  // ── POST /magazinier/receptions ───────────────────────────────────────────

  async createReception(
    body: { fournisseur: string; items: { productId: string; quantity: number }[]; note?: string },
    userId: string,
  ) {
    const enriched: { productId: Types.ObjectId; productName: string; quantity: number }[] = [];

    for (const item of body.items) {
      // ↓ Incrémente le stock ENTREPÔT (pas le stock caisse)
      const product = await this.productModel.findByIdAndUpdate(
        item.productId,
        { $inc: { stockMagazin: item.quantity } },
        { new: true },
      );
      if (!product) throw new NotFoundException(`Produit introuvable : ${item.productId}`);

      await this.movementModel.create({
        productId: new Types.ObjectId(item.productId),
        type:      'IN',
        quantity:  item.quantity,
        reason:    'reception',
        note:      `Fournisseur: ${body.fournisseur}`,
      });

      enriched.push({ productId: new Types.ObjectId(item.productId), productName: product.name, quantity: item.quantity });
    }

    return this.receptionModel.create({
      fournisseur: body.fournisseur,
      items:       enriched,
      creePar:     new Types.ObjectId(userId),
      note:        body.note ?? '',
    });
  }

  // ── GET /magazinier/demandes ──────────────────────────────────────────────

  getDemandes(statut?: string) {
    const filter = statut ? { statut } : { statut: 'en_attente' };
    return this.demandeModel
      .find(filter)
      .populate('produit', 'name unit stock')
      .populate('demandePar', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  // ── POST /magazinier/demandes (créé par le gestionnaire) ─────────────────

  async createDemande(body: { produitId: string; quantiteDemandee: number }, userId: string) {
    const product = await this.productModel.findById(body.produitId).lean();
    if (!product) throw new NotFoundException('Produit introuvable');

    return this.demandeModel.create({
      produit:          new Types.ObjectId(body.produitId),
      quantiteDemandee: body.quantiteDemandee,
      demandePar:       new Types.ObjectId(userId),
    });
  }

  // ── PATCH /magazinier/demandes/:id/envoyer ────────────────────────────────

  async marquerEnvoye(demandeId: string) {
    const demande = await this.demandeModel.findById(demandeId);
    if (!demande) throw new NotFoundException('Demande introuvable');
    if (demande.statut !== 'en_attente') throw new ForbiddenException('Demande déjà traitée');

    // Transfert entrepôt → caisse : stockMagazin ↓ / stock ↑
    await this.productModel.findByIdAndUpdate(demande.produit, {
      $inc: {
        stockMagazin: -demande.quantiteDemandee,  // sortie entrepôt
        stock:        +demande.quantiteDemandee,  // entrée caisse
      },
    });

    demande.statut    = 'envoyé';
    demande.dateEnvoi = new Date();
    await demande.save();

    return this.demandeModel
      .findById(demandeId)
      .populate('produit', 'name unit stock')
      .populate('demandePar', 'name')
      .lean();
  }

  // ── GET /magazinier/receptions (toutes, filtre optionnel) ────────────────

  getAllReceptions(userId?: string) {
    const filter = userId ? { creePar: new Types.ObjectId(userId) } : {};
    return this.receptionModel
      .find(filter)
      .populate('creePar', 'name role')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  }

  // ── GET /magazinier/historique ────────────────────────────────────────────

  async getHistorique(userId: string) {
    const [receptions, envois] = await Promise.all([
      this.receptionModel
        .find({ creePar: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      this.demandeModel
        .find({ statut: { $in: ['envoyé', 'reçu'] } })
        .populate('produit', 'name unit')
        .populate('demandePar', 'name')
        .sort({ dateEnvoi: -1 })
        .limit(50)
        .lean(),
    ]);
    return { receptions, envois };
  }
}
