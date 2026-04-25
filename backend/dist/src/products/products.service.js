"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const product_schema_1 = require("../schemas/product.schema");
let ProductsService = ProductsService_1 = class ProductsService {
    constructor(productModel) {
        this.productModel = productModel;
        this.logger = new common_1.Logger(ProductsService_1.name);
    }
    findAll() {
        return this.productModel.find().sort({ name: 1 }).lean();
    }
    async findByBarcode(rawBarcode) {
        const barcode = rawBarcode.trim();
        this.logger.log(`[barcode] recherche: "${barcode}" (reçu: "${rawBarcode}")`);
        const product = await this.productModel.findOne({ barcode }).lean();
        if (!product) {
            this.logger.warn(`[barcode] introuvable: "${barcode}"`);
            throw new common_1.NotFoundException(`Aucun produit avec le code-barres "${barcode}"`);
        }
        this.logger.log(`[barcode] trouvé: "${product.name}" (_id: ${product._id})`);
        return product;
    }
    async findById(id) {
        const product = await this.productModel.findById(id);
        if (!product) {
            throw new common_1.NotFoundException('Produit introuvable');
        }
        return product;
    }
    create(dto) {
        return this.productModel.create(dto);
    }
    async update(id, dto) {
        const product = await this.productModel.findByIdAndUpdate(id, dto, { new: true });
        if (!product) {
            throw new common_1.NotFoundException('Produit introuvable');
        }
        return product;
    }
    async remove(id) {
        const product = await this.productModel.findByIdAndDelete(id);
        if (!product) {
            throw new common_1.NotFoundException('Produit introuvable');
        }
        return { message: `Produit "${product.name}" supprimé` };
    }
    async addStock(id, quantity) {
        if (!quantity || quantity <= 0) {
            throw new common_1.BadRequestException('La quantité doit être un nombre positif');
        }
        const product = await this.productModel.findByIdAndUpdate(id, { $inc: { stock: quantity } }, { new: true });
        if (!product) {
            throw new common_1.NotFoundException('Produit introuvable');
        }
        return product;
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ProductsService);
//# sourceMappingURL=products.service.js.map