import React, { useState } from 'react';
import { downloadFile } from '../api/dashboard';

const monthISO = new Date().toISOString().substring(0, 7);
const todayISO = new Date().toISOString().split('T')[0];

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
        `rapport-journalier-${todayISO}.pdf`,
      );
      flash(`PDF du ${todayISO} téléchargé`);
    } catch (e: any) {
      setError(e.message ?? 'Erreur PDF');
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
        `rapport-mensuel-${selectedMonth}.xlsx`,
      );
      flash(`Excel ${selectedMonth} téléchargé`);
    } catch (e: any) {
      setError(e.message ?? 'Erreur Excel');
    } finally {
      setXlsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 flex items-center justify-between
        px-6 py-3 shrink-0 shadow-sm">
        <h2 className="font-bold text-bordeaux text-lg">Rapports</h2>
        <p className="text-gray-400 text-xs hidden md:block">
          Téléchargez vos rapports PDF ou Excel
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
              <h3 className="font-bold text-bordeaux text-base">Rapport du jour</h3>
              <p className="text-gray-400 text-sm mt-0.5">
                PDF journalier — ventes, CA, bénéfice, dépenses, résultat net
              </p>
            </div>
            <span className="text-3xl">📄</span>
          </div>

          <div className="bg-cream/60 rounded-xl px-4 py-3 mb-4 border border-cream-dark">
            <p className="text-xs text-gray-500">Date du rapport</p>
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
            Télécharger PDF
          </button>
        </div>

        {/* Monthly Excel */}
        <div className="bg-white rounded-2xl shadow border border-cream-dark p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-bordeaux text-base">Rapport mensuel</h3>
              <p className="text-gray-400 text-sm mt-0.5">
                Excel — ventes détaillées, dépenses par catégorie, résumé mensuel
              </p>
            </div>
            <span className="text-3xl">📊</span>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase
              tracking-wider mb-1.5">
              Mois
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
            Télécharger Excel
          </button>
        </div>

      </main>
    </div>
  );
}
