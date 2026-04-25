import { Model } from 'mongoose';
import { SaleDocument } from '../schemas/sale.schema';
import { ExpenseDocument } from '../schemas/expense.schema';
export declare class ReportsService {
    private saleModel;
    private expenseModel;
    constructor(saleModel: Model<SaleDocument>, expenseModel: Model<ExpenseDocument>);
    private fetchDayData;
    private fetchMonthData;
    private computeSaleTotals;
    generateDailyPdf(dateStr?: string): Promise<Buffer>;
    generateMonthlyExcel(monthStr?: string): Promise<Buffer>;
}
