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
exports.StockController = void 0;
const common_1 = require("@nestjs/common");
const stock_service_1 = require("./stock.service");
const add_stock_dto_1 = require("./dto/add-stock.dto");
const remove_stock_dto_1 = require("./dto/remove-stock.dto");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let StockController = class StockController {
    constructor(stockService) {
        this.stockService = stockService;
    }
    addStock(dto) {
        return this.stockService.addStock(dto);
    }
    removeStock(dto) {
        return this.stockService.removeStock(dto);
    }
    getLowStock() {
        return this.stockService.getLowStock();
    }
    getMovements(productId) {
        return this.stockService.getMovements(productId);
    }
    getProductStock(productId) {
        return this.stockService.getProductStock(productId);
    }
};
exports.StockController = StockController;
__decorate([
    (0, common_1.Post)('add'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('gestionnaire', 'patron'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [add_stock_dto_1.AddStockDto]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "addStock", null);
__decorate([
    (0, common_1.Post)('remove'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('gestionnaire', 'patron'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [remove_stock_dto_1.RemoveStockDto]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "removeStock", null);
__decorate([
    (0, common_1.Get)('low'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getLowStock", null);
__decorate([
    (0, common_1.Get)('movements'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('gestionnaire', 'patron'),
    __param(0, (0, common_1.Query)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getMovements", null);
__decorate([
    (0, common_1.Get)(':productId'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('gestionnaire', 'patron'),
    __param(0, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getProductStock", null);
exports.StockController = StockController = __decorate([
    (0, common_1.Controller)('stock'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [stock_service_1.StockService])
], StockController);
//# sourceMappingURL=stock.controller.js.map