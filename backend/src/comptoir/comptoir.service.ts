import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { StockMovement, StockMovementDocument } from '../schemas/stock-movement.schema';
import { Expense, ExpenseDocument } from '../schemas/expense.schema';
import { Sale, SaleDocument } from '../schemas/sale.schema';
import { ConditionnementSnack, ConditionnementSnackDocument } from './schemas/conditionnement-snack.schema';
import { MouvementConsigne, MouvementConsigneDocument } from './schemas/mouvement-consigne.schema';
import { ReceptionCasier, ReceptionCasierDocument } from './schemas/reception-casier.schema';
import { CasseDto, DefinirConditionnementDto, ReceptionCasiersDto, RetourVidesDto } from './dto/comptoir.dto';
import {
  CATEGORIE_DEPENSE_CONSIGNE, MOTIF_CASSE, MOTIF_RECEPTION_CASIER, PREFIXE_LIGNE_CONSIGNE,
} from './motifs';
import { nomProduit } from '../common/nom-produit';

/** Qui agit — extrait du jeton par le contrôleur. */
export interface Acteur { name?: string; email?: string; role?: string }

/** Une ligne de l'état de la réserve. */
export interface LigneReserve {
  productId:            string;
  nomProduit:           string;
  unit:                 string;
  category:             string;
  stock:                number;   // bouteilles pleines (Product.stock)
  bouteillesParCasier:  number;
  casiersPleins:        number;   // ⌊stock / contenance⌋
  bouteillesSeules:     number;   // stock mod contenance
  consigne:             number;
  videsEnReserve:       number;   // bouteilles vides détenues
  casiersVidesARendre:  number;   // ⌊vides / contenance⌋
  videsSeuls:           number;   // vides mod contenance
  alertThreshold:       number;
}

/** Conversion casiers ↔ bouteilles, isolée pour être testée seule. */
export function casiersEtBouteilles(bouteilles: number, parCasier: number): { casiers: number; seules: number } {
  if (parCasier <= 0) return { casiers: 0, seules: Math.max(0, bouteilles) };
  const b = Math.max(0, bouteilles);
  return { casiers: Math.floor(b / parCasier), seules: b % parCasier };
}

/** Bornes [début, fin[ d'un jour civil, à partir de « AAAA-MM-JJ » (défaut : aujourd'hui). */
export function bornesDuJour(date?: string): { debut: Date; fin: Date } {
  const base = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : new Date();
  if (isNaN(base.getTime())) throw new BadRequestException('Date invalide (attendu AAAA-MM-JJ)');
  const debut = new Date(base); debut.setHours(0, 0, 0, 0);
  const fin   = new Date(debut); fin.setDate(fin.getDate() + 1);
  return { debut, fin };
}

@Injectable()
export class ComptoirService {
  constructor(
    @InjectModel(ConditionnementSnack.name) private condModel:      Model<ConditionnementSnackDocument>,
    @InjectModel(MouvementConsigne.name)    private consigneModel:  Model<MouvementConsigneDocument>,
    @InjectModel(ReceptionCasier.name)      private receptionModel: Model<ReceptionCasierDocument>,
    @InjectModel(Product.name)              private productModel:   Model<ProductDocument>,
    @InjectModel(StockMovement.name)        private movementModel:  Model<StockMovementDocument>,
    @InjectModel(Expense.name)              private expenseModel:   Model<ExpenseDocument>,
    @InjectModel(Sale.name)                 private saleModel:      Model<SaleDocument>,
  ) {}

  // ── Conditionnements ──────────────────────────────────────────────────────

  listerConditionnements() {
    return this.condModel.find().sort({ createdAt: 1 }).lean();
  }

  async definirConditionnement(productId: string, dto: DefinirConditionnementDto) {
    if (!Types.ObjectId.isValid(productId)) throw new BadRequestException('Identifiant de produit invalide');
    const produit = await this.productModel.findById(productId).lean();
    if (!produit) throw new NotFoundException('Produit introuvable');
    return this.condModel.findOneAndUpdate(
      { product: new Types.ObjectId(productId) },
      { $set: { bouteillesParCasier: dto.bouteillesParCasier, consigne: dto.consigne },
        $setOnInsert: { videsEnReserve: 0 } },
      { new: true, upsert: true },
    ).lean();
  }

  private async conditionnementDe(productId: string) {
    const cond = await this.condModel.findOne({ product: new Types.ObjectId(productId) });
    if (!cond) {
      throw new BadRequestException(
        "Conditionnement non défini pour ce produit : indiquez d'abord le nombre de bouteilles par casier",
      );
    }
    return cond;
  }

  // ── Réserve ───────────────────────────────────────────────────────────────

