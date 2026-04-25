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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const product_schema_1 = require("../schemas/product.schema");
const stock_movement_schema_1 = require("../schemas/stock-movement.schema");
let StockService = class StockService {
    constructor(productModel, movementModel) {
        this.productModel = productModel;
        this.movementModel = movementModel;
    }
    async addStock(dto) {
        const product = await this.productModel.findByIdAndUpdate(dto.productId, { $inc: { stock: dto.quantity } }, { new: true });
        if (!product)
            throw new common_1.NotFoundException('Produit introuvable');
        await this.movementModel.create({
            productId: new mongoose_2.Types.ObjectId(dto.productId),
            type: 'IN',
            quantity: dto.quantity,
            reason: 'restock',
            note: dto.note,
        });
        return { product, newStock: product.stock };
    }
    async removeStock(dto) {
        const product = await this.productModel.findById(dto.productId);
        if (!product)
            throw new common_1.NotFoundException('Produit introuvable');
        if (product.stock < dto.quantity) {
            throw new common_1.BadRequestException(`Stock insuffisant : disponible ${product.stock}, demandé ${dto.quantity}`);
        }
        const updated = await this.productModel.findByIdAndUpdate(dto.productId, { $inc: { stock: -dto.quantity } }, { new: true });
        await this.movementModel.create({
            productId: new mongoose_2.Types.ObjectId(dto.productId),
            type: 'OUT',
            quantity: dto.quantity,
            reason: dto.reason,
            note: dto.note,
        });
        return { product: updated, newStock: updated.stock };
    }
    async recordSaleMovement(productId, quantity) {
        await this.movementModel.create({
            productId: new mongoose_2.Types.ObjectId(productId),
            type: 'OUT',
            quantity,
            reason: 'sale',
        });
    }
    getLowStock() {
        return this.productModel
            .find({ $expr: { $lte: ['$stock', '$alertThreshold'] } })
            .sort({ stock: 1 })
            .lean();
    }
    getMovements(productId) {
        const filter = productId ? { productId: new mongoose_2.Types.ObjectId(productId) } : {};
        return this.movementModel
            .find(filter)
            .populate('productId', 'name barcode unit')
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();
    }
    async getProductStock(productId) {
        const product = await this.productModel.findById(productId).lean();
        if (!product)
            throw new common_1.NotFoundException('Produit introuvable');
        const movements = await this.movementModel
            .find({ productId: new mongoose_2.Types.ObjectId(productId) })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        return { product, movements };
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __param(1, (0, mongoose_1.InjectModel)(stock_movement_schema_1.StockMovement.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], StockService);
//# sourceMappingURL=stock.service.js.map