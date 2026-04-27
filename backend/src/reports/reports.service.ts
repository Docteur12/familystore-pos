import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sale, SaleDocument } from '../schemas/sale.schema';
import { Expense, ExpenseDocument } from '../schemas/expense.schema';

// ── Types internes ─────────────────────────────────────────────────────────────

interface SaleLean {
  _id: any;
  items: Array<{ product: any; quantity: number; unitPrice: number }>;
  total: number;
  paymentMethod: string;
  createdAt: Date;
}

interface ExpenseLean {
  _id: any;
  amount: number;
  category: string;
  description?: string;
  date: Date;
}

// ── Labels mode de paiement ───────────────────────────────────────────────────

const PM_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
  card: 'Carte',
  credit: 'Crédit',
  mobile_money: 'Mobile Money',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Sale.name)    private saleModel:    Model<SaleDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
  ) {}

  // ── Helpers données ───────────────────────────────────────────────────────

  private async fetchDayData(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [sales, expenses] = await Promise.all([
      this.saleModel
        .find({ createdAt: { $gte: start, $lt: end } })
        .populate('items.product', 'name costPrice unit')
        .sort({ createdAt: 1 })
        .lean() as Promise<SaleLean[]>,
      this.expenseModel
        .find({ date: { $gte: start, $lt: end } })
        .sort({ date: 1 })
        .lean() as Promise<ExpenseLean[]>,
    ]);

    return { sales, expenses, start };
  }

  private async fetchMonthData(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);

    const [sales, expenses] = await Promise.all([
      this.saleModel
        .find({ createdAt: { $gte: start, $lt: end } })
        .populate('items.product', 'name costPrice unit category')
        .sort({ createdAt: 1 })
        .lean() as Promise<SaleLean[]>,
      this.expenseModel
        .find({ date: { $gte: start, $lt: end } })
        .sort({ date: 1 })
        .lean() as Promise<ExpenseLean[]>,
    ]);

    return { sales, expenses, start };
  }

  private computeSaleTotals(sales: SaleLean[]) {
    let totalCA = 0;
    let totalBenefice = 0;
    for (const sale of sales) {
      totalCA += sale.total;
      for (const item of sale.items) {
        const costPrice: number = item.product?.costPrice ?? 0;
        totalBenefice += (item.unitPrice - costPrice) * item.quantity;
      }
    }
    return { totalCA, totalBenefice };
  }

  // ── PDF journalier ─────────────────────────────────────────────────────────

  async generateDailyPdf(dateStr?: string): Promise<Buffer> {
    const date = dateStr ? new Date(dateStr) : new Date();
    const { sales, expenses, start } = await this.fetchDayData(date);

    const { totalCA, totalBenefice } = this.computeSaleTotals(sales);
    const totalDepenses = expenses.reduce((s, e) => s + e.amount, 0);
    const resultatNet   = totalBenefice - totalDepenses;

    // jsPDF fonctionne en Node.js v2+ sans DOM (text/rect/line uniquement)
    const { jsPDF } = require('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    // Constantes de mise en page
    const W  = 595;          // largeur A4
    const ML = 40;           // marge gauche
    const MR = W - 40;       // marge droite
    const UW = MR - ML;      // largeur utile = 515pt

    // Palette
    const C = {
      bordeaux: [139, 26, 43],
      gold:     [201, 168, 76],
      cream:    [245, 240, 232],
      light:    [249, 250, 251],
      gray:     [107, 114, 128],
      dark:     [30,  30,  30],
      white:    [255, 255, 255],
      red:      [220, 53,  69],
      green:    [22,  163, 74],
    };

    const fill  = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
    const draw  = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);
    const color = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);

    const fr = (n: number) => n.toLocaleString('fr-FR');

    // ── HEADER ──────────────────────────────────────────────────────────────
    fill(C.bordeaux); doc.rect(0, 0, W, 78, 'F');

    color(C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('FAMILY STORE', ML, 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    color(C.gold);
    doc.text('by RDCT', ML, 53);

    color([210, 210, 210]);
    doc.setFontSize(8);
    doc.text('Point de Vente — Logiciel de caisse', ML, 66);

    // Côté droit
    color(C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('RAPPORT JOURNALIER', MR, 34, { align: 'right' });

    const dateLabel = start
      .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    color(C.gold);
    doc.text(dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1), MR, 50, { align: 'right' });
    color([200, 200, 200]);
    doc.setFontSize(7.5);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, MR, 65, { align: 'right' });

    // Séparateur or
    draw(C.gold); doc.setLineWidth(2); doc.line(0, 78, W, 78);

    let y = 104;

    // ── SECTION VENTES ───────────────────────────────────────────────────────
    color(C.bordeaux);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('VENTES DU JOUR', ML, y);
    color(C.gray);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(`${sales.length} transaction${sales.length !== 1 ? 's' : ''}`, MR, y, { align: 'right' });
    y += 12;

    const COL = { h: ML, hW: 52, art: ML+52, artW: 228, pm: ML+280, pmW: 108, tot: ML+388, totW: UW-388 };
    const RH  = 19;

    if (sales.length === 0) {
      color(C.gray); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text('Aucune vente enregistrée ce jour.', ML + 8, y + 16);
      y += 30;
    } else {
      // En-tête tableau
      fill(C.bordeaux); doc.rect(ML, y, UW, RH, 'F');
      color(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      doc.text('Heure',         COL.h   + 4, y + 13);
      doc.text('Articles',      COL.art + 4, y + 13);
      doc.text('Paiement',      COL.pm  + 4, y + 13);
      doc.text('Total (FCFA)',  MR - 4,      y + 13, { align: 'right' });
      y += RH;

      for (let i = 0; i < sales.length; i++) {
        if (y + RH > 760) { doc.addPage(); y = 40; }

        const sale = sales[i];
        fill(i % 2 === 0 ? C.cream : C.light);
        doc.rect(ML, y, UW, RH, 'F');

        color(C.dark); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);

        const hour = new Date(sale.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        doc.text(hour, COL.h + 4, y + 12);

        const arts = sale.items
          .map(it => `${it.quantity}× ${it.product?.name ?? '?'}`)
          .join(', ');
        const artsTrunc = arts.length > 44 ? arts.slice(0, 41) + '…' : arts;
        doc.text(artsTrunc, COL.art + 4, y + 12);

        doc.text(PM_LABELS[sale.paymentMethod] ?? sale.paymentMethod, COL.pm + 4, y + 12);

        doc.setFont('helvetica', 'bold');
        doc.text(fr(sale.total), MR - 4, y + 12, { align: 'right' });

        y += RH;
      }
    }

    y += 22;

    // ── SYNTHÈSE ─────────────────────────────────────────────────────────────
    draw(C.gold); doc.setLineWidth(1.5); doc.line(ML, y, MR, y); y += 18;

    color(C.bordeaux); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('SYNTHÈSE FINANCIÈRE', ML, y); y += 18;

    const rows = [
      { label: "Chiffre d'affaires du jour",           val: totalCA,       color: C.bordeaux },
      { label: "Bénéfice brut (CA − coûts d'achat)",   val: totalBenefice, color: C.bordeaux },
      { label: "Total dépenses du jour",                val: totalDepenses, color: C.red      },
    ];

    for (const r of rows) {
      color(C.dark); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(r.label, ML + 10, y);
      color(r.color); doc.setFont('helvetica', 'bold');
      doc.text(fr(r.val) + ' FCFA', MR, y, { align: 'right' });
      y += 17;
    }

    y += 6;
    draw([180, 180, 180]); doc.setLineWidth(0.5); doc.line(ML + 8, y, MR, y); y += 12;

    // Résultat net
    const isPositive = resultatNet >= 0;
    fill(isPositive ? [240, 253, 244] : [254, 242, 242]);
    doc.rect(ML, y - 11, UW, 24, 'F');
    color(C.dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
    doc.text('Résultat net', ML + 10, y + 4);
    color(isPositive ? C.green : C.red); doc.setFontSize(13);
    doc.text(fr(resultatNet) + ' FCFA', MR, y + 4, { align: 'right' });

    // ── PIED DE PAGE ─────────────────────────────────────────────────────────
    fill(C.bordeaux); doc.rect(0, 820, W, 22, 'F');
    color([200, 200, 200]); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(
      `Family Store POS — by RDCT  •  Rapport généré le ${new Date().toLocaleString('fr-FR')}`,
      W / 2, 834, { align: 'center' },
    );

    return Buffer.from(doc.output('arraybuffer'));
  }

  // ── Excel journalier ───────────────────────────────────────────────────────

  async generateDailyExcel(dateStr?: string): Promise<Buffer> {
    const date = dateStr ? new Date(dateStr) : new Date();
    const { sales, start } = await this.fetchDayData(date);

    const dateLabel = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const ExcelJS = require('exceljs');
    const wb      = new ExcelJS.Workbook();
    wb.creator    = 'Family Store POS by RDCT';
    wb.created    = new Date();

    const A = {
      bordeaux: 'FF8B1A2B',
      gold:     'FFC9A84C',
      cream:    'FFF5F0E8',
      light:    'FFF9FAFB',
      white:    'FFFFFFFF',
    };
    const hFill  = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
    const border = {
      top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    };
    const currFmt = '#,##0" XAF"';

    const ws = wb.addWorksheet('Ventes du jour');

    // Titre
    ws.mergeCells('A1:F1');
    const t1 = ws.getCell('A1');
    t1.value     = `FAMILY STORE by RDCT — Ventes du jour`;
    t1.fill      = hFill(A.bordeaux);
    t1.font      = { bold: true, color: { argb: A.white }, size: 13 };
    t1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:F2');
    const t2 = ws.getCell('A2');
    t2.value     = `${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}  •  Généré le ${new Date().toLocaleDateString('fr-FR')}`;
    t2.fill      = hFill(A.gold);
    t2.font      = { size: 8.5, color: { argb: 'FF1A1A1A' } };
    t2.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 16;

    ws.columns = [
      { key: 'heure', width: 9  },
      { key: 'ticket', width: 12 },
      { key: 'caissier', width: 14 },
      { key: 'articles', width: 44 },
      { key: 'pm',      width: 16 },
      { key: 'total',   width: 18 },
    ];

    const hr = ws.getRow(3);
    hr.values = ['Heure', 'Ticket #', 'Caissier', 'Articles', 'Mode paiement', 'Total XAF'];
    hr.height = 22;
    hr.eachCell((cell: any, colN: number) => {
      cell.fill      = hFill(A.bordeaux);
      cell.font      = { bold: true, color: { argb: A.white }, size: 10 };
      cell.border    = border;
      cell.alignment = { horizontal: colN === 6 ? 'right' : 'left', vertical: 'middle' };
    });

    let totalCA = 0;
    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];
      totalCA += sale.total;
      const d    = new Date(sale.createdAt);
      const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const ticket = '#' + sale._id.toString().slice(-6).toUpperCase();
      const articles = sale.items
        .map((it: any) => `${it.quantity}× ${(it as any).name ?? it.product?.name ?? '?'}`)
        .join(', ');

      const row = ws.getRow(4 + i);
      row.values = [heure, ticket, '—', articles, PM_LABELS[sale.paymentMethod] ?? sale.paymentMethod, sale.total];
      row.height = 18;
      const bg = hFill(i % 2 === 0 ? A.cream : A.light);
      row.eachCell((cell: any, colN: number) => {
        cell.fill      = bg;
        cell.border    = border;
        cell.alignment = { horizontal: colN === 6 ? 'right' : 'left', vertical: 'middle' };
        if (colN === 6) cell.numFmt = currFmt;
      });
    }

    // Total row
    const totRow = ws.getRow(4 + sales.length);
    totRow.values = ['', '', '', '', 'TOTAL', totalCA];
    totRow.height = 22;
    totRow.eachCell((cell: any, colN: number) => {
      cell.fill   = hFill('FF6D1422');
      cell.font   = { bold: true, color: { argb: A.gold }, size: 10 };
      cell.border = border;
      cell.alignment = { horizontal: colN >= 5 ? 'right' : 'left', vertical: 'middle' };
      if (colN === 6) cell.numFmt = currFmt;
    });

    const ab = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(ab) ? ab : Buffer.from(ab as ArrayBuffer);
  }

  // ── PDF mensuel ─────────────────────────────────────────────────────────────

  async generateMonthlyPdf(year: number, month: number): Promise<Buffer> {
    const { sales, expenses, start } = await this.fetchMonthData(year, month);
    const { totalCA, totalBenefice } = this.computeSaleTotals(sales);
    const totalDep    = expenses.reduce((s, e) => s + e.amount, 0);
    const resultatNet = totalBenefice - totalDep;
    const monthLabel  = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const { jsPDF } = require('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const W = 595, ML = 40, MR = 555, UW = 515;
    const C = {
      bordeaux: [139, 26, 43] as [number,number,number],
      gold:     [201, 168, 76] as [number,number,number],
      cream:    [245, 240, 232] as [number,number,number],
      light:    [249, 250, 251] as [number,number,number],
      gray:     [107, 114, 128] as [number,number,number],
      dark:     [30, 30, 30] as [number,number,number],
      white:    [255, 255, 255] as [number,number,number],
      red:      [220, 53, 69] as [number,number,number],
      green:    [22, 163, 74] as [number,number,number],
    };

    const fill  = (c: [number,number,number]) => doc.setFillColor(c[0], c[1], c[2]);
    const draw  = (c: [number,number,number]) => doc.setDrawColor(c[0], c[1], c[2]);
    const color = (c: [number,number,number]) => doc.setTextColor(c[0], c[1], c[2]);
    const fr    = (n: number) => n.toLocaleString('fr-FR');

    // ── HEADER ────────────────────────────────────────────────────────────────
    fill(C.bordeaux); doc.rect(0, 0, W, 78, 'F');
    color(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
    doc.text('FAMILY STORE', ML, 36);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    color(C.gold); doc.text('by RDCT', ML, 53);
    color([210, 210, 210] as any); doc.setFontSize(8);
    doc.text('Point de Vente — Logiciel de caisse', ML, 66);

    color(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('RAPPORT MENSUEL', MR, 34, { align: 'right' });
    const cap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    color(C.gold); doc.text(cap, MR, 50, { align: 'right' });
    color([200, 200, 200] as any); doc.setFontSize(7.5);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, MR, 65, { align: 'right' });
    draw(C.gold); doc.setLineWidth(2); doc.line(0, 78, W, 78);

    let y = 100;

    // ── KPI BOXES ─────────────────────────────────────────────────────────────
    const kpis = [
      { label: "CA TOTAL",       val: totalCA,        c: C.bordeaux },
      { label: "BÉNÉFICE BRUT",  val: totalBenefice,  c: C.bordeaux },
      { label: "DÉPENSES",       val: totalDep,        c: C.red      },
      { label: "RÉSULTAT NET",   val: resultatNet,     c: resultatNet >= 0 ? C.green : C.red },
    ];
    const kw = (UW - 9) / 4;
    kpis.forEach((k, i) => {
      const x = ML + i * (kw + 3);
      fill(C.cream); doc.rect(x, y, kw, 54, 'F');
      color(C.gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text(k.label, x + 7, y + 14);
      color(k.c); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text(fr(Math.round(k.val)), x + 7, y + 35);
      color(C.gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text('FCFA', x + 7, y + 47);
    });
    y += 66;

    color(C.gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`${sales.length} vente${sales.length !== 1 ? 's' : ''} enregistrée${sales.length !== 1 ? 's' : ''} sur la période`, ML, y);
    y += 24;

    // ── VENTES PAR JOUR ───────────────────────────────────────────────────────
    draw(C.gold); doc.setLineWidth(1.5); doc.line(ML, y - 6, MR, y - 6); y += 4;
    color(C.bordeaux); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('VENTES PAR JOUR', ML, y); y += 14;

    // Group by day
    const byDay: Record<string, { n: number; ca: number; ben: number }> = {};
    for (const sale of sales) {
      const d = new Date(sale.createdAt).toLocaleDateString('fr-FR');
      if (!byDay[d]) byDay[d] = { n: 0, ca: 0, ben: 0 };
      byDay[d].n  += 1;
      byDay[d].ca += sale.total;
      for (const it of sale.items) {
        byDay[d].ben += (it.unitPrice - (it.product?.costPrice ?? 0)) * it.quantity;
      }
    }

    const RH = 18;
    fill(C.bordeaux); doc.rect(ML, y, UW, RH, 'F');
    color(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Date',          ML + 6,  y + 12);
    doc.text('Nb ventes',     ML + 110, y + 12);
    doc.text('CA (FCFA)',     ML + 240, y + 12);
    doc.text('Bénéfice (FCFA)', MR - 6, y + 12, { align: 'right' });
    y += RH;

    const days = Object.entries(byDay);
    if (days.length === 0) {
      color(C.gray); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text('Aucune vente ce mois.', ML + 8, y + 14); y += 30;
    } else {
      for (let i = 0; i < days.length; i++) {
        if (y + RH > 760) { doc.addPage(); y = 40; }
        const [date, data] = days[i];
        fill(i % 2 === 0 ? C.cream : C.light); doc.rect(ML, y, UW, RH, 'F');
        color(C.dark); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.text(date,               ML + 6,  y + 12);
        doc.text(String(data.n),     ML + 110, y + 12);
        doc.setFont('helvetica', 'bold');
        doc.text(fr(data.ca),        ML + 240, y + 12);
        doc.text(fr(Math.round(data.ben)), MR - 6, y + 12, { align: 'right' });
        y += RH;
      }
    }

    y += 26;
    if (y + 120 > 760) { doc.addPage(); y = 40; }

    // ── TOP PRODUITS ──────────────────────────────────────────────────────────
    draw(C.gold); doc.setLineWidth(1.5); doc.line(ML, y - 6, MR, y - 6); y += 4;
    color(C.bordeaux); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('TOP PRODUITS', ML, y); y += 14;

    const topMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const sale of sales) {
      for (const it of sale.items) {
        const key  = it.product?._id?.toString() ?? (it as any).name ?? 'x';
        const name = it.product?.name ?? (it as any).name ?? '?';
        if (!topMap[key]) topMap[key] = { name, qty: 0, revenue: 0 };
        topMap[key].qty     += it.quantity;
        topMap[key].revenue += it.unitPrice * it.quantity;
      }
    }
    const top10 = Object.values(topMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    fill(C.bordeaux); doc.rect(ML, y, UW, RH, 'F');
    color(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Produit',          ML + 6,  y + 12);
    doc.text('Qté vendue',       ML + 320, y + 12);
    doc.text('CA (FCFA)',        MR - 6,  y + 12, { align: 'right' });
    y += RH;

    if (top10.length === 0) {
      color(C.gray); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text('Aucune donnée.', ML + 8, y + 14); y += 30;
    } else {
      for (let i = 0; i < top10.length; i++) {
        if (y + RH > 760) { doc.addPage(); y = 40; }
        const p = top10[i];
        fill(i % 2 === 0 ? C.cream : C.light); doc.rect(ML, y, UW, RH, 'F');
        color(C.dark); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        const nm = p.name.length > 46 ? p.name.slice(0, 43) + '…' : p.name;
        doc.text(nm,               ML + 6,  y + 12);
        doc.text(fr(p.qty),        ML + 320, y + 12);
        doc.setFont('helvetica', 'bold');
        doc.text(fr(Math.round(p.revenue)), MR - 6, y + 12, { align: 'right' });
        y += RH;
      }
    }

    // ── FOOTER ────────────────────────────────────────────────────────────────
    fill(C.bordeaux); doc.rect(0, 820, W, 22, 'F');
    color([200, 200, 200] as any); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(
      `Family Store POS — by RDCT  •  Rapport généré le ${new Date().toLocaleString('fr-FR')}`,
      W / 2, 834, { align: 'center' },
    );

    return Buffer.from(doc.output('arraybuffer'));
  }

  // ── Excel mensuel ──────────────────────────────────────────────────────────

  async generateMonthlyExcel(monthStr?: string): Promise<Buffer> {
    let year: number, month: number;
    if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
      [year, month] = monthStr.split('-').map(Number);
    } else {
      const n = new Date();
      year = n.getFullYear(); month = n.getMonth() + 1;
    }

    const { sales, expenses, start } = await this.fetchMonthData(year, month);
    const { totalCA, totalBenefice } = this.computeSaleTotals(sales);
    const totalDep = expenses.reduce((s, e) => s + e.amount, 0);
    const resultatNet = totalBenefice - totalDep;

    const monthLabel = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // ExcelJS
    const ExcelJS = require('exceljs');
    const wb      = new ExcelJS.Workbook();
    wb.creator    = 'Family Store POS by RDCT';
    wb.created    = new Date();

    // ── Couleurs ──────────────────────────────────────────────────────────────
    const A = {
      bordeaux: 'FF8B1A2B',
      bordeauxDark: 'FF6D1422',
      gold:    'FFC9A84C',
      cream:   'FFF5F0E8',
      light:   'FFF9FAFB',
      white:   'FFFFFFFF',
      red:     'FFDC2626',
      green:   'FF16A34A',
      gray:    'FF6B7280',
    };

    const hFill  = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
    const hFont  = (argb = A.white, size = 10, bold = true) => ({ bold, color: { argb }, size });
    const border = {
      top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    };
    const currFmt = '#,##0" FCFA"';
    const intFmt  = '#,##0';

    const addTitle = (ws: any, text: string, cols: number) => {
      ws.mergeCells(`A1:${String.fromCharCode(64 + cols)}1`);
      const c = ws.getCell('A1');
      c.value     = text;
      c.fill      = hFill(A.bordeaux);
      c.font      = hFont(A.white, 13);
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 30;

      ws.mergeCells(`A2:${String.fromCharCode(64 + cols)}2`);
      const s = ws.getCell('A2');
      s.value     = `Période : ${monthLabel}  •  Généré le ${new Date().toLocaleDateString('fr-FR')}`;
      s.fill      = hFill(A.gold);
      s.font      = { size: 8.5, color: { argb: 'FF1A1A1A' } };
      s.alignment = { horizontal: 'center' };
      ws.getRow(2).height = 16;
    };

    const styleHeader = (row: any, aligns: ('left' | 'right' | 'center')[] = []) => {
      row.height = 22;
      row.eachCell((cell: any, colN: number) => {
        cell.fill      = hFill(A.bordeaux);
        cell.font      = hFont();
        cell.border    = border;
        cell.alignment = { horizontal: aligns[colN - 1] ?? 'left', vertical: 'middle' };
      });
    };

    // ── FEUILLE 1 : Ventes ────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Ventes');
    addTitle(ws1, `FAMILY STORE by RDCT — Ventes — ${monthLabel}`, 7);

    ws1.columns = [
      { key: 'date',    width: 13 },
      { key: 'heure',   width: 8  },
      { key: 'nbArt',   width: 9  },
      { key: 'detail',  width: 40 },
      { key: 'pm',      width: 15 },
      { key: 'ca',      width: 16 },
      { key: 'benef',   width: 16 },
    ];

    const hr1 = ws1.getRow(3);
    hr1.values = ['Date', 'Heure', 'Qté tot.', 'Détail articles', 'Paiement', 'CA (FCFA)', 'Bénéfice (FCFA)'];
    styleHeader(hr1, ['left','left','center','left','left','right','right']);

    let r1 = 4;
    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];
      const d    = new Date(sale.createdAt);
      let  ben   = 0;
      const detail = sale.items
        .map(it => {
          ben += (it.unitPrice - (it.product?.costPrice ?? 0)) * it.quantity;
          return `${it.quantity}× ${it.product?.name ?? '?'}`;
        }).join(', ');
      const totalQty = sale.items.reduce((s, it) => s + it.quantity, 0);

      const row = ws1.getRow(r1++);
      row.values = [
        d.toLocaleDateString('fr-FR'),
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        totalQty,
        detail,
        PM_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
        sale.total,
        ben,
      ];
      const bg = hFill(i % 2 === 0 ? A.cream : A.light);
      row.height = 18;
      row.eachCell((cell: any, colN: number) => {
        cell.fill      = bg;
        cell.border    = border;
        cell.alignment = { horizontal: colN >= 6 ? 'right' : colN === 3 ? 'center' : 'left', vertical: 'middle' };
        if (colN >= 6) cell.numFmt = currFmt;
      });
    }

    // Ligne totaux
    const tot1 = ws1.getRow(r1);
    tot1.values = ['', '', '', '', 'TOTAL', totalCA, totalBenefice];
    tot1.height = 22;
    tot1.eachCell((cell: any, colN: number) => {
      cell.fill   = hFill(A.bordeauxDark);
      cell.font   = hFont(A.gold);
      cell.border = border;
      cell.alignment = { horizontal: colN >= 5 ? 'right' : 'left', vertical: 'middle' };
      if (colN >= 6) cell.numFmt = currFmt;
    });

    // ── FEUILLE 2 : Dépenses ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Dépenses');
    addTitle(ws2, `FAMILY STORE by RDCT — Dépenses — ${monthLabel}`, 4);

    ws2.columns = [
      { key: 'date',   width: 13 },
      { key: 'cat',    width: 16 },
      { key: 'desc',   width: 36 },
      { key: 'mnt',    width: 16 },
    ];

    const hr2 = ws2.getRow(3);
    hr2.values = ['Date', 'Catégorie', 'Description', 'Montant (FCFA)'];
    styleHeader(hr2, ['left','left','left','right']);

    const byCat: Record<string, number> = {};
    let r2 = 4;
    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      byCat[exp.category] = (byCat[exp.category] ?? 0) + exp.amount;
      const row = ws2.getRow(r2++);
      row.values = [
        new Date(exp.date).toLocaleDateString('fr-FR'),
        exp.category,
        exp.description || '—',
        exp.amount,
      ];
      const bg = hFill(i % 2 === 0 ? A.cream : A.light);
      row.height = 18;
      row.eachCell((cell: any, colN: number) => {
        cell.fill   = bg;
        cell.border = border;
        cell.alignment = { horizontal: colN === 4 ? 'right' : 'left', vertical: 'middle' };
        if (colN === 4) cell.numFmt = currFmt;
      });
    }

    const tot2 = ws2.getRow(r2);
    tot2.values = ['', '', 'TOTAL', totalDep];
    tot2.height = 22;
    tot2.eachCell((cell: any, colN: number) => {
      cell.fill   = hFill(A.bordeauxDark);
      cell.font   = hFont(A.gold);
      cell.border = border;
      cell.alignment = { horizontal: colN >= 3 ? 'right' : 'left', vertical: 'middle' };
      if (colN === 4) cell.numFmt = currFmt;
    });

    // ── FEUILLE 3 : Résumé ────────────────────────────────────────────────────
    const ws3 = wb.addWorksheet('Résumé');
    addTitle(ws3, `FAMILY STORE by RDCT — Résumé — ${monthLabel}`, 2);
    ws3.columns = [{ key: 'label', width: 40 }, { key: 'val', width: 22 }];

    const section = (label: string, rowN: number) => {
      ws3.mergeCells(`A${rowN}:B${rowN}`);
      const c = ws3.getCell(`A${rowN}`);
      c.value     = label;
      c.fill      = hFill(A.bordeaux);
      c.font      = hFont(A.gold, 10);
      c.alignment = { horizontal: 'left', indent: 1 };
      ws3.getRow(rowN).height = 22;
    };

    const metric = (label: string, value: number, rowN: number, isCurrency = true, bold = false, colorArgb?: string) => {
      const row = ws3.getRow(rowN);
      const lc  = row.getCell(1);
      const vc  = row.getCell(2);
      lc.value = label;
      vc.value = value;
      vc.numFmt = isCurrency ? currFmt : intFmt;
      lc.alignment = { horizontal: 'left', indent: 1 };
      vc.alignment = { horizontal: 'right' };
      lc.border = border; vc.border = border;
      const bg = hFill(rowN % 2 === 0 ? A.cream : A.light);
      lc.fill = bg; vc.fill = bg;
      if (bold) {
        lc.font = { bold: true };
        vc.font = { bold: true, ...(colorArgb ? { color: { argb: colorArgb } } : {}) };
      }
      row.height = 20;
    };

    let rn = 3;
    section('VENTES', rn++);
    metric("Chiffre d'affaires total", totalCA, rn++);
    metric("Nombre de ventes", sales.length, rn++, false);
    metric("Bénéfice brut (CA − coûts d'achat)", totalBenefice, rn++);

    section('DÉPENSES', rn++);
    metric('Total dépenses du mois', totalDep, rn++, true, false, A.red);
    for (const [cat, amt] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
      metric(`  → ${cat}`, amt, rn++);
    }

    // Spacer
    ws3.getRow(rn).height = 8; rn++;

    // Résultat net — encadré spécial
    const netIsPos = resultatNet >= 0;
    const netArgb  = netIsPos ? A.green : A.red;
    const netBg    = hFill(netIsPos ? 'FFECFDF5' : 'FFFEF2F2');
    const netRow   = ws3.getRow(rn);
    const nlc = netRow.getCell(1);
    const nvc = netRow.getCell(2);
    nlc.value = 'RÉSULTAT NET DU MOIS';
    nvc.value = resultatNet;
    nvc.numFmt = currFmt;
    nlc.alignment = { horizontal: 'left', indent: 1 };
    nvc.alignment = { horizontal: 'right' };
    nlc.fill = netBg; nvc.fill = netBg;
    nlc.font = { bold: true, size: 12, color: { argb: netArgb } };
    nvc.font = { bold: true, size: 12, color: { argb: netArgb } };
    const thick = { style: 'medium' as const, color: { argb: netArgb } };
    nlc.border = { top: thick, bottom: thick, left: thick };
    nvc.border = { top: thick, bottom: thick, right: thick };
    netRow.height = 28;

    const ab = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(ab) ? ab : Buffer.from(ab as ArrayBuffer);
  }
}