  async etatReserve(): Promise<LigneReserve[]> {
    const conds = await this.condModel.find().lean();
    if (conds.length === 0) return [];
    const produits = await this.productModel
      .find({ _id: { $in: conds.map(c => c.product) } })
      .lean();
    const parId = new Map(produits.map(p => [String(p._id), p]));
    const lignes: LigneReserve[] = [];
    for (const c of conds) {
      const p = parId.get(String(c.product));
      if (!p) continue;   // produit supprimé : la ligne disparaît
      const pleins = casiersEtBouteilles(p.stock, c.bouteillesParCasier);
      const vides  = casiersEtBouteilles(c.videsEnReserve, c.bouteillesParCasier);
      lignes.push({
        productId:           String(p._id),
        nomProduit:          nomProduit(p.name),
        unit:                p.unit ?? '',
        category:            p.category ?? '',
        stock:               p.stock,
        bouteillesParCasier: c.bouteillesParCasier,
        casiersPleins:       pleins.casiers,
        bouteillesSeules:    pleins.seules,
        consigne:            c.consigne,
        videsEnReserve:      c.videsEnReserve,
        casiersVidesARendre: vides.casiers,
        videsSeuls:          vides.seules,
        alertThreshold:      p.alertThreshold ?? 0,
      });
    }
    return lignes.sort((a, b) => a.nomProduit.localeCompare(b.nomProduit, 'fr'));
  }

  async receptionnerCasiers(dto: ReceptionCasiersDto, acteur?: Acteur) {
    if (dto.idempotencyKey) {
      const deja = await this.receptionModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
      if (deja) return { reception: deja, rejeu: true };
    }
    const cond = await this.conditionnementDe(dto.productId);
    const produit = await this.productModel.findById(dto.productId);
    if (!produit) throw new NotFoundException('Produit introuvable');

    const videsRendus = dto.videsRendus ?? 0;
    if (videsRendus > cond.videsEnReserve) {
      throw new BadRequestException(
        `Vides rendus (${videsRendus}) supérieurs aux vides en réserve (${cond.videsEnReserve})`,
      );
    }
    const bouteilles = dto.casiers * cond.bouteillesParCasier;

    // La réception est créée EN PREMIER : si sa clé est déjà prise (course
    // entre deux requêtes), l'index unique la rejette avant tout mouvement.
    let reception: ReceptionCasierDocument;
    try {
      reception = await this.receptionModel.create({
        product:             produit._id,
        nomProduit:          nomProduit(produit.name),
        casiers:             dto.casiers,
        bouteillesParCasier: cond.bouteillesParCasier,
        bouteilles,
        videsRendus,
        note:                dto.note ?? '',
        auteurNom:           acteur?.name  ?? '',
        auteurEmail:         acteur?.email ?? '',
        idempotencyKey:      dto.idempotencyKey,
      });
    } catch (err: any) {
      if (dto.idempotencyKey && err?.code === 11000) {
        const deja = await this.receptionModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
        if (deja) return { reception: deja, rejeu: true };
      }
      throw err;
    }

    const majProduit = await this.productModel.findByIdAndUpdate(
      produit._id, { $inc: { stock: bouteilles } }, { new: true },
    );
    await this.movementModel.create({
      productId: produit._id,
      type:      'IN',
      quantity:  bouteilles,
      reason:    MOTIF_RECEPTION_CASIER,
      note:      `Réception ${dto.casiers} casier(s) × ${cond.bouteillesParCasier} = ${bouteilles} bouteilles`
                 + (dto.note ? ` — ${dto.note}` : ''),
    });
    if (videsRendus > 0) {
      cond.videsEnReserve -= videsRendus;
      await cond.save();
    }
    return { reception: reception.toObject(), rejeu: false, stock: majProduit?.stock ?? produit.stock + bouteilles, videsEnReserve: cond.videsEnReserve };
  }

  listerReceptions(limit = 100) {
    return this.receptionModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  }

  async declarerCasse(dto: CasseDto, acteur?: Acteur) {
    if (dto.idempotencyKey) {
      const deja = await this.movementModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
      if (deja) return { mouvement: deja, rejeu: true };
    }
    const produit = await this.productModel.findById(dto.productId);
    if (!produit) throw new NotFoundException('Produit introuvable');
    if (produit.stock < dto.bouteilles) {
      throw new BadRequestException(
        `Stock insuffisant : disponible ${produit.stock}, demandé ${dto.bouteilles}`,
      );
    }
    let mouvement: StockMovementDocument;
    try {
      mouvement = await this.movementModel.create({
        productId:      produit._id,
        type:           'OUT',
        quantity:       dto.bouteilles,
        reason:         MOTIF_CASSE,
        note:           `Casse${dto.note ? ` — ${dto.note}` : ''}${acteur?.name ? ` (${acteur.name})` : ''}`,
        idempotencyKey: dto.idempotencyKey,
      });
    } catch (err: any) {
      if (dto.idempotencyKey && err?.code === 11000) {
        const deja = await this.movementModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
        if (deja) return { mouvement: deja, rejeu: true };
      }
      throw err;
    }
    const maj = await this.productModel.findByIdAndUpdate(
      produit._id, { $inc: { stock: -dto.bouteilles } }, { new: true },
    );
    return { mouvement: mouvement.toObject(), rejeu: false, stock: maj?.stock ?? produit.stock - dto.bouteilles };
  }

