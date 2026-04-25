import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
@Roles('patron')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // GET /api/reports/daily/pdf?date=2026-04-24
  @Get('daily/pdf')
  async dailyPdf(@Query('date') date: string, @Res() res: Response) {
    try {
      const buffer   = await this.reportsService.generateDailyPdf(date);
      const dateSlug = date || new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-journalier-${dateSlug}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err: any) {
      res.status(500).json({ message: 'Erreur génération PDF', error: err.message });
    }
  }

  // GET /api/reports/monthly/excel?month=2026-04
  @Get('monthly/excel')
  async monthlyExcel(@Query('month') month: string, @Res() res: Response) {
    try {
      const buffer    = await this.reportsService.generateMonthlyExcel(month);
      const monthSlug = month || new Date().toISOString().substring(0, 7);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-mensuel-${monthSlug}.xlsx"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err: any) {
      res.status(500).json({ message: 'Erreur génération Excel', error: err.message });
    }
  }
}
