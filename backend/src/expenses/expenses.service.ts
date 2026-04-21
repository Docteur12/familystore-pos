import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from '../schemas/expense.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
  ) {}

  // ── POST /expenses ─────────────────────────────────────────────────────────

  create(dto: CreateExpenseDto) {
    return this.expenseModel.create({
      amount:      dto.amount,
      category:    dto.category,
      description: dto.description ?? '',
      date:        dto.date ? new Date(dto.date) : new Date(),
    });
  }

  // ── GET /expenses ──────────────────────────────────────────────────────────

  findAll() {
    return this.expenseModel.find().sort({ date: -1, createdAt: -1 });
  }

  // ── DELETE /expenses/:id ───────────────────────────────────────────────────

  async remove(id: string) {
    const expense = await this.expenseModel.findByIdAndDelete(id);
    if (!expense) throw new NotFoundException('Dépense introuvable');
    return { message: 'Dépense supprimée', id };
  }

  // ── GET /expenses/stats/month ──────────────────────────────────────────────

  async statsMonth() {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const expenses = await this.expenseModel
      .find({ date: { $gte: start, $lt: end } })
      .sort({ date: -1 })
      .lean();

    // Total général
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    // Regroupement par catégorie
    const byCategory: Record<string, { total: number; count: number }> = {};
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
      month:      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      total,
      count:      expenses.length,
      categories,
    };
  }
}