  // ── Consignes ─────────────────────────────────────────────────────────────

  /**
   * Retour de vide : le client rapporte N bouteilles, on lui rembourse la
   * consigne. Une DÉPENSE est créée (la caisse du soir reste juste), un
   * mouvement `rendue` la référence, et les vides rejoignent la réserve.
   */
  async retournerVides(dto: RetourVidesDto, acteur?: Acteur) {
    if (dto.idempotencyKey) {
      const deja = await this.consigneModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
      if (deja) return { mouvement: deja, montant: deja.montant, rejeu: true };
    }
    const cond = await this.condModel.findOne({ product: new Types.ObjectId(dto.productId) });
    if (!cond || cond.consigne <= 0) {
      throw new BadRequestException("Ce produit n'a pas de consigne");
    }
    const produit = await this.productModel.findById(dto.productId).lean();
    if (!produit) throw new NotFoundException('Produit introuvable');

    const nom     = nomProduit(produit.name);
    const montant = dto.quantite * cond.consigne;

    // Le mouvement d'abord (porteur de la clé d'idempotence) ; la dépense et
    // le compteur de vides ne suivent que s'il a été accepté.
    let mouvement: MouvementConsigneDocument;
    try {
      mouvement = await this.consigneModel.create({
        sens:            'rendue',
        product:         produit._id,
        nomProduit:      nom,
        quantite:        dto.quantite,
        montantUnitaire: cond.consigne,
        montant,
        date:            new Date(),
        auteurNom:       acteur?.name  ?? '',
        auteurEmail:     acteur?.email ?? '',
        idempotencyKey:  dto.idempotencyKey,
      });
    } catch (err: any) {
      if (dto.idempotencyKey && err?.code === 11000) {
        const deja = await this.consigneModel.findOne({ idempotencyKey: dto.idempotencyKey }).lean();
        if (deja) return { mouvement: deja, montant: deja.montant, rejeu: true };
      }
      throw err;
    }

    const depense = await this.expenseModel.create({
      amount:      montant,
      category:    CATEGORIE_DEPENSE_CONSIGNE,
      description: `Retour de vide — ${dto.quantite} × ${nom}${acteur?.name ? ` (${acteur.name})` : ''}`,
      date:        mouvement.date,
    });
    mouvement.expense = depense._id;
    await mouvement.save();

    cond.videsEnReserve += dto.quantite;
    await cond.save();

    return { mouvement: mouvement.toObject(), montant, rejeu: false, videsEnReserve: cond.videsEnReserve };
  }

  /**
   * Consignes d'un jour : encaissées (lues dans les VENTES — lignes
   * « Consigne … » marquées `divers`, source de vérité de la caisse, valable
   * pour les ventes en ligne comme synchronisées) et rendues (mouvements).
   * Même repère temporel que les autres rapports : `createdAt`.
   */
  async consignesDuJour(date?: string) {
    const { debut, fin } = bornesDuJour(date);
    const [ventes, rendus] = await Promise.all([
      this.saleModel.find({ createdAt: { $gte: debut, $lt: fin }, 'items.divers': true }).lean(),
      this.consigneModel.find({ sens: 'rendue', date: { $gte: debut, $lt: fin } }).lean(),
    ]);

    type Cumul = { productId: string; nomProduit: string; encaissees: number; rendues: number; montantEncaisse: number; montantRendu: number };
    const parProduit = new Map<string, Cumul>();
    const cumul = (cle: string, nom: string) => {
      let c = parProduit.get(cle);
      if (!c) { c = { productId: cle, nomProduit: nom, encaissees: 0, rendues: 0, montantEncaisse: 0, montantRendu: 0 }; parProduit.set(cle, c); }
      return c;
    };

    const encaissees = { quantite: 0, montant: 0 };
    for (const v of ventes) {
      for (const it of v.items ?? []) {
        if (!it.divers || !it.name?.startsWith(PREFIXE_LIGNE_CONSIGNE)) continue;
        const cle = it.product ? String(it.product) : it.name;
        const c = cumul(cle, it.name.slice(PREFIXE_LIGNE_CONSIGNE.length));
        c.encaissees      += it.quantity;
        c.montantEncaisse += it.quantity * it.unitPrice;
        encaissees.quantite += it.quantity;
        encaissees.montant  += it.quantity * it.unitPrice;
      }
    }
    const rendues = { quantite: 0, montant: 0 };
    for (const r of rendus) {
      const c = cumul(String(r.product), r.nomProduit);
      c.rendues      += r.quantite;
      c.montantRendu += r.montant;
      rendues.quantite += r.quantite;
      rendues.montant  += r.montant;
    }

    return {
      date:  debut.toISOString().slice(0, 10),
      encaissees,
      rendues,
      solde: encaissees.montant - rendues.montant,
      parProduit: [...parProduit.values()].sort((a, b) => a.nomProduit.localeCompare(b.nomProduit, 'fr')),
    };
  }
}
