import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
export declare class ExpensesController {
    private expensesService;
    constructor(expensesService: ExpensesService);
    create(dto: CreateExpenseDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/expense.schema").Expense> & import("../schemas/expense.schema").Expense & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/expense.schema").Expense> & import("../schemas/expense.schema").Expense & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>>;
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
    findAll(): import("mongoose").Query<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/expense.schema").Expense> & import("../schemas/expense.schema").Expense & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/expense.schema").Expense> & import("../schemas/expense.schema").Expense & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>)[], import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../schemas/expense.schema").Expense> & import("../schemas/expense.schema").Expense & {
        _id: import("mongoose").Types.ObjectId;
    }> & import("mongoose").Document<unknown, {}, import("../schemas/expense.schema").Expense> & import("../schemas/expense.schema").Expense & {
        _id: import("mongoose").Types.ObjectId;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>, {}, import("mongoose").Document<unknown, {}, import("../schemas/expense.schema").Expense> & import("../schemas/expense.schema").Expense & {
        _id: import("mongoose").Types.ObjectId;
    }, "find">;
    remove(id: string): Promise<{
        message: string;
        id: string;
    }>;
}
