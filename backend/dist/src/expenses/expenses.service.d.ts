import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from '../schemas/expense.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
export declare class ExpensesService {
    private expenseModel;
    constructor(expenseModel: Model<ExpenseDocument>);
    create(dto: CreateExpenseDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Expense> & Expense & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, Expense> & Expense & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
    findAll(): import("mongoose").Query<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Expense> & Expense & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, Expense> & Expense & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>)[], import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Expense> & Expense & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, Expense> & Expense & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>, {}, import("mongoose").Document<unknown, {}, Expense> & Expense & {
        _id: import("mongoose").Types.ObjectId;
    }, "find">;
    remove(id: string): Promise<{
        message: string;
        id: string;
    }>;
    statsMonth(): Promise<{
        month: string;
        total: number;
        count: number;
        categories: {
            total: number;
            count: number;
            category: string;
        }[];
    }>;
}
