import React, { useState } from 'react';
import { downloadFile } from '../api/dashboard';
import { localISODate, localISOMonth } from '../utils/dates';
import { t } from '../i18n';

const monthISO = localISOMonth();
const todayISO = localISODate();

export default function Rapports() {
  const [selectedMonth, setSelectedMonth] = useState(monthISO);
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [xlsLoading,    setXlsLoading]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState<string | null>(null);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handlePdf = async () => {
    setPdfLoading(true);
    setError(null);
    try {
      await downloadFile(
        `/api/reports/daily/pdf?date=${todayISO}`,
        t(`rapport-journalier-${todayISO}.pdf`, `daily-report-${todayISO}.pdf`),
      );
      flash(t(`PDF du ${todayISO} téléchargé`, `PDF for ${todayISO} downloaded`));
    } catch (e: any) {
      setError(e.message ?? t('Erreur PDF', 'PDF error'));
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExcel = async () => {
    setXlsLoading(true);
    setError(null);
    try {
      await downloadFile(
        `/api/reports/monthly/excel?month=${selectedMonth}`,
        t(`rapport-mensuel-${selectedMonth}.xlsx`, `monthly-report-${selectedMonth}.xlsx`),
      );
      flash(t(`Excel ${selectedMonth} téléchargé`, `Excel ${selectedMonth} downloaded`));
    } catch (e: any) {
      setError(e.message ?? t('Erreur Excel', 'Excel error'));
    } finally {
      setXlsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 flex items-center justify-between
        px-6 py-3 shrink-0 shadow-sm">
        <h2 className="font-bold text-bordeaux text-lg">{t('Rapports', 'Reports')}</h2>
        <p className="text-gray-400 text-xs hidden md:block">
          {t('Téléchargez vos rapports PDF ou Excel', 'Download your PDF or Excel reports')}
        </p>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-6">

        {/* Feedback */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3
            text-sm flex items-center gap-2">
            <span>✕</span>{error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3
            text-sm flex items-center gap-2">
            <span>✓</span>{success}
          </div>
        )}

        {/* Daily PDF */}
        <div className="bg-white rounded-2xl shadow border border-cream-dark p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-bordeaux text-base">{t('Rapport du jour', "Today's report")}</h3>
              <p className="text-gray-400 text-sm mt-0.5">
                {t('PDF journalier — ventes, CA, bénéfice, dépenses, résultat net', 'Daily PDF — sales, revenue, profit, expenses, net result')}
              </p>
            </div>
            <span className="text-3xl">📄</span>
          </div>

          <div className="bg-cream/60 rounded-xl px-4 py-3 mb-4 border border-cream-dark">
            <p className="text-xs text-gray-500">{t('Date du rapport', 'Report date')}</p>
            <p className="font-bold text-bordeaux">{todayISO}</p>
          </div>

          <button
            onClick={handlePdf}
            disabled={pdfLoading}
            className="w-full flex items-center justify-center gap-2 bg-bordeaux
              hover:bg-bordeaux-dark disabled:opacity-50 text-cream font-bold text-sm
              py-3 rounded-xl transition-colors border-2 border-gold"
          >
            {pdfLoading ? (
              <span className="w-4 h-4 border-2 border-cream/30 border-t-cream
                rounded-full animate-spin" />
            ) : <span>↓</span>}
            {t('Télécharger PDF', 'Download PDF')}
          </button>
        </div>

        {/* Monthly Excel */}
        <div className="bg-white rounded-2xl shadow border border-cream-dark p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-bordeaux text-base">{t('Rapport mensuel', 'Monthly report')}</h3>
              <p className="text-gray-400 text-sm mt-0.5">
                {t('Excel — ventes détaillées, dépenses par catégorie, résumé mensuel', 'Excel — detailed sales, expenses by category, monthly summary')}
              </p>
            </div>
            <span className="text-3xl">📊</span>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase
              tracking-wider mb-1.5">
              {t('Mois', 'Month')}
            </label>
            <input
              type="month"
              value={selectedMonth}
              max={monthISO}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                text-gray-700 focus:outline-none focus:ring-2 focus:ring-bordeaux/30
                bg-cream/40"
            />
          </div>

          <button
            onClick={handleExcel}
            disabled={xlsLoading}
            className="w-full flex items-center justify-center gap-2 bg-gold
              hover:bg-gold-dark disabled:opacity-50 text-bordeaux font-bold text-sm
              py-3 rounded-xl transition-colors"
          >
            {xlsLoading ? (
              <span className="w-4 h-4 border-2 border-bordeaux/30 border-t-bordeaux
                rounded-full animate-spin" />
            ) : <span>↓</span>}
            {t('Télécharger Excel', 'Download Excel')}
          </button>
        </div>

      </main>
    </div>
  );
}
