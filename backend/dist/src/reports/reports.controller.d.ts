import { Response } from 'express';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private reportsService;
    constructor(reportsService: ReportsService);
    dailyPdf(date: string, res: Response): Promise<void>;
    monthlyExcel(month: string, res: Response): Promise<void>;
}
