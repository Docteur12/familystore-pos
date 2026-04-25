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

  findAll() {
    return this.productModel.find().sort({ name: 1 }).lean();
  }

  async findByBarcode(rawBarcode: string) {
    const barcode = rawBarcode.trim();
    this.logger.log(`[barcode] recherche: "${barcode}" (reçu: "${rawBarcode}")`);
    const product = await this.productModel.findOne({ barcode }).lean();
    if (!product) {
      this.logger.warn(`[barcode] introuvable: "${barcode}"`);
      throw new NotFoundException(`Aucun produit avec le code-barres "${barcode}"`);
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
