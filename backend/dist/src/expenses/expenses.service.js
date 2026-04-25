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
exports.ExpensesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const expense_schema_1 = require("../schemas/expense.schema");
let ExpensesService = class ExpensesService {
    constructor(expenseModel) {
        this.expenseModel = expenseModel;
    }
    create(dto) {
        return this.expenseModel.create({
            amount: dto.amount,
            category: dto.category,
            description: dto.description ?? '',
            date: dto.date ? new Date(dto.date) : new Date(),
        });
    }
    findAll() {
        return this.expenseModel.find().sort({ date: -1, createdAt: -1 });
    }
    async remove(id) {
        const expense = await this.expenseModel.findByIdAndDelete(id);
        if (!expense)
            throw new common_1.NotFoundException('Dépense introuvable');
        return { message: 'Dépense supprimée', id };
    }
    async statsMonth() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const expenses = await this.expenseModel
            .find({ date: { $gte: start, $lt: end } })
            .sort({ date: -1 })
            .lean();
        const total = expenses.reduce((s, e) => s + e.amount, 0);
        const byCategory = {};
        for (const e of expenses) {
            if (!byCategory[e.category]) {
                byCategory[e.category] = { total: 0, count: 0 };
            }
            byCategory[e.category].total += e.amount;
            byCategory[e.category].count += 1;
        }
        const categories = Object.entries(byCategory)
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.total - a.total);
        return {
            month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            total,
            count: expenses.length,
            categories,
        };
    }
};
exports.ExpensesService = ExpensesService;
exports.ExpensesService = ExpensesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(expense_schema_1.Expense.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ExpensesService);
//# sourceMappingURL=expenses.service.js.map