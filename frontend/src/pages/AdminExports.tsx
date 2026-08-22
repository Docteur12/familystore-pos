import { jeton } from '../services/storage';
import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import ImportExportProduits from '../components/ImportExportProduits';
import { getAllProducts, Product } from '../api/products';
import { useIsMobile } from '../hooks/useIsMobile';
import { localISODate } from '../utils/dates';
import { t, dateLocale } from '../i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExportItem {
  id: string;
  title: string;
  desc: string;
  format: 'xlsx' | 'pdf' | 'csv';
  section: string;
  size: string;
  updated: string;
  url?: string;
  filename?: string;
}

// ── Export catalogue ──────────────────────────────────────────────────────────

const today    = localISODate();
const thisYear = new Date().getFullYear();
const thisMon  = new Date().getMonth() + 1;
const prevMon  = thisMon === 1 ? 12 : thisMon - 1;
const prevYear = thisMon === 1 ? thisYear - 1 : thisYear;
const PAD = (n: number) => String(n).padStart(2, '0');
const MON_LABEL = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });

const EXPORTS: ExportItem[] = [
  {
    id: 'e1', title: t('Ventes du jour', 'Daily sales'), section: 'Caisse',
    desc: t('Tous les tickets de la journée en cours', 'All receipts for the current day'),
    format: 'xlsx', size: t('~48 Ko', '~48 KB'), updated: t("Aujourd'hui", 'Today'),
    url: `/api/reports/daily/excel?date=${today}`,
    filename: `ventes-jour-${today}.xlsx`,
  },
  {
    id: 'e2', title: t(`Journal des ventes — ${MON_LABEL(thisYear, thisMon)}`, `Sales journal — ${MON_LABEL(thisYear, thisMon)}`), section: 'Caisse',
    desc: t('Historique complet des ventes du mois (détail + résumé par jour + résumé par caissier)', 'Complete sales history for the month (details + daily summary + summary per cashier)'),
    format: 'xlsx', size: t('~320 Ko', '~320 KB'), updated: t("Aujourd'hui 00:00", 'Today 00:00'),
    url: `/api/reports/monthly/excel?month=${thisMon}&year=${thisYear}`,
    filename: `journal-ventes-${thisYear}-${PAD(thisMon)}.xlsx`,
  },
  {
    id: 'e3', title: t(`Rapport mensuel — ${MON_LABEL(thisYear, thisMon)}`, `Monthly report — ${MON_LABEL(thisYear, thisMon)}`), section: 'Rapports',
    desc: t('CA, bénéfice, ventes par jour, top produits', 'Revenue, profit, daily sales, top products'),
    format: 'pdf', size: t('~1.2 Mo', '~1.2 MB'), updated: t("Aujourd'hui 00:00", 'Today 00:00'),
    url: `/api/reports/monthly/pdf?month=${thisMon}&year=${thisYear}`,
    filename: `rapport-mensuel-${thisYear}-${PAD(thisMon)}.pdf`,
  },
  {
    id: 'e4', title: t(`Rapport mensuel — ${MON_LABEL(prevYear, prevMon)}`, `Monthly report — ${MON_LABEL(prevYear, prevMon)}`), section: 'Rapports',
    desc: t(`CA, bénéfice, synthèse ${MON_LABEL(prevYear, prevMon)}`, `Revenue, profit, ${MON_LABEL(prevYear, prevMon)} summary`),
    format: 'pdf', size: t('~1.1 Mo', '~1.1 MB'), updated: `${new Date(prevYear, prevMon, 0).getDate()}/${PAD(prevMon)}/${prevYear}`,
    url: `/api/reports/monthly/pdf?month=${prevMon}&year=${prevYear}`,
    filename: `rapport-mensuel-${prevYear}-${PAD(prevMon)}.pdf`,
  },
  {
    id: 'e5', title: t('Catalogue produits', 'Product catalogue'), section: 'Stock',
    desc: t('Tous les produits avec prix, codes-barres, catégories, stocks et fournisseurs', 'All products with prices, barcodes, categories, stock levels and suppliers'),
    format: 'xlsx', size: 'Excel', updated: t('Temps réel', 'Real-time'),
    url: '/api/products/export-excel',
    filename: `produits_${today}.xlsx`,
  },
  {
    id: 'e6', title: t('État du stock', 'Stock status'), section: 'Stock',
    desc: t('Quantités en stock par produit (boutique + entrepôt) — même fichier que le catalogue', 'Stock quantities per product (shop + warehouse) — same file as the catalogue'),
    format: 'xlsx', size: 'Excel', updated: t('Temps réel', 'Real-time'),
    url: '/api/products/export-excel',
    filename: `etat-stock_${today}.xlsx`,
  },
  {
    id: 'e7', title: t('Mouvements de stock', 'Stock movements'), section: 'Stock',
    desc: t('Entrées et sorties des 30 derniers jours (produit, quantité, motif)', 'Inbound and outbound over the last 30 days (product, quantity, reason)'),
    format: 'xlsx', size: 'Excel', updated: t('Temps réel', 'Real-time'),
    url: '/api/reports/mouvements-stock/excel',
    filename: `mouvements-stock_${today}.xlsx`,
  },
  {
    id: 'e8', title: t(`Fiche comptable — ${MON_LABEL(thisYear, thisMon)}`, `Accounting sheet — ${MON_LABEL(thisYear, thisMon)}`), section: 'Comptabilité',
    desc: t('Compte de résultat, dépenses par catégorie, ventes par mode de paiement', 'Income statement, expenses by category, sales by payment method'),
    format: 'pdf', size: 'PDF', updated: t('Temps réel', 'Real-time'),
    url: `/api/reports/compta/pdf?month=${thisMon}&year=${thisYear}`,
    filename: `fiche-comptable_${thisYear}-${PAD(thisMon)}.pdf`,
  },
  {
    id: 'e9', title: t(`Fiche comptable — ${MON_LABEL(prevYear, prevMon)}`, `Accounting sheet — ${MON_LABEL(prevYear, prevMon)}`), section: 'Comptabilité',
    desc: t(`Compte de résultat, charges et bénéfice de ${MON_LABEL(prevYear, prevMon)}`, `Income statement, expenses and profit for ${MON_LABEL(prevYear, prevMon)}`),
    format: 'pdf', size: 'PDF', updated: t('Temps réel', 'Real-time'),
    url: `/api/reports/compta/pdf?month=${prevMon}&year=${prevYear}`,
    filename: `fiche-comptable_${prevYear}-${PAD(prevMon)}.pdf`,
  },
  {
    id: 'e10', title: t('Liste des collaborateurs', 'Staff list'), section: 'Personnel',
    desc: t('Noms, rôles, identifiants, téléphones et affectations', 'Names, roles, logins, phone numbers and assignments'),
    format: 'xlsx', size: 'Excel', updated: t('Temps réel', 'Real-time'),
    url: '/api/reports/equipe/excel',
    filename: `equipe_${today}.xlsx`,
  },
  {
    id: 'e11', title: t('Performance caissiers', 'Cashier performance'), section: 'Personnel',
    desc: t('Ventes, articles, CA et panier moyen par caissier sur 30 jours', 'Sales, items, revenue and average basket per cashier over 30 days'),
    format: 'xlsx', size: 'Excel', updated: t('Temps réel', 'Real-time'),
    url: '/api/reports/caissiers/excel',
    filename: `caissiers-30j_${today}.xlsx`,
  },
  {
    id: 'e12', title: t("Journal d'audit", 'Audit log'), section: 'Système',
    desc: t('Toutes les actions sensibles tracées (qui, quoi, quand)', 'All sensitive actions tracked (who, what, when)'),
    format: 'xlsx', size: 'Excel', updated: t('Temps réel', 'Real-time'),
    url: '/api/reports/audit/excel',
    filename: `journal-audit_${today}.xlsx`,
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const FORMAT_CONFIG = {
  xlsx: { bg: '#E8F0E5', color: '#3F6B3A', label: 'Excel', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5' },
  pdf:  { bg: 'var(--fs-wine-100)', color: 'var(--fs-wine-700)', label: 'PDF',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h1M9 17h6' },
  csv:  { bg: '#EEF3FA', color: '#3A5E8F', label: 'CSV',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h4' },
};

const SECTIONS = ['Tous', 'Caisse', 'Rapports', 'Stock', 'Comptabilité', 'Personnel', 'Système'];

// Libellé affiché d'une section (la valeur technique reste utilisée pour le filtrage).
const sectionLabel = (s: string) => ({
  'Tous':         t('Tous', 'All'),
  'Caisse':       t('Caisse', 'Checkout'),
  'Rapports':     t('Rapports', 'Reports'),
  'Stock':        t('Stock', 'Stock'),
  'Comptabilité': t('Comptabilité', 'Accounting'),
  'Personnel':    t('Personnel', 'Staff'),
  'Système':      t('Système', 'System'),
}[s] ?? s);

// ── Icons ─────────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
}

function FileIcon({ d }: { d: string }) {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}

function Spinner() {
  return (
    <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminExports() {
  const [section,     setSection]     = useState('Tous');
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);

  // Liste des produits (pour l'import/export de la section Stock)
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { getAllProducts().then(setProducts).catch(() => {}); }, []);

  const visible = section === 'Tous' ? EXPORTS : EXPORTS.filter(e => e.section === section);

  const handleDownload = useCallback(async (item: ExportItem) => {
    if (!item.url) {
      addToast(t('Ce rapport n\'est pas encore disponible.', 'This report is not available yet.'), 'warning');
      return;
    }
    setDownloading(item.id);
    try {
      const token = jeton() ?? '';
      const response = await fetch(item.url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || t(`Erreur ${response.status}`, `Error ${response.status}`));
      }
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = item.filename ?? item.title;
      link.click();
      URL.revokeObjectURL(link.href);
      addToast(t(`Fichier téléchargé : ${item.filename ?? item.title}`, `File downloaded: ${item.filename ?? item.title}`), 'success');
    } catch (err: any) {
      addToast(err.message ?? t('Erreur lors du téléchargement', 'Error while downloading'), 'error');
    } finally {
      setDownloading(null);
    }
  }, [addToast]);

  const grouped = SECTIONS.slice(1).reduce((acc, s) => {
    const items = visible.filter(e => e.section === s);
    if (items.length > 0) acc[s] = items;
    return acc;
  }, {} as Record<string, ExportItem[]>);

  const toRender = section === 'Tous' ? grouped : { [section]: visible };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 16 }}>
            <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Système', 'System')}</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Exports</h1>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SECTIONS.map(s => (
                <button key={s} onClick={() => setSection(s)}
                  style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: section === s ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color: section === s ? '#fff' : 'var(--fs-ink-500)' }}>
                  {sectionLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: isNarrow ? '14px 16px' : '14px 28px', flexShrink: 0 }}>
          {[
            { label: t('Fichiers disponibles', 'Available files'), value: EXPORTS.length,                             color: 'var(--fs-ink-700)', bg: '#fff' },
            { label: 'Excel',  value: EXPORTS.filter(e => e.format === 'xlsx').length,           color: '#3F6B3A', bg: '#E8F0E5' },
            { label: 'PDF',    value: EXPORTS.filter(e => e.format === 'pdf').length,             color: 'var(--fs-wine-700)', bg: 'var(--fs-wine-100)' },
            { label: 'CSV',    value: EXPORTS.filter(e => e.format === 'csv').length,             color: '#3A5E8F', bg: '#EEF3FA' },
            { label: t('Connectés à l\'API', 'Connected to API'), value: EXPORTS.filter(e => !!e.url).length,           color: '#5A8B53', bg: '#E8F0E5' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 16px', minWidth: 80 }}>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', padding: isNarrow ? '0 16px 28px' : '0 28px 28px' }}>

          {/* Import / export de la liste des produits (fichier Excel) */}
          {(section === 'Tous' || section === 'Stock') && (
            <div style={{ background: '#fff', border: '1.5px solid var(--fs-wine-700)', borderRadius: 12, padding: '14px 16px', marginBottom: 24, boxShadow: 'var(--fs-shadow-sm)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fs-ink-900)' }}>📦 {t('Liste des produits — exporter / importer (Excel)', 'Product list — export / import (Excel)')}</div>
                <p style={{ fontSize: 11, color: 'var(--fs-ink-500)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  <strong>{t('Export', 'Export')}</strong>{t(' : fichier Excel (.xlsx) avec tous les produits, dans Téléchargements.', ': Excel file (.xlsx) with all products, saved to Downloads.')}
                  <strong> {t('Import', 'Import')}</strong>{t(' : rouvrez ce fichier modifié — les produits existants sont mis à jour, les nouvelles lignes créent des produits, une cellule vide ne change rien. Confirmation avant application.', ': reopen the edited file — existing products are updated, new rows create products, an empty cell changes nothing. Confirmation before applying.')}
                </p>
              </div>
              <ImportExportProduits products={products} onImported={() => getAllProducts().then(setProducts).catch(() => {})} addToast={addToast}/>
            </div>
          )}

          {Object.entries(toRender).map(([sec, items]) => (
            <div key={sec} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px' }}>{sectionLabel(sec)}</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isNarrow ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12 }}>
                {items.map(item => {
                  const fmt       = FORMAT_CONFIG[item.format];
                  const isLoading = downloading === item.id;
                  const hasApi    = !!item.url;
                  return (
                    <div key={item.id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px', boxShadow: 'var(--fs-shadow-sm)', display: 'flex', flexDirection: 'column', gap: 10, opacity: hasApi ? 1 : 0.7 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: fmt.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: fmt.color, flexShrink: 0 }}>
                            <FileIcon d={fmt.icon}/>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{item.title}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ background: fmt.bg, color: fmt.color, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{fmt.label}</span>
                              {hasApi && <span style={{ background: '#E8F0E5', color: '#3F6B3A', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>LIVE</span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p style={{ fontSize: 11, color: 'var(--fs-ink-500)', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{item.size} · {item.updated}</div>
                        <button
                          onClick={() => handleDownload(item)}
                          disabled={isLoading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', border: 'none', borderRadius: 8,
                            fontSize: 12, fontWeight: 700,
                            cursor: isLoading ? 'wait' : 'pointer',
                            background: isLoading ? 'var(--fs-ink-400)' : hasApi ? 'var(--fs-wine-700)' : 'var(--fs-ink-300)',
                            color: '#fff',
                            transition: 'opacity 0.15s',
                            minWidth: 120, justifyContent: 'center',
                          }}>
                          {isLoading
                            ? <><Spinner/> {t('Génération…', 'Generating…')}</>
                            : hasApi ? <><DownloadIcon/> {t('Télécharger', 'Download')}</> : <>{t('Bientôt disponible', 'Coming soon')}</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
