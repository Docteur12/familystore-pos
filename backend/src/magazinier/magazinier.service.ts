import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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
    body: { fournisseur: string; items: { productId: string; quantity: number }[]; note?: string; idempotencyKey?: string },
    userId: string,
  ) {
    // Idempotence : si cette réception a déjà été enregistrée (rejeu de la
    // synchronisation hors-ligne), on la renvoie SANS ré-incrémenter le stock.
    if (body.idempotencyKey) {
      const existing = await this.receptionModel.findOne({ idempotencyKey: body.idempotencyKey }).lean();
      if (existing) return existing;
    }

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
      ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
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

    // Garde-fou : ne pas envoyer plus que le stock entrepôt (jamais de stock négatif)
    const prod = await this.productModel.findById(demande.produit).lean();
    if (prod && demande.quantiteDemandee > (prod.stockMagazin ?? 0)) {
      throw new BadRequestException(`Stock entrepôt insuffisant pour « ${prod.name} » : ${prod.stockMagazin ?? 0} en stock, ${demande.quantiteDemandee} demandé(s).`);
    }

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

  // ── PATCH /magazinier/demandes/:id/annuler ────────────────────────────────
  // Le gestionnaire (ou le magasinier) annule un envoi non encore reçu :
  // les quantités retournent dans le stock ENTREPÔT.
  async annulerEnvoi(demandeId: string) {
    const demande = await this.demandeModel.findById(demandeId);
    if (!demande) throw new NotFoundException('Envoi introuvable');
    if (demande.statut !== 'envoyé') throw new ForbiddenException("Seul un envoi en transit (non reçu) peut être annulé");

    // Restitution du stock entrepôt (il avait été décrémenté à l'envoi)
    await this.productModel.findByIdAndUpdate(
      demande.produit,
      { $inc: { stockMagazin: demande.quantiteDemandee } },
    );

    demande.statut = 'annulé';
    await demande.save();

    return this.demandeModel
      .findById(demandeId)
      .populate('produit', 'name unit stock stockMagazin')
      .populate('demandePar', 'name')
      .lean();
  }

  // ── POST /magazinier/retour-entrepot ──────────────────────────────────────
  // Le gestionnaire renvoie des produits de la BOUTIQUE vers l'ENTREPÔT
  // (invendus, surplus, erreur d'envoi…) : stock caisse −N, stock entrepôt +N.
  async retourEntrepot(body: { produitId: string; quantite: number }, userId: string) {
    const q = Math.floor(Number(body.quantite) || 0);
    if (q <= 0) throw new BadRequestException('Quantité invalide');

    const product = await this.productModel.findById(body.produitId);
    if (!product) throw new NotFoundException('Produit introuvable');
    if (product.stock < q) {
      throw new BadRequestException(`Stock boutique insuffisant pour « ${product.name} » : ${product.stock} en stock, ${q} à retourner.`);
    }

    await this.productModel.findByIdAndUpdate(
      body.produitId,
      { $inc: { stock: -q, stockMagazin: q } },
    );

    await this.movementModel.create({
      productId: new Types.ObjectId(body.produitId),
      type:      'OUT',
      quantity:  q,
      reason:    'retour_entrepot',
      note:      'Retour boutique → entrepôt',
    });

    // Trace visible dans l'historique du magasinier
    await this.demandeModel.create({
      produit:          new Types.ObjectId(body.produitId),
      quantiteDemandee: q,
      demandePar:       new Types.ObjectId(userId),
      statut:           'reçu',
      type:             'retour',
      dateEnvoi:        new Date(),
    });

    const updated = await this.productModel.findById(body.produitId).lean();
    return { ok: true, stock: updated?.stock ?? 0, stockMagazin: updated?.stockMagazin ?? 0 };
  }

  // ── PATCH /magazinier/demandes/:id/recevoir ───────────────────────────────

  async marquerRecu(demandeId: string) {
    const demande = await this.demandeModel.findById(demandeId);
    if (!demande) throw new NotFoundException('Demande introuvable');
    if (demande.statut !== 'envoyé') throw new ForbiddenException('Demande non encore envoyée');

    // Envoi direct du magasinier : mise à jour automatique du stock caisse
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
    const items = body?.items;
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('Aucun produit à envoyer.');

    // Pré-vérification (tout ou rien) : ne pas envoyer plus que le stock entrepôt
    for (const item of items) {
      const product = await this.productModel.findById(item.produitId).lean();
      if (!product) throw new NotFoundException(`Produit introuvable : ${item.produitId}`);
      if (Number(item.quantite) > (product.stockMagazin ?? 0)) {
        throw new BadRequestException(`Stock entrepôt insuffisant pour « ${product.name} » : ${product.stockMagazin ?? 0} en stock, ${item.quantite} demandé(s).`);
      }
    }

    const result = [];
    for (const item of items) {
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
    // Le patron (supervision) voit TOUT l'historique ; un magasinier voit le sien.
    const recFilter = role === 'patron' ? {} : { creePar: new Types.ObjectId(userId) };
    const [receptions, envois] = await Promise.all([
      this.receptionModel
        .find(recFilter)
        .populate('creePar', 'name role')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      this.demandeModel
        .find({ statut: { $in: ['envoyé', 'reçu', 'annulé'] } })
        .populate('produit', 'name unit')
        .populate('demandePar', 'name')
        .sort({ dateEnvoi: -1 })
        .limit(50)
        .lean(),
    ]);
    return { receptions, envois };
  }
}
