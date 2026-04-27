import {
  BadRequestException,
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

  create(dto: CreateProductDto) {
    return this.productModel.create(dto);
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.productModel.findByIdAndUpdate(id, dto, { new: true });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
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
