import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Fournisseur, FournisseurDocument } from '../schemas/fournisseur.schema';
import { Product, ProductDocument } from '../schemas/product.schema';
import { Sale, SaleDocument } from '../schemas/sale.schema';
import { VersementFournisseur, VersementFournisseurDocument } from '../schemas/versement-fournisseur.schema';
import { RetourFournisseur, RetourFournisseurDocument } from '../schemas/retour-fournisseur.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { StockSnapshot, StockSnapshotDocument } from '../schemas/stock-snapshot.schema';

type FournisseurData = {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  adresse?: string;
  conditionsPaiement?: string;
  remise?: string;
  note?: number;
  categories?: string[];
};

const DEFAULTS: FournisseurData[] = [
  { name: 'Import Maroc',      contact: 'Ahmed B.',    phone: '+212 6XX XXX XXX', email: 'import@maroc.ma',   adresse: 'Casablanca, Maroc',  conditionsPaiement: '30j',      remise: '5',  note: 4, categories: ['beauté', 'bien-être'] },
  { name: 'Soleco SA',         contact: 'Marie C.',    phone: '+237 6XX XXX XXX', email: 'soleco@cm.net',     adresse: 'Douala, Cameroun',   conditionsPaiement: 'comptant', remise: '3',  note: 5, categories: ['hygiène'] },
  { name: 'Import France',     contact: 'Pierre D.',   phone: '+33 6XX XXX XXX',  email: 'import@france.fr',  adresse: 'Paris, France',      conditionsPaiement: '60j',      remise: '8',  note: 3, categories: ['parfumerie'] },
  { name: 'Coop. Cameroun',    contact: 'Jean F.',     phone: '+237 6XX XXX XXX', email: 'coop@cameroun.cm',  adresse: 'Yaoundé, Cameroun',  conditionsPaiement: 'comptant', remise: '0',  note: 4, categories: ['épicerie'] },
  { name: 'Coop. Douala',      contact: 'Paul N.',     phone: '+237 6XX XXX XXX', email: 'coop@douala.cm',    adresse: 'Akwa, Douala',       conditionsPaiement: '30j',      remise: '2',  note: 4, categories: ['alimentation'] },
  { name: 'SABC',              contact: 'Responsable', phone: '+237 2XX XXX XXX', email: 'sabc@sabc.cm',      adresse: 'Bassa, Douala',      conditionsPaiement: '30j',      remise: '10', note: 5, categories: ['boissons'] },
  { name: 'Fournisseur Local', contact: 'N/A',         phone: '+237 6XX XXX XXX', email: '',                  adresse: 'Douala, Cameroun',   conditionsPaiement: 'comptant', remise: '0',  note: 2, categories: ['maison'] },
];

// Douala = UTC+1 (pas d'heure d'été) : clé du jour locale
const jourDouala = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);

@Injectable()
export class FournisseursService implements OnModuleInit {
  constructor(
    @InjectModel(Fournisseur.name)          private model:     Model<FournisseurDocument>,
    @InjectModel(Product.name)              private productModel: Model<ProductDocument>,
    @InjectModel(Sale.name)                 private saleModel: Model<SaleDocument>,
    @InjectModel(VersementFournisseur.name) private versModel: Model<VersementFournisseurDocument>,
    @InjectModel(RetourFournisseur.name)    private retourModel: Model<RetourFournisseurDocument>,
    @InjectModel(StockMovement.name)        private movementModel: Model<StockMovementDocument>,
    @InjectModel(StockSnapshot.name)        private snapModel: Model<StockSnapshotDocument>,
  ) {}

  // Photo quotidienne de la valeur du stock : au démarrage puis toutes les heures
  // (le serveur est réveillé chaque jour par le keep-alive → au moins 1 photo/jour).
  onModuleInit() {
    this.snapshotSiNecessaire().catch(() => {});
    setInterval(() => this.snapshotSiNecessaire().catch(() => {}), 3600_000).unref?.();
  }

  // ── Fiches fournisseurs (existant) ──────────────────────────────────────────

  async findAll() {
    const count = await this.model.estimatedDocumentCount();
    if (count === 0) await this.model.insertMany(DEFAULTS);
    return this.model.find().sort({ name: 1 });
  }

