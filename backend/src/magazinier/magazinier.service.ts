import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { DemandeStock, DemandeStockDocument } from '../schemas/demande-stock.schema';
import { Reception, ReceptionDocument } from '../schemas/reception.schema';
import { Fournisseur, FournisseurDocument } from '../schemas/fournisseur.schema';

@Injectable()
export class MagazinierService {
  constructor(
    @InjectModel(Product.name)       private productModel:     Model<ProductDocument>,
    @InjectModel(StockMovement.name) private movementModel:    Model<StockMovementDocument>,
    @InjectModel(DemandeStock.name)  private demandeModel:     Model<DemandeStockDocument>,
    @InjectModel(Reception.name)     private receptionModel:   Model<ReceptionDocument>,
    @InjectModel(Fournisseur.name)   private fournisseurModel: Model<FournisseurDocument>,
  ) {}

  // Crée le fournisseur dans la table centrale s'il n'existe pas déjà
  // (comparaison insensible à la casse), pour qu'il apparaisse côté gestionnaire.
  private async ensureFournisseur(nom: string) {
    const name = nom.trim();
    if (!name) return;
    const exists = await this.fournisseurModel.exists({
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (!exists) await this.fournisseurModel.create({ name });
  }

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
        { $inc: { stockMagazin: item.quantity }, $set: { stockMagazinAjuste: false } },
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

    await this.ensureFournisseur(body.fournisseur);

    return this.receptionModel.create({
      fournisseur: body.fournisseur,
      items:       enriched,
      creePar:     new Types.ObjectId(userId),
      note:        body.note ?? '',
    });
  }

  // ── GET /magazinier/demandes ──────────────────────────────────────────────

  getDemandes(statut?: string) {
    const filter: Record<string, unknown> = statut ? { statut } : { statut: 'en_attente' };
    return this.demandeModel
      .find(filter)
      .populate('produit', 'name unit stock stockMagazin')
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

    // Décrémente le stock entrepôt quand les produits quittent physiquement le magazin
    await this.productModel.findByIdAndUpdate(
      demande.produit,
      { $inc: { stockMagazin: -demande.quantiteDemandee } },
    );

    demande.statut    = 'envoyé';
    demande.dateEnvoi = new Date();
    await demande.save();

    return this.demandeModel
      .findById(demandeId)
      .populate('produit', 'name unit stock stockMagazin')
      .populate('demandePar', 'name')
      .lean();
  }

  // ── PATCH /magazinier/produits/:id/stock-entrepot ─────────────────────────

  async ajusterStockEntrepot(productId: string, stockMagazin: number) {
    const product = await this.productModel.findByIdAndUpdate(
      productId,
      { $set: { stockMagazin: Math.max(0, stockMagazin), stockMagazinAjuste: true } },
      { new: true },
    );
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  // ── POST /magazinier/reset-entrepot ───────────────────────────────────────

  async resetEntrepot() {
    await this.productModel.updateMany({}, { $set: { stockMagazin: 0 } });
    await this.receptionModel.deleteMany({});
    return { ok: true };
  }

  // ── PATCH /magazinier/demandes/:id/recevoir ───────────────────────────────

  async marquerRecu(demandeId: string) {
    const demande = await this.demandeModel.findById(demandeId);
    if (!demande) throw new NotFoundException('Demande introuvable');
    if (demande.statut !== 'envoyé') throw new ForbiddenException('Demande non encore envoyée');

    // Envoi direct du magazinier : mise à jour automatique du stock caisse
    if (demande.type === 'envoi') {
      await this.productModel.findByIdAndUpdate(
        demande.produit,
        { $inc: { stock: demande.quantiteDemandee } },
      );
    }

    demande.statut = 'reçu';
    await demande.save();

    return this.demandeModel
      .findById(demandeId)
      .populate('produit', 'name unit stock stockMagazin')
      .populate('demandePar', 'name')
      .lean();
  }

  // ── POST /magazinier/envois ───────────────────────────────────────────────

  async createEnvoi(
    body: { items: { produitId: string; quantite: number }[] },
    userId: string,
  ) {
    const result = [];
    for (const item of body.items) {
      const product = await this.productModel.findById(item.produitId);
      if (!product) throw new NotFoundException(`Produit introuvable : ${item.produitId}`);

      await this.productModel.findByIdAndUpdate(
        item.produitId,
        { $inc: { stockMagazin: -item.quantite } },
      );

      const envoi = await this.demandeModel.create({
        produit:          new Types.ObjectId(item.produitId),
        quantiteDemandee: item.quantite,
        demandePar:       new Types.ObjectId(userId),
        statut:           'envoyé',
        type:             'envoi',
        dateEnvoi:        new Date(),
      });
      result.push(envoi);
    }
    return result;
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

  async getHistorique(userId: string, role?: string) {
    // Le patron (supervision) voit TOUT l'historique ; un magazinier voit le sien.
    const recFilter = role === 'patron' ? {} : { creePar: new Types.ObjectId(userId) };
    const [receptions, envois] = await Promise.all([
      this.receptionModel
        .find(recFilter)
        .populate('creePar', 'name role')
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
