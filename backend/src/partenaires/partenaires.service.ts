import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { Partenaire, PartenaireDocument } from '../schemas/partenaire.schema';
import { LivraisonPartenaire, LivraisonPartenaireDocument } from '../schemas/livraison-partenaire.schema';
import { PaiementPartenaire, PaiementPartenaireDocument } from '../schemas/paiement-partenaire.schema';
import { CommandePartenaire, CommandePartenaireDocument } from '../schemas/commande-partenaire.schema';
import { RetourPartenaire, RetourPartenaireDocument } from '../schemas/retour-partenaire.schema';
import { Agence, AgenceDocument } from '../schemas/agence.schema';

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
    @InjectModel(Agence.name)              private agenceModel:    Model<AgenceDocument>,
  ) {}

  private oid(id?: string | null) {
    return id ? new Types.ObjectId(id) : null;
  }

  // ── Partenaires ────────────────────────────────────────────────────────────
  getPartenaires() {
    return this.partModel.find().sort({ name: 1 }).lean();
  }

  createPartenaire(dto: { name: string; phone?: string; lieu?: string; ville?: string; quartier?: string; responsable?: string; email?: string; note?: string; type?: string }) {
    return this.partModel.create({
      name: dto.name.trim(),
      phone: dto.phone ?? '',
      lieu: dto.lieu ?? '',
      ville: dto.ville ?? '',
      quartier: dto.quartier ?? '',
      responsable: dto.responsable ?? '',
      email: dto.email ?? '',
      note: dto.note ?? '',
      type: dto.type === 'particulier' ? 'particulier' : 'structure',
    });
  }

  async updatePartenaire(id: string, dto: Partial<{ name: string; phone: string; lieu: string; ville: string; quartier: string; responsable: string; email: string; note: string; type: string; archivee: boolean }>) {
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
    body: { numeroBL?: string; date?: string; montantPaye?: number; modePaiement?: string; agenceId?: string | null; commandeId?: string | null; lignes: LigneInput[] },
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
      agence:       this.oid(body.agenceId),
      commande:     this.oid(body.commandeId),
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
    body: { partenaireId: string; agenceId?: string | null; modePaiement?: string; delai?: number; note?: string; lignes: LigneInput[] },
    userId: string,
  ) {
    const partenaire = await this.partModel.findById(body.partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');

    const lignes = [];
    for (const l of (body.lignes ?? []).filter(x => x.productId && Number(x.quantite) > 0)) {
      const product = await this.productModel.findById(l.productId).lean();
      if (!product) continue;
      lignes.push({
        productId:      new Types.ObjectId(l.productId),
        productName:    product.name,
        unit:           product.unit,
        quantite:       Math.floor(Number(l.quantite)),
        quantiteLivree: 0,
        prixUnitaire:   Math.max(0, Math.round(Number(l.prixUnitaire) || 0)),
      });
    }

    return this.cmdModel.create({
      numero:       `CMD-${Date.now().toString().slice(-6)}`,
      partenaire:   new Types.ObjectId(body.partenaireId),
      agence:       this.oid(body.agenceId),
      lignes,
      modePaiement: body.modePaiement || 'credit',
      delai:        Math.max(0, Math.floor(Number(body.delai) || 0)),
      note:         body.note ?? '',
      statut:       'recue',
      creePar:      new Types.ObjectId(userId),
    });
  }

  async updateCommande(
    id: string,
    dto: Partial<{ statut: string; note: string; delai: number; modePaiement: string; agenceId: string | null; lignes: LigneInput[] }>,
  ) {
    const cmd = await this.cmdModel.findById(id);
    if (!cmd) throw new NotFoundException('Commande introuvable');
    if (dto.note !== undefined) cmd.note = dto.note;
    if (dto.delai !== undefined) cmd.delai = Math.max(0, Math.floor(Number(dto.delai) || 0));
    if (dto.statut !== undefined) cmd.statut = dto.statut;
    if (dto.modePaiement !== undefined) cmd.modePaiement = dto.modePaiement;
    if (dto.agenceId !== undefined) cmd.agence = this.oid(dto.agenceId);

    // Modification des produits : autorisée seulement tant que rien n'est livré
    if (dto.lignes !== undefined) {
      if (cmd.statut !== 'recue') throw new BadRequestException('Commande déjà (partiellement) livrée : impossible de modifier les produits. Annulez-la plutôt.');
      const lignes = [];
      for (const l of (dto.lignes ?? []).filter(x => x.productId && Number(x.quantite) > 0)) {
        const product = await this.productModel.findById(l.productId).lean();
        if (!product) continue;
        lignes.push({
          productId: new Types.ObjectId(l.productId), productName: product.name, unit: product.unit,
          quantite: Math.floor(Number(l.quantite)), quantiteLivree: 0,
          prixUnitaire: Math.max(0, Math.round(Number(l.prixUnitaire) || 0)),
        });
      }
      cmd.lignes = lignes as any;
      cmd.markModified('lignes');
    }
    await cmd.save();
    return cmd;
  }

  // Supprime une commande. Si elle a des livraisons, elles sont ANNULÉES :
  // le stock entrepôt est restitué (mouvement IN) et la dette disparaît.
  async deleteCommande(id: string) {
    const cmd = await this.cmdModel.findById(id).lean();
    if (!cmd) return { ok: true, livraisonsAnnulees: 0, produitsRestitues: 0 };

    const livs = await this.livModel.find({ commande: new Types.ObjectId(id) }).lean();
    let produitsRestitues = 0;
    for (const liv of livs) {
      for (const l of liv.lignes ?? []) {
        const q = Math.floor(Number(l.quantite) || 0);
        if (q <= 0) continue;
        await this.productModel.findByIdAndUpdate(l.productId, { $inc: { stockMagazin: q } });
        await this.movementModel.create({
          productId: l.productId, type: 'IN', quantity: q, reason: 'retour_partenaire',
          note: `Annulation commande ${cmd.numero} · BL ${liv.numeroBL}`,
        });
        produitsRestitues += q;
      }
      await this.livModel.findByIdAndDelete(liv._id);
    }
    await this.cmdModel.findByIdAndDelete(id);
    return { ok: true, livraisonsAnnulees: livs.length, produitsRestitues };
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
  async createPaiement(partenaireId: string, body: { montant: number; note?: string; date?: string; agenceId?: string | null }, userId: string) {
    const partenaire = await this.partModel.findById(partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');
    return this.paiementModel.create({
      partenaire: new Types.ObjectId(partenaireId),
      agence:     this.oid(body.agenceId),
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

  // ════════════════════════════════════════════════════════════════════════════
  //  AGENCES (Phase 1 — additif)
  // ════════════════════════════════════════════════════════════════════════════

  getAgences(partenaireId?: string) {
    const filter = partenaireId ? { partenaire: new Types.ObjectId(partenaireId) } : {};
    return this.agenceModel.find(filter).sort({ nom: 1 }).lean();
  }

  async createAgence(body: { partenaireId: string; nom: string; ville?: string; quartier?: string; telephone?: string; responsable?: string; independante?: boolean }) {
    const partenaire = await this.partModel.findById(body.partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');
    return this.agenceModel.create({
      partenaire:   new Types.ObjectId(body.partenaireId),
      nom:          (body.nom ?? '').trim(),
      ville:        body.ville ?? '',
      quartier:     body.quartier ?? '',
      telephone:    body.telephone ?? '',
      responsable:  body.responsable ?? '',
      independante: !!body.independante,
      archivee:     false,
    });
  }

  async updateAgence(agenceId: string, dto: Partial<{ nom: string; ville: string; quartier: string; telephone: string; responsable: string; independante: boolean; archivee: boolean }>) {
    const a = await this.agenceModel.findByIdAndUpdate(agenceId, dto, { new: true });
    if (!a) throw new NotFoundException('Agence introuvable');
    return a;
  }

  // Suppression d'agence avec garde comptable :
  //  - si elle a un historique (commande/livraison/versement) → archivée (jamais effacée)
  //  - sinon → supprimée
  async deleteAgence(agenceId: string) {
    const a = await this.agenceModel.findById(agenceId);
    if (!a) throw new NotFoundException('Agence introuvable');
    const oid = new Types.ObjectId(agenceId);
    const [nbCmd, nbLiv, nbPaie] = await Promise.all([
      this.cmdModel.countDocuments({ agence: oid }),
      this.livModel.countDocuments({ agence: oid }),
      this.paiementModel.countDocuments({ agence: oid }),
    ]);
    if (nbCmd + nbLiv + nbPaie > 0) {
      a.archivee = true;
      await a.save();
      return { archived: true, deleted: false };
    }
    await this.agenceModel.findByIdAndDelete(agenceId);
    return { archived: false, deleted: true };
  }

  // ── Préparation / livraison par le magazinier (quantités réellement servies) ──
  // Crée un bon de livraison à partir d'une commande, avec les quantités servies
  // (≤ ou < commandées). Met à jour le cumul livré + le statut (reliquat ouvert).
  async preparerCommande(
    commandeId: string,
    body: { lignes: { productId: string; quantite: number; prixUnitaire?: number }[]; montantPaye?: number; date?: string; numeroBL?: string },
    userId: string,
  ) {
    const cmd = await this.cmdModel.findById(commandeId);
    if (!cmd) throw new NotFoundException('Commande introuvable');

    const servies = (body.lignes ?? []).filter(l => l.productId && Number(l.quantite) > 0);
    if (servies.length === 0) throw new NotFoundException('Aucune quantité à livrer');

    // Prix par défaut : celui de la ligne de commande si non fourni
    const lignesLiv = servies.map(l => {
      const ref = cmd.lignes.find(c => String(c.productId) === String(l.productId));
      return {
        productId:    l.productId,
        quantite:     Math.floor(Number(l.quantite)),
        prixUnitaire: l.prixUnitaire !== undefined ? Number(l.prixUnitaire) : (ref?.prixUnitaire ?? 0),
      };
    });

    // Garde-fou : impossible de servir plus que le stock entrepôt (le stock ne passe jamais en négatif)
    for (const l of lignesLiv) {
      const product = await this.productModel.findById(l.productId).lean();
      const dispo = product?.stockMagazin ?? 0;
      if (l.quantite > dispo) {
        throw new BadRequestException(`Stock entrepôt insuffisant pour « ${product?.name ?? 'produit'} » : ${dispo} en stock, ${l.quantite} demandé(s).`);
      }
    }

    // Réutilise createLivraison (sortie de stock + mouvements), en héritant l'agence de la commande
    const livraison = await this.createLivraison(
      String(cmd.partenaire),
      {
        montantPaye:  body.montantPaye,
        modePaiement: cmd.modePaiement,
        date:         body.date,
        numeroBL:     body.numeroBL,
        agenceId:     cmd.agence ? String(cmd.agence) : null,
        commandeId:   String(cmd._id),
        lignes:       lignesLiv,
      },
      userId,
    );

    // Met à jour le cumul livré sur chaque ligne de la commande
    for (const l of lignesLiv) {
      const ref = cmd.lignes.find(c => String(c.productId) === String(l.productId));
      if (ref) ref.quantiteLivree = Math.max(0, (ref.quantiteLivree ?? 0) + l.quantite);
    }

    // Statut : livree si tout servi, partielle si une partie reste, sinon inchangé
    const reste = cmd.lignes.reduce((s, c) => s + Math.max(0, (c.quantite ?? 0) - (c.quantiteLivree ?? 0)), 0);
    const dejaLivre = cmd.lignes.some(c => (c.quantiteLivree ?? 0) > 0);
    cmd.statut = reste === 0 ? 'livree' : (dejaLivre ? 'partielle' : 'recue');
    cmd.livraison = livraison._id as any;
    cmd.markModified('lignes');
    await cmd.save();

    return { livraison, commande: cmd.toObject() };
  }

  // ── Relevé avec ventilation par agence (dette par agence / commune / globale) ─
  async getCompteAgences(partenaireId: string) {
    const partenaire = await this.partModel.findById(partenaireId).lean();
    if (!partenaire) throw new NotFoundException('Partenaire introuvable');
    const pid = new Types.ObjectId(partenaireId);

    const [agences, livraisons, paiements, retours, commandes] = await Promise.all([
      this.agenceModel.find({ partenaire: pid }).sort({ nom: 1 }).lean(),
      this.livModel.find({ partenaire: pid }).sort({ createdAt: -1 }).lean(),
      this.paiementModel.find({ partenaire: pid }).populate('creePar', 'name role').sort({ createdAt: -1 }).lean(),
      this.retourModel.find({ partenaire: pid }).sort({ createdAt: -1 }).lean(),
      this.cmdModel.find({ partenaire: pid }).sort({ createdAt: -1 }).lean(),
    ]);

    const indepIds = new Set(agences.filter(a => a.independante).map(a => String(a._id)));
    const isIndep  = (agenceId: any) => !!agenceId && indepIds.has(String(agenceId));

    // Détail par agence
    const detailAgences = agences.map(a => {
      const aid = String(a._id);
      const livre = livraisons.filter(l => String(l.agence) === aid).reduce((s, l) => s + (l.total ?? 0), 0);
      const paye  = livraisons.filter(l => String(l.agence) === aid).reduce((s, l) => s + (l.montantPaye ?? 0), 0);
      const verse = paiements.filter(p => String(p.agence) === aid).reduce((s, p) => s + (p.montant ?? 0), 0);
      const cmds  = commandes.filter(c => String(c.agence) === aid);
      const qteCommandee = cmds.reduce((s, c) => s + c.lignes.reduce((ss, l) => ss + (l.quantite ?? 0), 0), 0);
      const qteLivree    = cmds.reduce((s, c) => s + c.lignes.reduce((ss, l) => ss + (l.quantiteLivree ?? 0), 0), 0);
      return {
        _id: aid, nom: a.nom, ville: a.ville, telephone: a.telephone, responsable: a.responsable,
        independante: !!a.independante, archivee: !!a.archivee,
        livre, paye, verse, qteCommandee, qteLivree,
        solde: Math.max(0, livre - paye - verse),
      };
    });

    // Dette commune (livré non-indépendant − payé − versements communs − retours)
    const livreCommun = livraisons.filter(l => !isIndep(l.agence)).reduce((s, l) => s + (l.total ?? 0), 0);
    const payeCommun  = livraisons.filter(l => !isIndep(l.agence)).reduce((s, l) => s + (l.montantPaye ?? 0), 0);
    const verseCommun = paiements.filter(p => !isIndep(p.agence)).reduce((s, p) => s + (p.montant ?? 0), 0);
    const totalRetours = retours.reduce((s, r) => s + (r.total ?? 0), 0);
    const detteCommune = Math.max(0, livreCommun - payeCommun - verseCommun - totalRetours);

    // Totaux globaux
    const totalLivre     = livraisons.reduce((s, l) => s + (l.total ?? 0), 0);
    const payeLivraison  = livraisons.reduce((s, l) => s + (l.montantPaye ?? 0), 0);
    const totalPaiements = paiements.reduce((s, p) => s + (p.montant ?? 0), 0);
    const soldeGlobal    = Math.max(0, totalLivre - payeLivraison - totalPaiements - totalRetours);
    const detteAgences   = detailAgences.filter(a => a.independante).reduce((s, a) => s + a.solde, 0);

    return {
      partenaire, agences: detailAgences, livraisons, paiements, retours, commandes,
      detteCommune, detteAgences, soldeGlobal,
      totalLivre, payeLivraison, totalPaiements, totalRetours,
    };
  }

  // ── Tableau de bord par agence (débiteurs : agences indépendantes + communs) ──
  async getStatsAgences() {
    const [partenaires, agences, livraisons, paiements, retours] = await Promise.all([
      this.partModel.find().lean(),
      this.agenceModel.find().lean(),
      this.livModel.find().lean(),
      this.paiementModel.find().lean(),
      this.retourModel.find().lean(),
    ]);

    const agencesById = new Map(agences.map(a => [String(a._id), a]));
    const indepIds = new Set(agences.filter(a => a.independante).map(a => String(a._id)));
    const isIndep = (agenceId: any) => !!agenceId && indepIds.has(String(agenceId));

    const debiteurs: { partenaireId: string; name: string; agenceId: string | null; agenceNom: string; sub: string; solde: number }[] = [];
    let nbAgences = 0;

    for (const p of partenaires) {
      const pid = String(p._id);
      const sesAgences = agences.filter(a => String(a.partenaire) === pid);
      nbAgences += sesAgences.length;

      // Une ligne par agence indépendante
      for (const a of sesAgences.filter(x => x.independante)) {
        const aid = String(a._id);
        const livre = livraisons.filter(l => String(l.agence) === aid).reduce((s, l) => s + (l.total ?? 0), 0);
        const paye  = livraisons.filter(l => String(l.agence) === aid).reduce((s, l) => s + (l.montantPaye ?? 0), 0);
        const verse = paiements.filter(x => String(x.agence) === aid).reduce((s, x) => s + (x.montant ?? 0), 0);
        const solde = Math.max(0, livre - paye - verse);
        if (solde > 0) debiteurs.push({ partenaireId: pid, name: p.name, agenceId: aid, agenceNom: a.nom, sub: `${a.nom}${a.ville ? ' · ' + a.ville : ''}`, solde });
      }

      // Une ligne « dette commune » par partenaire
      const livL = livraisons.filter(l => String(l.partenaire) === pid && !isIndep(l.agence));
      const paieL = paiements.filter(x => String(x.partenaire) === pid && !isIndep(x.agence));
      const retL = retours.filter(r => String(r.partenaire) === pid);
      const livreC = livL.reduce((s, l) => s + (l.total ?? 0), 0);
      const payeC  = livL.reduce((s, l) => s + (l.montantPaye ?? 0), 0);
      const verseC = paieL.reduce((s, x) => s + (x.montant ?? 0), 0);
      const retC   = retL.reduce((s, r) => s + (r.total ?? 0), 0);
      const detteC = Math.max(0, livreC - payeC - verseC - retC);
      if (detteC > 0) {
        const aIndep = sesAgences.some(x => x.independante);
        debiteurs.push({ partenaireId: pid, name: p.name, agenceId: null, agenceNom: '', sub: sesAgences.length ? (aIndep ? 'Dette commune (autres agences)' : 'Dette commune') : (p.type === 'particulier' ? 'Particulier' : 'Dette globale'), solde: detteC });
      }
    }

    debiteurs.sort((a, b) => b.solde - a.solde);
    const totalCreances = debiteurs.reduce((s, d) => s + d.solde, 0);
    const totalLivre = livraisons.reduce((s, l) => s + (l.total ?? 0), 0);

    return {
      nbPartenaires: partenaires.length,
      nbAgences,
      totalLivre,
      totalCreances,
      debiteurs: debiteurs.slice(0, 20),
    };
  }

  // ── Historique global : livraisons + versements + retours, triés par date ─────
  async getOperations() {
    const [livs, paies, rets] = await Promise.all([
      this.livModel.find().populate('partenaire', 'name').populate('agence', 'nom ville').sort({ createdAt: -1 }).limit(150).lean(),
      this.paiementModel.find().populate('partenaire', 'name').populate('agence', 'nom ville').sort({ createdAt: -1 }).limit(150).lean(),
      this.retourModel.find().populate('partenaire', 'name').sort({ createdAt: -1 }).limit(60).lean(),
    ]);

    const nomAgence = (a: any) => a ? `${a.nom}${a.ville ? ' · ' + a.ville : ''}` : '';
    const ops: any[] = [];
    for (const l of livs) ops.push({
      type: 'livraison', date: (l as any).createdAt,
      partenaire: (l.partenaire as any)?.name ?? '—', agence: nomAgence(l.agence),
      montant: l.total ?? 0, ref: l.numeroBL,
      lignes: (l.lignes ?? []).map((x: any) => ({ productName: x.productName, quantite: x.quantite })),
    });
    for (const p of paies) ops.push({
      type: 'versement', date: (p as any).createdAt,
      partenaire: (p.partenaire as any)?.name ?? '—', agence: nomAgence(p.agence),
      montant: p.montant ?? 0, note: p.note ?? '',
    });
    for (const r of rets) ops.push({
      type: 'retour', date: (r as any).createdAt,
      partenaire: (r.partenaire as any)?.name ?? '—', agence: '',
      montant: r.total ?? 0,
    });

    ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return ops.slice(0, 200);
  }
}