  async create(data: FournisseurData) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<FournisseurData>) {
    const f = await this.model.findByIdAndUpdate(id, data, { new: true });
    if (!f) throw new NotFoundException('Fournisseur introuvable');
    return f;
  }

  async remove(id: string) {
    const f = await this.model.findByIdAndDelete(id);
    if (!f) throw new NotFoundException('Fournisseur introuvable');
    return { deleted: true };
  }

  // ── Bornes de périodes calendaires ──────────────────────────────────────────

  private debutPeriode(periode: string): Date | null {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    switch (periode) {
      case 'semaine': {
        const d = new Date(now);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'mois':      return new Date(y, m, 1);
      case 'trimestre': return new Date(y, m - (m % 3), 1);
      case 'annee':     return new Date(y, 0, 1);
      default:          return null; // tout
    }
  }

  // Ventes groupées par fournisseur (CA au prix de vente + coût au prix d'achat)
  private ventesParFournisseur(depuis: Date | null): Promise<{ _id: string; caVendu: number; coutVendu: number; qteVendue: number }[]> {
    const pipeline: any[] = [
      { $addFields: { d: { $ifNull: ['$dateVente', '$createdAt'] } } },
      ...(depuis ? [{ $match: { d: { $gte: depuis } } }] : []),
      { $unwind: '$items' },
      { $match: { 'items.product': { $ne: null } } },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      {
        $group: {
          _id:       { $ifNull: ['$p.fournisseur', ''] },
          caVendu:   { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
          coutVendu: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$p.costPrice', 0] }] } },
          qteVendue: { $sum: '$items.quantity' },
        },
      },
    ];
    return this.saleModel.aggregate(pipeline);
  }

  private async sommesParFournisseur(model: Model<any>, champ: string, depuis: Date | null): Promise<Map<string, number>> {
    const pipeline: any[] = [
      ...(depuis ? [{ $match: { createdAt: { $gte: depuis } } }] : []),
      { $group: { _id: '$fournisseur', total: { $sum: `$${champ}` } } },
    ];
    const rows = await model.aggregate(pipeline);
    return new Map(rows.map((r: any) => [r._id ?? '', r.total ?? 0]));
  }

  // ── Évaluation des fournisseurs ────────────────────────────────────────────
  // Pour la période choisie : CA vendu, coût vendu (= à verser), qté, versements,
  // retours. La DETTE est toujours cumulée depuis le début :
  // coût vendu total − versé total (négatif = avance au fournisseur).
  async getEvaluation(periode = 'mois') {
    const debut = this.debutPeriode(periode);
    const [ventesP, ventesT, versP, versT, retP, fiches, nomsProduits] = await Promise.all([
      this.ventesParFournisseur(debut),
      debut ? this.ventesParFournisseur(null) : null,
      this.sommesParFournisseur(this.versModel, 'montant', debut),
      debut ? this.sommesParFournisseur(this.versModel, 'montant', null) : null,
      this.sommesParFournisseur(this.retourModel, 'total', debut),
      this.model.find().lean(),
      this.productModel.distinct('fournisseur'),
    ]);
    const ventesTotales = ventesT ?? ventesP;
    const versTotaux = versT ?? versP;

    const mapP = new Map(ventesP.map(v => [v._id ?? '', v]));
    const mapT = new Map(ventesTotales.map(v => [v._id ?? '', v]));

    const noms = new Set<string>();
    fiches.forEach(f => noms.add(f.name));
    (nomsProduits as string[]).forEach(n => { if (n) noms.add(n); });
    mapT.forEach((_, k) => { if (k) noms.add(k); });
    versTotaux.forEach((_, k) => { if (k) noms.add(k); });

    const rows = [...noms].map(nom => {
      const p = mapP.get(nom);
      const t = mapT.get(nom);
      const fiche = fiches.find(f => f.name === nom);
      return {
        fournisseur:  nom,
        phone:        fiche?.phone ?? '',
        contact:      fiche?.contact ?? '',
        caVendu:      p?.caVendu ?? 0,
        coutVendu:    p?.coutVendu ?? 0,       // = à verser pour la période
        qteVendue:    p?.qteVendue ?? 0,
        versements:   versP.get(nom) ?? 0,
        retours:      retP.get(nom) ?? 0,
        coutVenduTotal:  t?.coutVendu ?? 0,
        versementsTotal: versTotaux.get(nom) ?? 0,
        dette:        (t?.coutVendu ?? 0) - (versTotaux.get(nom) ?? 0),
      };
    }).sort((a, b) => b.caVendu - a.caVendu || b.dette - a.dette);

    // Produits vendus sans fournisseur renseigné (information)
    const sans = mapP.get('');
    return {
      periode,
      rows,
      sansFournisseur: sans ? { caVendu: sans.caVendu, coutVendu: sans.coutVendu, qteVendue: sans.qteVendue } : null,
      totaux: {
        caVendu:    rows.reduce((s, r) => s + r.caVendu, 0),
        coutVendu:  rows.reduce((s, r) => s + r.coutVendu, 0),
        versements: rows.reduce((s, r) => s + r.versements, 0),
        dette:      rows.reduce((s, r) => s + Math.max(0, r.dette), 0),
      },
    };
  }

  // ── Séries temporelles de ventes (par fournisseur OU par produit) ───────────
  // Agrégé par jour côté Mongo puis regroupé (semaine/mois/trimestre/année) ici.
  async getSerieVentes(opts: { fournisseur?: string; productId?: string; granularite?: string }) {
    const gran = opts.granularite ?? 'jour';
    const fenetres: Record<string, number> = { jour: 90, semaine: 364, mois: 730, trimestre: 1095, annee: 2190 };
    const depuis = new Date(Date.now() - (fenetres[gran] ?? 90) * 864e5);

    const filtreProduit: any[] = opts.productId
      ? [{ $match: { 'items.product': new Types.ObjectId(opts.productId) } }]
      : [
          { $match: { 'items.product': { $ne: null } } },
          { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
          { $unwind: '$p' },
          { $match: { 'p.fournisseur': opts.fournisseur ?? '' } },
        ];

    const parJour: { _id: string; ca: number; qte: number }[] = await this.saleModel.aggregate([
      { $addFields: { d: { $ifNull: ['$dateVente', '$createdAt'] } } },
      { $match: { d: { $gte: depuis } } },
      { $unwind: '$items' },
      ...filtreProduit,
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$d', timezone: '+01:00' } },
          ca:  { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
          qte: { $sum: '$items.quantity' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const MOIS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
    const cle = (iso: string): { key: string; label: string } => {
      const [y, m, j] = iso.split('-').map(Number);
      if (gran === 'jour')  return { key: iso, label: `${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}` };
      if (gran === 'mois')  return { key: iso.slice(0, 7), label: `${MOIS[m - 1]} ${y}` };
      if (gran === 'trimestre') { const q = Math.floor((m - 1) / 3) + 1; return { key: `${y}-T${q}`, label: `T${q} ${y}` }; }
      if (gran === 'annee') return { key: String(y), label: String(y) };
      // semaine : clé = lundi de la semaine
      const d = new Date(Date.UTC(y, m - 1, j));
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const lu = d.toISOString().slice(0, 10);
      return { key: lu, label: `Sem. ${lu.slice(8, 10)}/${lu.slice(5, 7)}` };
    };

    const groupes = new Map<string, { key: string; label: string; ca: number; qte: number }>();
    for (const r of parJour) {
      const { key, label } = cle(r._id);
      const g = groupes.get(key) ?? { key, label, ca: 0, qte: 0 };
      g.ca += r.ca; g.qte += r.qte;
      groupes.set(key, g);
    }
    return [...groupes.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  // ── Versements aux fournisseurs ─────────────────────────────────────────────

  async createVersement(body: { fournisseur: string; montant: number; note?: string; date?: string }, userId: string) {
    const nom = (body.fournisseur ?? '').trim();
    const montant = Math.round(Number(body.montant) || 0);
    if (!nom) throw new BadRequestException('Fournisseur requis');
    if (montant <= 0) throw new BadRequestException('Montant invalide');
    return this.versModel.create({
      fournisseur: nom, montant,
      note: body.note ?? '', date: body.date ?? jourDouala(),
      creePar: new Types.ObjectId(userId),
    });
  }

  getVersements(fournisseur?: string) {
    const filter = fournisseur ? { fournisseur } : {};
    return this.versModel.find(filter).populate('creePar', 'name role').sort({ createdAt: -1 }).limit(300).lean();
  }

  async deleteVersement(id: string) {
    const v = await this.versModel.findByIdAndDelete(id);
    if (!v) throw new NotFoundException('Versement introuvable');
    return { ok: true };
  }

  // ── Retours aux fournisseurs (sortie de stock tracée) ───────────────────────

  async createRetour(
    body: { fournisseur: string; note?: string; lignes: { productId: string; quantite: number; origine?: string }[] },
    userId: string,
  ) {
    const nom = (body.fournisseur ?? '').trim();
    if (!nom) throw new BadRequestException('Fournisseur requis');
    const valides = (body.lignes ?? []).filter(l => l.productId && Number(l.quantite) > 0);
    if (valides.length === 0) throw new BadRequestException('Ajoutez au moins un produit à retourner');

    const lignes: RetourFournisseurDocument['lignes'] = [] as any;
    let total = 0;
    for (const l of valides) {
      const q = Math.floor(Number(l.quantite));
      const origine = l.origine === 'boutique' ? 'boutique' : 'entrepot';
      const champ = origine === 'boutique' ? 'stock' : 'stockMagazin';
      const product = await this.productModel.findById(l.productId).lean();
      if (!product) throw new NotFoundException(`Produit introuvable : ${l.productId}`);
      const dispo = (product as any)[champ] ?? 0;
      if (q > dispo) {
        throw new BadRequestException(`Stock ${origine === 'boutique' ? 'boutique' : 'entrepôt'} insuffisant pour « ${product.name} » : ${dispo} disponible(s), ${q} demandé(s).`);
      }
      await this.productModel.findByIdAndUpdate(l.productId, { $inc: { [champ]: -q } });
      await this.movementModel.create({
        productId: new Types.ObjectId(l.productId), type: 'OUT', quantity: q,
        reason: 'retour_fournisseur', note: `Retour fournisseur ${nom} (${origine})`,
      });
      const prixAchat = product.costPrice ?? 0;
      total += q * prixAchat;
      lignes.push({
        productId: new Types.ObjectId(l.productId), productName: product.name,
        quantite: q, prixAchat, origine,
      } as any);
    }

    return this.retourModel.create({
      fournisseur: nom, lignes, total, note: body.note ?? '',
      creePar: new Types.ObjectId(userId),
    });
  }

  getRetours(fournisseur?: string) {
    const filter = fournisseur ? { fournisseur } : {};
    return this.retourModel.find(filter).populate('creePar', 'name role').sort({ createdAt: -1 }).limit(200).lean();
  }

  // Annulation d'un retour : les quantités reviennent dans le stock d'origine
  async deleteRetour(id: string) {
    const r = await this.retourModel.findById(id).lean();
    if (!r) throw new NotFoundException('Retour introuvable');
    for (const l of r.lignes ?? []) {
      const champ = l.origine === 'boutique' ? 'stock' : 'stockMagazin';
      await this.productModel.findByIdAndUpdate(l.productId, { $inc: { [champ]: l.quantite } });
      await this.movementModel.create({
        productId: l.productId, type: 'IN', quantity: l.quantite,
        reason: 'retour_fournisseur', note: `Annulation retour fournisseur ${r.fournisseur}`,
      });
    }
    await this.retourModel.findByIdAndDelete(id);
    return { ok: true };
  }

  // ── Évolution de la valeur du stock ────────────────────────────────────────

  async snapshotSiNecessaire() {
    const dateKey = jourDouala();
    const existe = await this.snapModel.findOne({ dateKey }).lean();
    if (existe) return existe;
    const prods = await this.productModel.find().lean();
    let aB = 0, aE = 0, vB = 0, vE = 0, qB = 0, qE = 0;
    for (const p of prods) {
      const s = p.stock ?? 0, sm = p.stockMagazin ?? 0, c = p.costPrice ?? 0, pr = p.price ?? 0;
      aB += s * c;  vB += s * pr;  qB += s;
      aE += sm * c; vE += sm * pr; qE += sm;
    }
    try {
      return await this.snapModel.create({
        dateKey,
        achatBoutique: aB, achatEntrepot: aE,
        venteBoutique: vB, venteEntrepot: vE,
        qteBoutique: qB, qteEntrepot: qE,
      });
    } catch { return this.snapModel.findOne({ dateKey }).lean(); } // course sur l'index unique
  }

  async getStockEvolution(jours = 90) {
    await this.snapshotSiNecessaire(); // garantit au moins le point du jour
    const depuis = new Date(Date.now() - jours * 864e5 + 3600_000).toISOString().slice(0, 10);
    return this.snapModel.find({ dateKey: { $gte: depuis } }).sort({ dateKey: 1 }).lean();
  }
}
