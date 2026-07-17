import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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
    // Si le prix est verrouillé (fixé par le magazinier à la création), on trace l'auteur.
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

  // Le magazinier (ou patron) fixe les prix d'un produit existant.
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
}
