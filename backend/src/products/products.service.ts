import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { Product, ProductDocument } from '../schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// En-tête de colonne (normalisé sans accents/minuscules) → clé produit.
// Doit rester aligné avec le composant frontend ImportExportProduits.
const CLE_PAR_ENTETE: Record<string, string> = {
  'code-barres': 'barcode', 'code barres': 'barcode', 'barcode': 'barcode',
  'nom': 'name', 'nom local': 'localName',
  'categorie': 'category', 'sous-categorie': 'subCategory', 'sous categorie': 'subCategory',
  'unite': 'unit', 'valeur': 'valeur',
  'prix vente': 'price', 'prix achat': 'costPrice', 'reduction %': 'discount', 'reduction': 'discount',
  'stock boutique': 'stock', 'stock': 'stock', 'stock entrepot': 'stockMagazin',
  'seuil alerte': 'alertThreshold', 'seuil commande': 'magazinierThreshold',
  'peremption (aaaa-mm-jj)': 'expiryDate', 'peremption': 'expiryDate',
  'fournisseur': 'fournisseur',
};

const sansAccents = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  findAll(search?: string) {
    if (!search?.trim()) {
      return this.productModel.find().sort({ name: 1 }).lean();
    }
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return this.productModel.find({
      $or: [{ name: regex }, { barcode: regex }, { category: regex }],
    }).sort({ name: 1 }).lean();
  }

  async findByBarcode(rawBarcode: string) {
    const code = rawBarcode.trim();
    this.logger.log(`[barcode] recherche: "${code}"`);
    const product = await this.productModel.findOne({
      $or: [
        { barcode: code },
        { barcode: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { name:    new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    }).lean();
    if (!product) {
      this.logger.warn(`[barcode] introuvable: "${code}"`);
      throw new NotFoundException(`Aucun produit avec le code "${code}"`);
    }
    this.logger.log(`[barcode] trouvé: "${product.name}" (_id: ${product._id})`);
    return product;
  }

  async findById(id: string) {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
    return product;
  }

  async create(dto: CreateProductDto, actor?: { name?: string; role?: string }) {
    const initialStock = dto.stock ?? 0;
    // Seuil = 10% de la quantité initiale (= maximale), jamais en dessous de 2.
    const alertThreshold = Math.max(2, Math.ceil(initialStock * 0.10));
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const expiryDate = dto.expiryDate ?? oneYearFromNow.toISOString().slice(0, 10);
    // Si le prix est verrouillé (fixé par le magasinier à la création), on trace l'auteur.
    const trace = dto.prixVerrouille
      ? { prixModifiePar: actor?.name ?? '', prixModifieParRole: actor?.role ?? '', prixModifieLe: new Date() }
      : {};
    try {
      return await this.productModel.create({
        ...dto,
        initialStock,
        alertThreshold,
        expiryDate,
        ...trace,
      });
    } catch (err: any) {
      // Doublon de code-barres (index unique) → message clair au lieu d'un 500.
      if (err?.code === 11000) {
        throw new ConflictException('Ce code-barres est déjà utilisé par un autre produit');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.productModel.findByIdAndUpdate(id, dto, { new: true });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
    return product;
  }

  // Le magasinier (ou patron) fixe les prix d'un produit existant.
  // Verrouille le prix → le gestionnaire ne peut plus le modifier.
  async setPrix(id: string, price: number, costPrice: number, actorName = '', actorRole = '') {
    const product = await this.productModel.findByIdAndUpdate(
      id,
      { $set: {
        price: Math.max(0, price), costPrice: Math.max(0, costPrice), prixVerrouille: true,
        prixModifiePar: actorName, prixModifieParRole: actorRole, prixModifieLe: new Date(),
      } },
      { new: true },
    );
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async remove(id: string) {
    const product = await this.productModel.findByIdAndDelete(id);
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
    return { message: `Produit "${product.name}" supprimé` };
  }

  async addStock(id: string, quantity: number) {
    if (!quantity || quantity <= 0) {
      throw new BadRequestException('La quantité doit être un nombre positif');
    }
    const product = await this.productModel.findByIdAndUpdate(
      id,
      { $inc: { stock: quantity } },
      { new: true },
    );
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
    return product;
  }

  // ── Import en masse depuis un fichier Excel/CSV ─────────────────────────────
  // Correspondance : code-barres d'abord, sinon nom exact (insensible à la casse).
  // Une cellule VIDE ne modifie rien (aucun risque d'effacer des données) ;
  // une ligne sans correspondance crée le produit (nom requis).
  async importBulk(rows: Array<Record<string, unknown>>) {
    let crees = 0;
    let modifies = 0;
    const erreurs: { ligne: number; nom: string; message: string }[] = [];
    const clean = (v: unknown) => String(v ?? '').trim();
    const num = (v: unknown): number | undefined => {
      const t = clean(v).replace(/\s/g, '').replace(',', '.');
      if (t === '') return undefined;
      const n = Number(t);
      return isNaN(n) ? undefined : n;
    };
    const escapeRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const nom = clean(r.name);
      const barcode = clean(r.barcode);
      try {
        if (!nom && !barcode) continue; // ligne vide

        // Seules les cellules remplies sont appliquées
        const set: Record<string, unknown> = {};
        if (nom) set.name = nom;
        if (barcode) set.barcode = barcode;
        for (const k of ['localName', 'category', 'subCategory', 'unit', 'valeur', 'fournisseur'] as const) {
          const v = clean(r[k]);
          if (v) set[k] = v;
        }
        for (const k of ['price', 'costPrice', 'discount', 'stock', 'stockMagazin', 'alertThreshold', 'magazinierThreshold'] as const) {
          const v = num(r[k]);
          if (v !== undefined) set[k] = Math.max(0, v);
        }
        const exp = clean(r.expiryDate);
        if (exp) {
          const d = new Date(exp);
          if (!isNaN(d.getTime())) set.expiryDate = d;
        }

        let existing: { _id: unknown } | null = null;
        if (barcode) existing = await this.productModel.findOne({ barcode }).lean();
        if (!existing && nom) {
          existing = await this.productModel.findOne({ name: { $regex: `^${escapeRegex(nom)}$`, $options: 'i' } }).lean();
        }

        if (existing) {
          await this.productModel.updateOne({ _id: existing._id }, { $set: set });
          modifies++;
        } else {
          if (!nom) { erreurs.push({ ligne: i + 2, nom: barcode, message: 'produit introuvable et pas de nom pour le créer' }); continue; }
          await this.productModel.create({
            price: 0, costPrice: 0, stock: 0,
            ...set,
            name: nom,
          });
          crees++;
        }
      } catch (e: any) {
        erreurs.push({ ligne: i + 2, nom: nom || barcode, message: String(e?.message ?? 'erreur').slice(0, 140) });
      }
    }
    return { crees, modifies, erreurs };
  }

  // ── Export de tout le catalogue en VRAI fichier Excel (.xlsx) ───────────────
  async exportExcel(): Promise<Buffer> {
    const products = await this.productModel.find().sort({ name: 1 }).lean();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Produits');
    ws.columns = [
      { header: 'Code-barres', key: 'barcode', width: 16 },
      { header: 'Nom', key: 'name', width: 36 },
      { header: 'Nom local', key: 'localName', width: 20 },
      { header: 'Catégorie', key: 'category', width: 16 },
      { header: 'Sous-catégorie', key: 'subCategory', width: 16 },
      { header: 'Unité', key: 'unit', width: 10 },
      { header: 'Valeur', key: 'valeur', width: 10 },
      { header: 'Prix vente', key: 'price', width: 12 },
      { header: 'Prix achat', key: 'costPrice', width: 12 },
      { header: 'Réduction %', key: 'discount', width: 12 },
      { header: 'Stock boutique', key: 'stock', width: 14 },
      { header: 'Stock entrepôt', key: 'stockMagazin', width: 14 },
      { header: 'Seuil alerte', key: 'alertThreshold', width: 12 },
      { header: 'Seuil commande', key: 'magazinierThreshold', width: 14 },
      { header: 'Péremption (AAAA-MM-JJ)', key: 'expiryDate', width: 22 },
      { header: 'Fournisseur', key: 'fournisseur', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const p of products) {
      ws.addRow({
        barcode: p.barcode ?? '', name: p.name, localName: p.localName ?? '',
        category: p.category ?? '', subCategory: p.subCategory ?? '',
        unit: p.unit ?? '', valeur: p.valeur ?? '',
        price: p.price ?? 0, costPrice: p.costPrice ?? 0, discount: p.discount ?? 0,
        stock: p.stock ?? 0, stockMagazin: p.stockMagazin ?? 0,
        alertThreshold: p.alertThreshold ?? 0, magazinierThreshold: p.magazinierThreshold ?? 0,
        expiryDate: p.expiryDate ? new Date(p.expiryDate).toISOString().slice(0, 10) : '',
        fournisseur: p.fournisseur ?? '',
      });
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ── Lecture d'un fichier Excel (.xlsx) envoyé en base64 ─────────────────────
  // Renvoie les lignes mappées sur les clés produit — l'application les montre
  // pour confirmation avant d'appeler importBulk.
  async parseExcel(fileBase64: string) {
    if (!fileBase64) throw new BadRequestException('Fichier manquant');
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(Buffer.from(fileBase64, 'base64') as any);
    } catch {
      throw new BadRequestException("Ce fichier n'est pas un classeur Excel (.xlsx) lisible. Dans Excel, utilisez « Enregistrer sous » → format « Classeur Excel (.xlsx) ».");
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Classeur Excel vide');

    // En-têtes (ligne 1) → clés produit
    const cles: (string | null)[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      cles[col] = CLE_PAR_ENTETE[sansAccents(String(cell.text ?? ''))] ?? null;
    });
    if (!cles.includes('name') && !cles.includes('barcode')) {
      throw new BadRequestException('Colonnes non reconnues — gardez les en-têtes du fichier exporté (Nom, Code-barres…)');
    }

    const texteCellule = (cell: ExcelJS.Cell): string => {
      const v = cell.value as any;
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (typeof v === 'object') {
        if ('result' in v) return String(v.result ?? '');                        // formule
        if ('richText' in v) return v.richText.map((x: any) => x.text).join(''); // texte enrichi
        if ('text' in v) return String(v.text ?? '');                            // lien
        return String(cell.text ?? '');
      }
      return String(v);
    };

    const rows: Record<string, string>[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const r: Record<string, string> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const k = cles[col];
        if (k) r[k] = texteCellule(cell).trim();
      });
      if ((r.name ?? '') !== '' || (r.barcode ?? '') !== '') rows.push(r);
    });
    return { rows };
  }
}
