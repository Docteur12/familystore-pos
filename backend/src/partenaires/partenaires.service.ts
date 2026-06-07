import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { Partenaire, PartenaireDocument } from '../schemas/partenaire.schema';
import { LivraisonPartenaire, LivraisonPartenaireDocument } from '../schemas/livraison-partenaire.schema';
import { PaiementPartenaire, PaiementPartenaireDocument } from '../schemas/paiement-partenaire.schema';
import { CommandePartenaire, CommandePartenaireDocument } from '../schemas/commande-partenaire.schema';
import { RetourPartenaire, RetourPartenaireDocument } from '../schemas/retour-partenaire.schema';

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
    @InjectModel(CommandePartenaire.name)  private cmdModel:       Model<CommandePartenaireDocument>,
    @InjectModel(RetourPartenaire.name)    private retourModel:    Model<RetourPartenaireDocument>,
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
    body: { numeroBL?: string; date?: string; montantPaye?: number; modePaiement?: string; lignes: LigneInput[] },
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
      numeroBL:     body.numeroBL || `BLP-${Date.now().toString().slice(-6)}`,
      partenaire:   new Types.ObjectId(partenaireId),
      lignes,
      total,
      montantPaye:  Math.max(0, Math.round(Number(body.montantPaye) || 0)),
      modePaiement: body.modePaiement || 'credit',
      date:         body.date ?? '',
      creePar:      new Types.ObjectId(userId),
    });
  }

  // ── Commandes (demande du grossiste) ───────────────────────────────────────
  getCommandes(statut?: string) {
    const filter = statut ? { statut } : {};
    return this.cmdModel
      .find(filter)
      .populate('partenaire', 'name phone lieu')
      .populate('creePar', 'name role')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
  }

  async createCommande(
    body: { partenaireId: string; modePaiement?: string; delai?: number; note?: string; lignes: LigneInput[] },
    userId: string,
  ) {
    const partenaire = await this.partModel.findById(body.partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');

    const lignes = [];
    for (const l of (body.lignes ?? []).filter(x => x.productId && Number(x.quantite) > 0)) {
      const product = await this.productModel.findById(l.productId).lean();
      if (!product) continue;
      lignes.push({
        productId:    new Types.ObjectId(l.productId),
        productName:  product.name,
        unit:         product.unit,
        quantite:     Math.floor(Number(l.quantite)),
        prixUnitaire: Math.max(0, Math.round(Number(l.prixUnitaire) || 0)),
      });
    }

    return this.cmdModel.create({
      numero:       `CMD-${Date.now().toString().slice(-6)}`,
      partenaire:   new Types.ObjectId(body.partenaireId),
      lignes,
      modePaiement: body.modePaiement || 'credit',
      delai:        Math.max(0, Math.floor(Number(body.delai) || 0)),
      note:         body.note ?? '',
      statut:       'recue',
      creePar:      new Types.ObjectId(userId),
    });
  }

  async updateCommande(id: string, dto: Partial<{ statut: string; note: string; delai: number }>) {
    const c = await this.cmdModel.findByIdAndUpdate(id, dto, { new: true });
    if (!c) throw new NotFoundException('Commande introuvable');
    return c;
  }

  async deleteCommande(id: string) {
    await this.cmdModel.findByIdAndDelete(id);
    return { ok: true };
  }

  // Génère le bon de livraison à partir d'une commande (sortie d'entrepôt).
  async genererLivraison(commandeId: string, userId: string, montantPaye = 0) {
    const cmd = await this.cmdModel.findById(commandeId);
    if (!cmd) throw new NotFoundException('Commande introuvable');
    if (cmd.livraison) throw new NotFoundException('Bon de livraison déjà généré pour cette commande');

    const livraison = await this.createLivraison(
      String(cmd.partenaire),
      {
        montantPaye,
        modePaiement: cmd.modePaiement,
        lignes: cmd.lignes.map(l => ({ productId: String(l.productId), quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
      },
      userId,
    );

    cmd.statut = 'livree';
    cmd.livraison = livraison._id as any;
    await cmd.save();
    return livraison;
  }

  // ── Retours d'invendus (dépôt-vente) → remis en stock entrepôt ──────────────
  async createRetour(partenaireId: string, body: { note?: string; lignes: LigneInput[] }, userId: string) {
    const partenaire = await this.partModel.findById(partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');

    const lignes = [];
    let total = 0;
    for (const l of (body.lignes ?? []).filter(x => x.productId && Number(x.quantite) > 0)) {
      const q = Math.floor(Number(l.quantite));
      const prix = Math.max(0, Math.round(Number(l.prixUnitaire) || 0));
      const product = await this.productModel.findByIdAndUpdate(
        l.productId,
        { $inc: { stockMagazin: q } },   // remis en entrepôt
        { new: true },
      );
      if (!product) continue;
      await this.movementModel.create({
        productId: new Types.ObjectId(l.productId),
        type:      'IN',
        quantity:  q,
        reason:    'retour_partenaire',
        note:      `Retour invendus · ${partenaire.name}`,
      });
      total += q * prix;
      lignes.push({ productId: new Types.ObjectId(l.productId), productName: product.name, quantite: q, prixUnitaire: prix });
    }

    return this.retourModel.create({
      partenaire: new Types.ObjectId(partenaireId),
      lignes, total, note: body.note ?? '',
      creePar: new Types.ObjectId(userId),
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

    const [livraisons, paiements, retours] = await Promise.all([
      this.livModel.find({ partenaire: new Types.ObjectId(partenaireId) }).sort({ createdAt: -1 }).lean(),
      this.paiementModel.find({ partenaire: new Types.ObjectId(partenaireId) }).populate('creePar', 'name role').sort({ createdAt: -1 }).lean(),
      this.retourModel.find({ partenaire: new Types.ObjectId(partenaireId) }).sort({ createdAt: -1 }).lean(),
    ]);

    const totalLivre     = livraisons.reduce((s, l) => s + (l.total ?? 0), 0);
    const payeLivraison  = livraisons.reduce((s, l) => s + (l.montantPaye ?? 0), 0);
    const totalPaiements = paiements.reduce((s, p) => s + (p.montant ?? 0), 0);
    const totalRetours   = retours.reduce((s, r) => s + (r.total ?? 0), 0);
    const solde          = Math.max(0, totalLivre - payeLivraison - totalPaiements - totalRetours);

    return { partenaire, livraisons, paiements, retours, totalLivre, payeLivraison, totalPaiements, totalRetours, solde };
  }

  // ── Tableau de bord ─────────────────────────────────────────────────────────
  async getStats() {
    const [partenaires, livraisons, paiements, retours] = await Promise.all([
      this.partModel.find().lean(),
      this.livModel.find().lean(),
      this.paiementModel.find().lean(),
      this.retourModel.find().lean(),
    ]);

    // Solde par partenaire (paye = payé à la livraison + paiements + retours d'invendus)
    const byPart = new Map<string, { name: string; livre: number; paye: number }>();
    for (const p of partenaires) byPart.set(String(p._id), { name: p.name, livre: 0, paye: 0 });
    for (const l of livraisons) {
      const e = byPart.get(String(l.partenaire));
      if (e) { e.livre += l.total ?? 0; e.paye += l.montantPaye ?? 0; }
    }
    for (const pa of paiements) {
      const e = byPart.get(String(pa.partenaire));
      if (e) e.paye += pa.montant ?? 0;
    }
    for (const r of retours) {
      const e = byPart.get(String(r.partenaire));
      if (e) e.paye += r.total ?? 0;
    }

    const soldes = [...byPart.entries()].map(([id, e]) => ({
      partenaireId: id, name: e.name, livre: e.livre, paye: e.paye, solde: Math.max(0, e.livre - e.paye),
    }));

    const totalLivre    = soldes.reduce((s, p) => s + p.livre, 0);
    const totalEncaisse = soldes.reduce((s, p) => s + p.paye, 0);
    const totalCreances = soldes.reduce((s, p) => s + p.solde, 0);
    const topDebiteurs  = [...soldes].filter(p => p.solde > 0).sort((a, b) => b.solde - a.solde).slice(0, 10);

    // Évolution sur 6 mois : livré vs encaissé
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const moisMap = new Map<string, { livre: number; encaisse: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      moisMap.set(ym(d), { livre: 0, encaisse: 0 });
    }
    for (const l of livraisons) {
      const k = ym(new Date((l as any).createdAt));
      const m = moisMap.get(k);
      if (m) { m.livre += l.total ?? 0; m.encaisse += l.montantPaye ?? 0; }
    }
    for (const pa of paiements) {
      const k = ym(new Date((pa as any).createdAt));
      const m = moisMap.get(k);
      if (m) m.encaisse += pa.montant ?? 0;
    }
    const MOIS = ['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    const evolution = [...moisMap.entries()].map(([k, v]) => {
      const [, mm] = k.split('-');
      return { mois: MOIS[parseInt(mm) - 1], livre: v.livre, encaisse: v.encaisse };
    });

    return {
      nbPartenaires: partenaires.length,
      totalLivre, totalEncaisse, totalCreances,
      topDebiteurs, evolution,
    };
  }
}
