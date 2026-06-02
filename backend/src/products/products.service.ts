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

  async create(dto: CreateProductDto) {
    const initialStock = dto.stock ?? 0;
    const alertThreshold = Math.max(1, Math.ceil(initialStock * 0.10));
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const expiryDate = dto.expiryDate ?? oneYearFromNow.toISOString().slice(0, 10);
    try {
      return await this.productModel.create({
        ...dto,
        initialStock,
        alertThreshold,
        expiryDate,
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
  async setPrix(id: string, price: number, costPrice: number) {
    const product = await this.productModel.findByIdAndUpdate(
      id,
      { $set: { price: Math.max(0, price), costPrice: Math.max(0, costPrice), prixVerrouille: true } },
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
}
