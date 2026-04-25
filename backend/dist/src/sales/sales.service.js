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
var SalesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const sale_schema_1 = require("../schemas/sale.schema");
const product_schema_1 = require("../schemas/product.schema");
const stock_movement_schema_1 = require("../schemas/stock-movement.schema");
const mail_service_1 = require("../mail/mail.service");
let SalesService = SalesService_1 = class SalesService {
    constructor(saleModel, productModel, movementModel, mailService) {
        this.saleModel = saleModel;
        this.productModel = productModel;
        this.movementModel = movementModel;
        this.mailService = mailService;
        this.logger = new common_1.Logger(SalesService_1.name);
    }
    async create(dto) {
        const productIds = dto.items.map(i => new mongoose_2.Types.ObjectId(i.product));
        const products = await this.productModel
            .find({ _id: { $in: productIds } })
            .lean();
        const productMap = new Map(products.map(p => [String(p._id), p]));
        const stockErrors = [];
        for (const item of dto.items) {
            const p = productMap.get(item.product);
            if (!p) {
                stockErrors.push(`Produit introuvable : ${item.name}`);
                continue;
            }
            if (p.stock < item.quantity) {
                stockErrors.push(`Stock insuffisant pour "${p.name}" : disponible ${p.stock}, demandé ${item.quantity}`);
            }
        }
        if (stockErrors.length > 0) {
            throw new common_1.BadRequestException(stockErrors.join(' | '));
        }
        const change = Math.max(0, dto.amountPaid - dto.total);
        const sale = await this.saleModel.create({
            items: dto.items,
            total: dto.total,
            paymentMethod: dto.paymentMethod,
            amountPaid: dto.amountPaid,
            change,
        });
        const updateResults = await Promise.all(dto.items.map(item => this.productModel
            .findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } }, { new: true })
            .then(updated => ({ item, updated }))));
        await this.movementModel.insertMany(dto.items.map(item => ({
            productId: new mongoose_2.Types.ObjectId(item.product),
            type: 'OUT',
            quantity: item.quantity,
            reason: 'sale',
        })));
        const stockAlerts = [];
        for (const { item, updated } of updateResults) {
            if (!updated) {
                this.logger.warn(`Produit introuvable après vérification : ${item.product}`);
                continue;
            }
            if (updated.stock <= updated.alertThreshold) {
                stockAlerts.push({
                    alert: true,
                    productId: String(updated._id),
                    productName: updated.name,
                    stock: updated.stock,
                    alertThreshold: updated.alertThreshold,
                });
                this.mailService
                    .sendStockAlert(updated.name, updated.stock, updated.alertThreshold)
                    .catch(err => this.logger.error(`[MailAlert] "${updated.name}": ${err.message}`));
            }
        }
        return { sale, change, alerts: stockAlerts };
    }
    findAll() {
        return this.saleModel
            .find()
            .populate('items.product', 'name barcode unit')
            .sort({ createdAt: -1 })
            .lean();
    }
    async findOne(id) {
        const sale = await this.saleModel
            .findById(id)
            .populate('items.product', 'name barcode unit price')
            .lean();
        if (!sale)
            throw new common_1.NotFoundException('Vente introuvable');
        return sale;
    }
    async statsToday() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const sales = await this.saleModel
            .find({ createdAt: { $gte: start, $lt: end } })
            .populate('items.product', 'costPrice name')
            .lean();
        const totalCA = sales.reduce((s, v) => s + v.total, 0);
        const nbVentes = sales.length;
        let benefice = 0;
        for (const sale of sales) {
            for (const item of sale.items) {
                const costPrice = item.product?.costPrice ?? 0;
                benefice += (item.unitPrice - costPrice) * item.quantity;
            }
        }
        return {
            date: start.toISOString().split('T')[0],
            totalCA,
            nbVentes,
            benefice,
            marge: totalCA > 0 ? Math.round((benefice / totalCA) * 100) : 0,
        };
    }
    async statsWeek() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - i);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            const [agg] = await this.saleModel.aggregate([
                { $match: { createdAt: { $gte: start, $lt: end } } },
                { $group: { _id: null, totalCA: { $sum: '$total' }, nbVentes: { $sum: 1 } } },
            ]);
            days.push({
                date: start.toISOString().split('T')[0],
                label: start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
                totalCA: agg?.totalCA ?? 0,
                nbVentes: agg?.nbVentes ?? 0,
            });
        }
        return days;
    }
    topProducts() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6);
        return this.saleModel.aggregate([
            { $match: { createdAt: { $gte: start } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    totalQty: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
                },
            },
            { $sort: { totalQty: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'products', localField: '_id', foreignField: '_id', as: 'product',
                },
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
            {
                $project: {
                    _id: 1, name: '$product.name', category: '$product.category',
                    unit: '$product.unit', totalQty: 1, totalRevenue: 1,
                },
            },
        ]);
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = SalesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(sale_schema_1.Sale.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __param(2, (0, mongoose_1.InjectModel)(stock_movement_schema_1.StockMovement.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mail_service_1.MailService])
], SalesService);
//# sourceMappingURL=sales.service.js.map