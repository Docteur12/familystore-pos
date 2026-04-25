import { HydratedDocument } from 'mongoose';
export type ExpenseDocument = HydratedDocument<Expense>;
export declare class Expense {
    amount: number;
    category: string;
    description: string;
    date: Date;
}
export declare const ExpenseSchema: import("mongoose").Schema<Expense, import("mongoose").Model<Expense, any, any, any, import("mongoose").Document<unknown, any, Expense> & Expense & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Expense, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<Expense>> & import("mongoose").FlatRecord<Expense> & {
    _id: import("mongoose").Types.ObjectId;
}>;
