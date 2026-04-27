import React, { useCallback, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';

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

const today    = new Date().toISOString().split('T')[0];
const thisYear = new Date().getFullYear();
const thisMon  = new Date().getMonth() + 1;
const prevMon  = thisMon === 1 ? 12 : thisMon - 1;
const prevYear = thisMon === 1 ? thisYear - 1 : thisYear;
const PAD = (n: number) => String(n).padStart(2, '0');
const MON_LABEL = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

const EXPORTS: ExportItem[] = [
  {
    id: 'e1', title: 'Ventes du jour', section: 'Caisse',
    desc: 'Tous les tickets de la journée en cours',
    format: 'xlsx', size: '~48 Ko', updated: "Aujourd'hui",
    url: `/api/reports/daily/excel?date=${today}`,
    filename: `ventes-jour-${today}.xlsx`,
  },
  {
    id: 'e2', title: `Journal des ventes — ${MON_LABEL(thisYear, thisMon)}`, section: 'Caisse',
    desc: 'Historique complet des ventes du mois (détail + résumé par jour + résumé par caissier)',
    format: 'xlsx', size: '~320 Ko', updated: "Aujourd'hui 00:00",
    url: `/api/reports/monthly/excel?month=${thisMon}&year=${thisYear}`,
    filename: `journal-ventes-${thisYear}-${PAD(thisMon)}.xlsx`,
  },
  {
    id: 'e3', title: `Rapport mensuel — ${MON_LABEL(thisYear, thisMon)}`, section: 'Rapports',
    desc: 'CA, bénéfice, ventes par jour, top produits',
    format: 'pdf', size: '~1.2 Mo', updated: "Aujourd'hui 00:00",
    url: `/api/reports/monthly/pdf?month=${thisMon}&year=${thisYear}`,
    filename: `rapport-mensuel-${thisYear}-${PAD(thisMon)}.pdf`,
  },
  {
    id: 'e4', title: `Rapport mensuel — ${MON_LABEL(prevYear, prevMon)}`, section: 'Rapports',
    desc: `CA, bénéfice, synthèse ${MON_LABEL(prevYear, prevMon)}`,
    format: 'pdf', size: '~1.1 Mo', updated: `${new Date(prevYear, prevMon, 0).getDate()}/${PAD(prevMon)}/${prevYear}`,
    url: `/api/reports/monthly/pdf?month=${prevMon}&year=${prevYear}`,
    filename: `rapport-mensuel-${prevYear}-${PAD(prevMon)}.pdf`,
  },
  { id: 'e5',  title: 'Catalogue produits',       desc: 'Tous les produits avec prix, codes et catégories',  format: 'xlsx', section: 'Stock',        size: '~180 Ko', updated: 'Hier 22:00' },
  { id: 'e6',  title: 'État du stock',             desc: 'Quantités en stock par produit et dépôt',           format: 'xlsx', section: 'Stock',        size: '~95 Ko',  updated: "Aujourd'hui 08:00" },
  { id: 'e7',  title: 'Mouvements de stock',       desc: 'Entrées et sorties des 30 derniers jours',          format: 'csv',  section: 'Stock',        size: '~220 Ko', updated: "Aujourd'hui 08:00" },
  { id: 'e8',  title: `Fiche comptable — ${MON_LABEL(thisYear, thisMon)}`,  desc: 'Compte de résultat, TVA, charges et bénéfice',     format: 'pdf',  section: 'Comptabilité', size: '~650 Ko', updated: "Aujourd'hui 00:00" },
  { id: 'e9',  title: `Déclaration TVA — ${MON_LABEL(thisYear, thisMon)}`,  desc: 'TVA collectée, déductible et montant à reverser',  format: 'pdf',  section: 'Comptabilité', size: '~280 Ko', updated: "Aujourd'hui 00:00" },
  { id: 'e10', title: 'Liste des collaborateurs',  desc: 'Noms, rôles, postes et performances',               format: 'xlsx', section: 'Personnel',    size: '~60 Ko',  updated: 'Hier 18:00' },
  { id: 'e11', title: 'Performance caissiers',     desc: 'Ventes, CA et notation sur 30 jours',               format: 'xlsx', section: 'Personnel',    size: '~75 Ko',  updated: "Aujourd'hui 00:00" },
  { id: 'e12', title: "Journal d'audit",           desc: 'Toutes les actions sensibles tracées',              format: 'csv',  section: 'Système',      size: '~40 Ko',  updated: 'Temps réel' },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const FORMAT_CONFIG = {
  xlsx: { bg: '#E8F0E5', color: '#3F6B3A', label: 'Excel', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5' },
  pdf:  { bg: '#FAE5DF', color: '#8B2C1A', label: 'PDF',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h1M9 17h6' },
  csv:  { bg: '#EEF3FA', color: '#3A5E8F', label: 'CSV',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h4' },
};

const SECTIONS = ['Tous', 'Caisse', 'Rapports', 'Stock', 'Comptabilité', 'Personnel', 'Système'];

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

  const visible = section === 'Tous' ? EXPORTS : EXPORTS.filter(e => e.section === section);

  const handleDownload = useCallback(async (item: ExportItem) => {
    if (!item.url) {
      addToast('Ce rapport n\'est pas encore disponible.', 'warning');
      return;
    }
    setDownloading(item.id);
    try {
      const token = localStorage.getItem('access_token') ?? '';
      const response = await fetch(item.url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Erreur ${response.status}`);
      }
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = item.filename ?? item.title;
      link.click();
      URL.revokeObjectURL(link.href);
      addToast(`Fichier téléchargé : ${item.filename ?? item.title}`, 'success');
    } catch (err: any) {
      addToast(err.message ?? 'Erreur lors du téléchargement', 'error');
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
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Système</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Exports</h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SECTIONS.map(s => (
                <button key={s} onClick={() => setSection(s)}
                  style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: section === s ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color: section === s ? '#fff' : 'var(--fs-ink-500)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div style={{ display: 'flex', gap: 14, padding: '14px 28px', flexShrink: 0 }}>
          {[
            { label: 'Fichiers disponibles', value: EXPORTS.length,                             color: 'var(--fs-ink-700)', bg: '#fff' },
            { label: 'Excel',  value: EXPORTS.filter(e => e.format === 'xlsx').length,           color: '#3F6B3A', bg: '#E8F0E5' },
            { label: 'PDF',    value: EXPORTS.filter(e => e.format === 'pdf').length,             color: '#8B2C1A', bg: '#FAE5DF' },
            { label: 'CSV',    value: EXPORTS.filter(e => e.format === 'csv').length,             color: '#3A5E8F', bg: '#EEF3FA' },
            { label: 'Connectés à l\'API', value: EXPORTS.filter(e => !!e.url).length,           color: '#5A8B53', bg: '#E8F0E5' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 16px', minWidth: 80 }}>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          {Object.entries(toRender).map(([sec, items]) => (
            <div key={sec} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px' }}>{sec}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
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
                            ? <><Spinner/> Génération…</>
                            : <><DownloadIcon/> Télécharger</>}
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
