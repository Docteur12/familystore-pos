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

  // GET /api/reports/daily/excel?date=2026-04-24
  @Get('daily/excel')
  async dailyExcel(@Query('date') date: string, @Res() res: Response) {
    try {
      const buffer   = await this.reportsService.generateDailyExcel(date);
      const dateSlug = date || new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ventes-jour-${dateSlug}.xlsx"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err: any) {
      res.status(500).json({ message: 'Erreur génération Excel', error: err.message });
    }
  }

  // GET /api/reports/monthly/excel?month=4&year=2026  (or legacy ?month=2026-04)
  @Get('monthly/excel')
  async monthlyExcel(
    @Query('month') monthQ: string,
    @Query('year')  yearQ: string,
    @Res() res: Response,
  ) {
    try {
      // Support both ?month=4&year=2026 and legacy ?month=2026-04
      let monthSlug: string;
      if (yearQ && monthQ && !monthQ.includes('-')) {
        const y = parseInt(yearQ);
        const m = parseInt(monthQ);
        monthSlug = `${y}-${String(m).padStart(2, '0')}`;
      } else {
        monthSlug = monthQ || new Date().toISOString().substring(0, 7);
      }
      const buffer = await this.reportsService.generateMonthlyExcel(monthSlug);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="journal-ventes-${monthSlug}.xlsx"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err: any) {
      res.status(500).json({ message: 'Erreur génération Excel', error: err.message });
    }
  }

  // GET /api/reports/monthly/pdf?month=4&year=2026
  @Get('monthly/pdf')
  async monthlyPdf(
    @Query('month') monthQ: string,
    @Query('year')  yearQ: string,
    @Res() res: Response,
  ) {
    try {
      const now   = new Date();
      const year  = yearQ  ? parseInt(yearQ)  : now.getFullYear();
      const month = monthQ ? parseInt(monthQ) : now.getMonth() + 1;
      const slug  = `${year}-${String(month).padStart(2, '0')}`;
      const buffer = await this.reportsService.generateMonthlyPdf(year, month);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-mensuel-${slug}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err: any) {
      res.status(500).json({ message: 'Erreur génération PDF', error: err.message });
    }
  }
}
