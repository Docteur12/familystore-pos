import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { Partenaire, PartenaireDocument } from '../schemas/partenaire.schema';
import { LivraisonPartenaire, LivraisonPartenaireDocument } from '../schemas/livraison-partenaire.schema';
import { PaiementPartenaire, PaiementPartenaireDocument } from '../schemas/paiement-partenaire.schema';

interface LigneInput {
  productId: string;
  quantite: number;
  prixUnitaire: number;
}

@Injectable()
export class PartenairesService {
  constructor(
    @InjectModel(Product.name)             private productModel:   Model<ProductDocument>,
    @InjectModel(StockMovement.name)       private movementModel:  Model<StockMovementDocument>,
    @InjectModel(Partenaire.name)          private partModel:      Model<PartenaireDocument>,
    @InjectModel(LivraisonPartenaire.name) private livModel:       Model<LivraisonPartenaireDocument>,
    @InjectModel(PaiementPartenaire.name)  private paiementModel:  Model<PaiementPartenaireDocument>,
  ) {}

  // ── Partenaires ────────────────────────────────────────────────────────────
  getPartenaires() {
    return this.partModel.find().sort({ name: 1 }).lean();
  }

  createPartenaire(dto: { name: string; phone?: string; lieu?: string; note?: string }) {
    return this.partModel.create({
      name: dto.name.trim(),
      phone: dto.phone ?? '',
      lieu: dto.lieu ?? '',
      note: dto.note ?? '',
    });
  }

  async updatePartenaire(id: string, dto: Partial<{ name: string; phone: string; lieu: string; note: string }>) {
    const p = await this.partModel.findByIdAndUpdate(id, dto, { new: true });
    if (!p) throw new NotFoundException('Partenaire introuvable');
    return p;
  }

  async deletePartenaire(id: string) {
    await this.partModel.findByIdAndDelete(id);
    return { ok: true };
  }

  // ── Livraisons (bons de livraison vers partenaire) ─────────────────────────
  getLivraisons(partenaireId?: string) {
    const filter = partenaireId ? { partenaire: new Types.ObjectId(partenaireId) } : {};
    return this.livModel
      .find(filter)
      .populate('partenaire', 'name phone lieu')
      .populate('creePar', 'name role')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
  }

  // Dernier prix pratiqué par produit pour ce partenaire (rappel à la saisie)
  async getDernierPrix(partenaireId: string) {
    const livs = await this.livModel
      .find({ partenaire: new Types.ObjectId(partenaireId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const map: Record<string, number> = {};
    for (const liv of livs) {
      for (const lg of liv.lignes ?? []) {
        const pid = String(lg.productId);
        if (map[pid] === undefined) map[pid] = lg.prixUnitaire;
      }
    }
    return map;
  }

  async createLivraison(
    partenaireId: string,
    body: { numeroBL?: string; date?: string; montantPaye?: number; lignes: LigneInput[] },
    userId: string,
  ) {
    const partenaire = await this.partModel.findById(partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');

    const valid = (body.lignes ?? []).filter(l => l.productId && Number(l.quantite) > 0);
    const lignes: LivraisonPartenaireDocument['lignes'] = [];
    let total = 0;

    for (const l of valid) {
      const q    = Math.floor(Number(l.quantite));
      const prix = Math.max(0, Math.round(Number(l.prixUnitaire) || 0));

      // Sortie de stock entrepôt
      const product = await this.productModel.findByIdAndUpdate(
        l.productId,
        { $inc: { stockMagazin: -q } },
        { new: true },
      );
      if (!product) throw new NotFoundException(`Produit introuvable : ${l.productId}`);

      await this.movementModel.create({
        productId: new Types.ObjectId(l.productId),
        type:      'OUT',
        quantity:  q,
        reason:    'livraison_partenaire',
        note:      `BL ${body.numeroBL || '—'} · ${partenaire.name}`,
      });

      total += q * prix;
      lignes.push({
        productId:    new Types.ObjectId(l.productId),
        productName:  product.name,
        unit:         product.unit,
        quantite:     q,
        prixUnitaire: prix,
      });
    }

    return this.livModel.create({
      numeroBL:    body.numeroBL || `BLP-${Date.now().toString().slice(-6)}`,
      partenaire:  new Types.ObjectId(partenaireId),
      lignes,
      total,
      montantPaye: Math.max(0, Math.round(Number(body.montantPaye) || 0)),
      date:        body.date ?? '',
      creePar:     new Types.ObjectId(userId),
    });
  }

  // ── Paiements & relevé de compte ───────────────────────────────────────────
  async createPaiement(partenaireId: string, body: { montant: number; note?: string; date?: string }, userId: string) {
    const partenaire = await this.partModel.findById(partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');
    return this.paiementModel.create({
      partenaire: new Types.ObjectId(partenaireId),
      montant:    Math.max(0, Math.round(Number(body.montant) || 0)),
      note:       body.note ?? '',
      date:       body.date ?? '',
      creePar:    new Types.ObjectId(userId),
    });
  }

  // Relevé d'un partenaire : livraisons + paiements + solde dû.
  async getCompte(partenaireId: string) {
    const partenaire = await this.partModel.findById(partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');

    const [livraisons, paiements] = await Promise.all([
      this.livModel.find({ partenaire: new Types.ObjectId(partenaireId) }).sort({ createdAt: -1 }).lean(),
      this.paiementModel.find({ partenaire: new Types.ObjectId(partenaireId) }).populate('creePar', 'name role').sort({ createdAt: -1 }).lean(),
    ]);

    const totalLivre     = livraisons.reduce((s, l) => s + (l.total ?? 0), 0);
    const payeLivraison  = livraisons.reduce((s, l) => s + (l.montantPaye ?? 0), 0);
    const totalPaiements = paiements.reduce((s, p) => s + (p.montant ?? 0), 0);
    const solde          = Math.max(0, totalLivre - payeLivraison - totalPaiements);

    return { partenaire, livraisons, paiements, totalLivre, payeLivraison, totalPaiements, solde };
  }
}
