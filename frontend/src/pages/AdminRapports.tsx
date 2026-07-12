import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from 'recharts';
import AdminSidebar from '../components/AdminSidebar';
import { useIsMobile } from '../hooks/useIsMobile';
import { getBrandColor, displayName } from '../utils/text';
import ToastContainer, { useToast } from '../components/Toast';
import {
  getAnalyseMonth, getAnalyseWeek, downloadReport, getByProduct,
  AnalyseMonth, AnalyseWeek, CaissierData, ProductStat,
} from '../api/rapports';
import { getStatsPeriod, getComparisons, getMultiYear, PeriodDay, Comparisons, YearData } from '../api/dashboard';
import { getUsers, UserRecord } from '../api/auth';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');
const fmtM = (n: number) => n >= 1_000_000
  ? (n / 1_000_000).toFixed(2).replace('.', ',') + 'M'
  : Math.round(n / 1_000) + 'K';
const fmtK = (n: number) => Math.round(n / 1_000) + 'K';

function buildMonths(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      short: d.toLocaleDateString('fr-FR', { month: 'short' }),
      label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  });
}
const MONTHS = buildMonths(6);

// ── Couleurs catégories ───────────────────────────────────────────────────────

const CAT_COLOR_MAP: Record<string, string> = {
  beauté:      '#F5C4B2', épicerie:    '#EDD8A0',
  hygiène:     '#B8D8EC', boissons:    '#B4DCC4',
  parfumerie:  '#D8C4E8', cosmétiques: '#F7C6D1',
  alimentaire: '#C6E4C6', nettoyage:   '#FFDFA8',
  santé:       '#C8D8F0', autres:      '#DDD4C8',
};
const CAT_PALETTE = Object.values(CAT_COLOR_MAP);

function catColor(name: string, idx: number): string {
  const key = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  return CAT_COLOR_MAP[key] ?? CAT_PALETTE[idx % CAT_PALETTE.length];
}

// ── Couleurs & initiales caissiers ────────────────────────────────────────────

const CAISSIER_COLORS = ['#C2566B','#7A9EC2','#C2A07A','#9A7AC2','#7AC29A','#C2C27A'];
const MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'];

function initials(nom: string) {
  return nom.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function pctVs(a: number, b: number) {
  if (b === 0) return null;
  return ((a - b) / b * 100).toFixed(1);
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
// Créneaux 7h→21h par intervalles de 2h : [7,9,11,13,15,17,19] (7 slots)
const SLOT_STARTS = [7, 9, 11, 13, 15, 17, 19];

function Heatmap({ data }: { data: number[][] }) {
  // Agréger chaque slot = moyenne des 2 heures
  const slotData: number[][] = DAYS_FR.map((_, di) =>
    SLOT_STARTS.map(h => {
      const a = data[di]?.[h]   ?? 0;
      const b = data[di]?.[h+1] ?? 0;
      return (a + b) / 2;
    }),
  );
  const hasData = slotData.some(row => row.some(v => v > 0));
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, paddingLeft: 32 }}>
        {SLOT_STARTS.map(h => (
          <div key={h} style={{ flex: '0 0 24px', fontSize: 9, color: 'var(--fs-ink-400)', textAlign: 'center' }}>{h}h</div>
        ))}
      </div>
      {DAYS_FR.map((day, di) => (
        <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <div style={{ width: 28, fontSize: 10, color: 'var(--fs-ink-400)', flexShrink: 0 }}>{day}</div>
          {slotData[di].map((v, si) => (
            <div key={si} style={{
              flex: '0 0 24px', height: 18, borderRadius: 3, flexShrink: 0,
              background: v === 0
                ? 'var(--fs-line)'
                : `rgba(122,29,46,${Math.max(v, 0.1).toFixed(2)})`,
            }} title={`${day} ${SLOT_STARTS[si]}h-${SLOT_STARTS[si]+2}h : ${Math.round(v * 100)}%`}/>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, paddingLeft: 30 }}>
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Faible</span>
        {[0.15,0.35,0.55,0.75,0.95].map(v => (
          <div key={v} style={{ width: 13, height: 13, borderRadius: 2, background: `rgba(122,29,46,${v})` }}/>
        ))}
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Élevé</span>
      </div>
      {!hasData && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 10 }}>
          Aucune donnée disponible
        </div>
      )}
    </div>
  );
}

// ── Tooltip bar chart ─────────────────────────────────────────────────────────

function BarTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, padding: '6px 10px', fontSize: 11, boxShadow: 'var(--fs-shadow-md)' }}>
      <div style={{ fontWeight: 700, color: 'var(--fs-ink-500)', marginBottom: 2 }}>Jour {label}</div>
      <div style={{ fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(payload[0].value)} XAF</div>
      {payload[0].payload?.nbVentes > 0 && (
        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 2 }}>{payload[0].payload.nbVentes} vente{payload[0].payload.nbVentes > 1 ? 's' : ''}</div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  const box = (h: number, w?: string) => (
    <div style={{ height: h, width: w ?? '100%', background: 'var(--fs-line)', borderRadius: 6, marginBottom: 8 }} />
  );
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
        <div style={{ flex: 2, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20 }}>{box(40)}{box(14,'60%')}{box(12,'40%')}</div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20 }}>{box(30)}{box(14,'50%')}</div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20 }}>{box(30)}{box(14,'50%')}</div>
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, height: 260 }}>{box(16,'40%')}{box(180)}</div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fs-ink-400)' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune vente enregistrée</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Les données de {label} apparaîtront ici dès la première vente.</div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AdminRapports() {
  const { toasts, addToast, removeToast } = useToast();
  const brand = getBrandColor();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);

  const [viewMode, setViewMode] = useState<'mensuel' | 'semaine'>('mensuel');

  // ── Mode mensuel ──────────────────────────────────────────────────────────
  const [monthIdx,   setMonthIdx]   = useState(0);
  const [data,       setData]       = useState<AnalyseMonth | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [exporting,  setExporting]  = useState<'pdf' | 'excel' | null>(null);

  // ── Mode semaine ──────────────────────────────────────────────────────────
  const currentISOWeek = (() => {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const y = d.getFullYear();
    const w = Math.ceil(((d.getTime() - new Date(y, 0, 1).getTime()) / 86400000 + 1) / 7);
    return { year: y, week: w };
  })();
  const [weekYear, setWeekYear] = useState(currentISOWeek.year);
  const [weekNum,  setWeekNum]  = useState(currentISOWeek.week);
  const [weekData, setWeekData] = useState<AnalyseWeek | null>(null);
  const [monthlyStats,    setMonthlyStats]    = useState<PeriodDay[]>([]);
  const [comparisons,     setComparisons]     = useState<Comparisons | null>(null);
  const [byProduct,       setByProduct]       = useState<ProductStat[]>([]);
  const [caissierNames,   setCaissierNames]   = useState<Set<string>>(new Set());
  const [multiYear,       setMultiYear]       = useState<YearData[]>([]);

  // ── Graphiques tickets ────────────────────────────────────────────────────
  type TicketTab = 'Sem' | 'Mois' | 'T1' | 'T2' | 'T3' | 'T4' | 'An';
  const [ticketTab,  setTicketTab]  = useState<TicketTab>('Mois');
  const [ticketData, setTicketData] = useState<PeriodDay[]>([]);

  const getTicketRange = (tab: TicketTab) => {
    const now = new Date(); const y = now.getFullYear();
    if (tab === 'Sem') { const s = new Date(now); s.setDate(s.getDate() - 6); return { dateFrom: s.toISOString().slice(0,10), dateTo: now.toISOString().slice(0,10) }; }
    if (tab === 'Mois') { const s = new Date(y, now.getMonth(), 1); return { dateFrom: s.toISOString().slice(0,10), dateTo: now.toISOString().slice(0,10) }; }
    if (tab === 'T1') return { dateFrom: `${y}-01-01`, dateTo: `${y}-03-31` };
    if (tab === 'T2') return { dateFrom: `${y}-04-01`, dateTo: `${y}-06-30` };
    if (tab === 'T3') return { dateFrom: `${y}-07-01`, dateTo: `${y}-09-30` };
    if (tab === 'T4') return { dateFrom: `${y}-10-01`, dateTo: `${y}-12-31` };
    return { dateFrom: `${y}-01-01`, dateTo: now.toISOString().slice(0,10) };
  };

  useEffect(() => {
    const range = getTicketRange(ticketTab);
    getStatsPeriod(7, range).then(setTicketData).catch(() => {});
  }, [ticketTab]);
  const [prodDateFrom, setProdDateFrom] = useState('');
  const [prodDateTo,   setProdDateTo]   = useState('');
  const [prodLoading,  setProdLoading]  = useState(false);
  // Tri + recherche du tableau « Journal des ventes par produit » (REC#5)
  const [prodSearch, setProdSearch] = useState('');
  const [prodSort, setProdSort] = useState<{ key: keyof ProductStat; dir: 'asc' | 'desc' }>({ key: 'caGenere', dir: 'desc' });
  const toggleProdSort = (key: keyof ProductStat) =>
    setProdSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' });
  const [prodExporting, setProdExporting] = useState(false);

  const { year, month, label } = MONTHS[monthIdx];

  const load = useCallback(async () => {
    setLoading(true); setData(null);
    try { setData(await getAnalyseMonth(year, month)); }
    catch { addToast('Erreur chargement du rapport', 'error'); }
    finally { setLoading(false); }
  }, [year, month, addToast]);

  const loadWeek = useCallback(async () => {
    setLoading(true); setWeekData(null);
    try { setWeekData(await getAnalyseWeek(weekYear, weekNum)); }
    catch { addToast('Erreur chargement du rapport hebdomadaire', 'error'); }
    finally { setLoading(false); }
  }, [weekYear, weekNum, addToast]);

  useEffect(() => {
    if (viewMode === 'mensuel') load();
    else loadWeek();
  }, [viewMode, load, loadWeek]);

  const navWeek = (delta: number) => {
    let w = weekNum + delta, y = weekYear;
    if (w < 1)  { y--; w = 52; }
    if (w > 53) { y++; w = 1;  }
    setWeekYear(y); setWeekNum(w);
  };
  const isCurrentWeekOrFuture = weekYear > currentISOWeek.year ||
    (weekYear === currentISOWeek.year && weekNum >= currentISOWeek.week);

  // Chargement unique des stats globales (comparaisons + 12 mois + caissiers)
  useEffect(() => {
    getStatsPeriod(365).then(setMonthlyStats).catch(() => {});
    getComparisons().then(setComparisons).catch(() => {});
    getByProduct().then(setByProduct).catch(() => {});
    getUsers().then(us => {
      setCaissierNames(new Set(us.filter(u => u.role === 'caissier').map(u => u.name)));
    }).catch(() => {});
    getMultiYear(5).then(setMultiYear).catch(() => {});
  }, []);

  const loadByProduct = async () => {
    setProdLoading(true);
    try { setByProduct(await getByProduct({ dateFrom: prodDateFrom || undefined, dateTo: prodDateTo || undefined })); }
    catch { addToast('Erreur chargement journal produits', 'error'); }
    finally { setProdLoading(false); }
  };

  async function handleExport(type: 'pdf' | 'excel') {
    setExporting(type);
    try {
      await downloadReport(type, year, month);
    } catch {
      addToast(`Erreur export ${type.toUpperCase()}`, 'error');
    } finally {
      setExporting(null);
    }
  }

  // Export PDF (côté client) du journal des ventes par produit.
  async function exportByProductPdf() {
    if (byProduct.length === 0) { addToast('Aucune donnée à exporter', 'error'); return; }
    setProdExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const num = (n: number) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      const trunc = (s: string, max = 52) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
      const margin = 14;
      // Colonnes (A4 = 210mm de large)
      const cX = { nom: margin, qte: 120, ca: 154, nb: 176, moy: 196 };

      // En-tête à la couleur de la boutique
      const rgb: [number, number, number] = /^#[0-9A-Fa-f]{6}$/.test(brand)
        ? [parseInt(brand.slice(1, 3), 16), parseInt(brand.slice(3, 5), 16), parseInt(brand.slice(5, 7), 16)]
        : [139, 26, 43];
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(0, 0, 210, 22, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text('Journal des ventes par produit', margin, 14);
      let y = 30;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
      const periode = (prodDateFrom || prodDateTo)
        ? `Période : ${prodDateFrom || '…'} → ${prodDateTo || '…'}`
        : 'Toutes périodes';
      doc.text(`${periode}  ·  ${byProduct.length} produit(s)  ·  édité le ${new Date().toLocaleDateString('fr-FR')}`, margin, y);
      y += 8;

      const header = () => {
        doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('Produit', cX.nom, y);
        doc.text('Qté vendue', cX.qte, y, { align: 'right' });
        doc.text('CA généré', cX.ca, y, { align: 'right' });
        doc.text('Nb tr.', cX.nb, y, { align: 'right' });
        doc.text('Prix moy.', cX.moy, y, { align: 'right' });
        y += 2; doc.setDrawColor(180); doc.line(margin, y, 196, y); y += 5;
      };
      header();

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      let totalQte = 0, totalCA = 0;
      for (const p of byProduct) {
        if (y > 285) { doc.addPage(); y = 18; header(); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); }
        doc.setTextColor(20);
        doc.text(trunc(displayName(p.name)), cX.nom, y);
        doc.text(num(p.qtySold), cX.qte, y, { align: 'right' });
        doc.text(num(p.caGenere), cX.ca, y, { align: 'right' });
        doc.text(num(p.nbTransactions), cX.nb, y, { align: 'right' });
        doc.text(num(p.prixMoyenVente), cX.moy, y, { align: 'right' });
        y += 5.5;
        totalQte += p.qtySold; totalCA += p.caGenere;
      }
      // Total
      y += 1; doc.setDrawColor(120); doc.line(margin, y, 196, y); y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', cX.nom, y);
      doc.text(num(totalQte), cX.qte, y, { align: 'right' });
      doc.text(`${num(totalCA)} XAF`, cX.ca, y, { align: 'right' });

      doc.save(`ventes-par-produit-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      addToast('Erreur export PDF', 'error');
    } finally {
      setProdExporting(false);
    }
  }

  // ── Données dérivées ──────────────────────────────────────────────────────

  const d = data;
  const capLabel    = label.charAt(0).toUpperCase() + label.slice(1);
  const margeNette  = d && d.ca > 0 ? ((d.beneficeNet / d.ca) * 100).toFixed(1) : '0.0';
  const evoPct      = d ? pctVs(d.ca, d.prevCA) : null;
  const avgDaily    = d && d.parJour.length > 0
    ? Math.round(d.ca / d.parJour.filter(j => j.ca > 0).length || 1)
    : 0;
  const picJour     = d ? d.parJour.reduce((best, j) => j.ca > best.ca ? j : best, { jour: 0, ca: 0, nbVentes: 0 }) : null;

  const chartData = d?.parJour.map(j => ({
    day:      j.jour,
    value:    j.ca,
    nbVentes: j.nbVentes,
    isWE:     [0, 6].includes(new Date(year, month - 1, j.jour).getDay()),
  })) ?? [];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: isNarrow ? 'stretch' : 'center', flexDirection: isNarrow ? 'column' : 'row', justifyContent: 'space-between', gap: isNarrow ? 10 : 10, flexWrap: 'wrap' }}>
            <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Rapports & Analyses — Mensuel</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
                Rapport mensuel — {capLabel}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Sélecteur mois */}
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {MONTHS.map((m, i) => (
                  <button key={`${m.year}-${m.month}`} onClick={() => setMonthIdx(i)} style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: monthIdx === i ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color:      monthIdx === i ? '#fff'               : 'var(--fs-ink-500)',
                    textTransform: 'capitalize',
                  }}>{m.short}</button>
                ))}
              </div>
              {/* Exports */}
              <button onClick={() => handleExport('excel')} disabled={exporting !== null || !d || d.nbVentes === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: '#1D7A4E', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (exporting !== null || !d || d.nbVentes === 0) ? 0.5 : 1 }}>
                ⬇ {exporting === 'excel' ? '…' : 'Excel'}
              </button>
              <button onClick={() => handleExport('pdf')} disabled={exporting !== null || !d || d.nbVentes === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--fs-wine-700)', background: 'none', color: 'var(--fs-wine-700)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (exporting !== null || !d || d.nbVentes === 0) ? 0.5 : 1 }}>
                ⬇ {exporting === 'pdf' ? '…' : 'PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Corps */}
        {/* cursor/userSelect : flèche standard sur tout le contenu non cliquable (REC#1) —
            les boutons/onglets gardent leur cursor:pointer propre, les th triables aussi */}
        <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', padding: isNarrow ? '18px 16px 28px' : '18px 28px 28px', cursor: 'default', userSelect: 'none' }}>

          {loading ? (
            <Skeleton />
          ) : !d || d.nbVentes === 0 ? (
            <EmptyState label={label} />
          ) : (
            <>
              {/* KPI cards */}
              <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', gap: 16, marginBottom: 18 }}>
                {/* CA — grande carte bordeaux */}
                <div style={{ flex: 2, background: 'var(--fs-wine-800)', borderRadius: 12, padding: '20px 24px', color: '#fff', minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,235,217,0.5)', marginBottom: 10 }}>
                    Chiffre d'affaires — {capLabel}
                  </div>
                  <div style={{ fontSize: 38, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 12 }}>
                    {fmtM(d.ca)} <span style={{ fontSize: 18 }}>XAF</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {evoPct !== null && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: parseFloat(evoPct) >= 0 ? 'var(--fs-gold-300)' : '#F5A0A0' }}>
                        {parseFloat(evoPct) >= 0 ? '+' : ''}{evoPct}% vs mois préc.
                      </div>
                    )}
                    {d.prevCA === 0 && (
                      <div style={{ fontSize: 12, color: 'rgba(245,235,217,0.4)' }}>Premier mois enregistré</div>
                    )}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(245,235,217,0.4)' }}>
                    {d.nbVentes} ticket{d.nbVentes > 1 ? 's' : ''} · panier moy. {fmtN(d.panierMoyen)} XAF
                  </div>
                </div>

                {/* Bénéfice net */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 10 }}>Bénéfice net</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: d.beneficeNet >= 0 ? 'var(--fs-ink-900)' : 'var(--fs-danger-700)', lineHeight: 1, marginBottom: 6 }}>
                    {fmtM(d.beneficeNet)} <span style={{ fontSize: 13 }}>XAF</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
                    Marge nette : <b style={{ color: d.beneficeNet >= 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' }}>{margeNette} %</b>
                  </div>
                  {d.depenses > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 4 }}>
                      Dépenses : {fmtM(d.depenses)} XAF
                    </div>
                  )}
                </div>

                {/* Tickets & panier */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 10 }}>Tickets · Panier moyen</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1, marginBottom: 6 }}>
                    {fmtN(d.nbVentes)} <span style={{ fontSize: 13, fontWeight: 600 }}>tickets</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
                    Panier : <b style={{ color: 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(d.panierMoyen)} XAF</b>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 4 }}>
                    Moy. quotidienne : {fmtK(avgDaily)} XAF
                  </div>
                </div>
              </div>

              {/* Bar chart ventes journalières */}
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Ventes journalières · {d.parJour.length} jours</div>
                    {picJour && picJour.ca > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>
                        Pic le {picJour.jour} — {fmtK(picJour.ca)} XAF ({picJour.nbVentes} ventes)
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Moyenne journée active</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{fmtK(avgDaily)} XAF</div>
                  </div>
                </div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={9}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 10)}/>
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={36}/>
                      <Tooltip content={<BarTip/>}/>
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {chartData.map((cd, i) => (
                          <Cell key={i} fill={cd.value === 0 ? '#E5E7EB' : cd.isWE ? '#D1A660' : brand}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fs-ink-500)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: brand }}/> Jours semaine
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fs-ink-500)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: '#D1A660' }}/> Week-ends
                  </div>
                </div>
              </div>

              {/* Section basse : 3 colonnes */}
              <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', gap: 16, alignItems: isNarrow ? 'stretch' : 'flex-start' }}>

                {/* Catégories produits */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Par catégorie</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Répartition du CA mensuel</div>
                  {d.parCategorie.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', textAlign: 'center', padding: '24px 0' }}>Catégories non renseignées</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {d.parCategorie.slice(0, 7).map((cat, idx) => (
                        <div key={cat.categorie}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: catColor(cat.categorie, idx) }}/>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{cat.categorie}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{fmtN(cat.ca)}</span>
                              <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginLeft: 6 }}>{cat.pct}%</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: 'var(--fs-line)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${cat.pct}%`, background: catColor(cat.categorie, idx), borderRadius: 3 }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Classement caissiers */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Classement caissiers</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Performances individuelles · CA généré</div>
                  {(caissierNames.size > 0
                      ? d.parCaissier.filter((c: CaissierData) => caissierNames.has(c.nom))
                      : d.parCaissier
                    ).length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', textAlign: 'center', padding: '24px 0' }}>
                      Aucune donnée caissier disponible
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {(caissierNames.size > 0
                        ? d.parCaissier.filter((c: CaissierData) => caissierNames.has(c.nom))
                        : d.parCaissier
                      ).map((c: CaissierData, i: number) => (
                        <div key={c.nom} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{MEDALS[i] ?? `${i + 1}.`}</span>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: CAISSIER_COLORS[i % CAISSIER_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {initials(c.nom)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{c.nom}</div>
                            <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>
                              {c.nbVentes} vente{c.nbVentes > 1 ? 's' : ''} · panier {fmtN(c.panierMoyen)}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', flexShrink: 0 }}>
                            {fmtN(c.ca)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Heatmap affluence horaire */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Affluence horaire</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Intensité des ventes par jour et heure</div>
                  <div style={{ overflowX: 'auto' }}>
                    <Heatmap data={d.heatmap}/>
                  </div>
                </div>
              </div>

              {/* Top produits */}
              {d.topProduits.length > 0 && (
                <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Top produits</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Les 10 meilleurs produits par CA généré</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {d.topProduits.map((p, i) => (
                      <div key={p.nom} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--fs-ivory)', borderRadius: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--fs-wine-50)', color: 'var(--fs-wine-700)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(p.nom)}</div>
                          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{p.quantite} unité{p.quantite > 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', flexShrink: 0 }}>
                          {fmtN(p.ca)} XAF
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Statistiques tickets — trimestriel / mensuel */}
              {monthlyStats.length > 0 && (() => {
                const curYear = new Date().getFullYear();
                // Construire les 4 trimestres + annuel depuis monthlyStats
                const qtrOf = (m: PeriodDay) => {
                  const mo = new Date(m.date + 'T12:00:00').getMonth() + 1;
                  return mo <= 3 ? 1 : mo <= 6 ? 2 : mo <= 9 ? 3 : 4;
                };
                const sameYear = monthlyStats.filter(m => new Date(m.date + 'T12:00:00').getFullYear() === curYear);
                const qtrs = [1, 2, 3, 4].map(q => {
                  const rows = sameYear.filter(m => qtrOf(m) === q);
                  const nb = rows.reduce((s, r) => s + r.nbVentes, 0);
                  const ca = rows.reduce((s, r) => s + r.totalCA, 0);
                  const mins = rows.filter(r => r.minTicket > 0).map(r => r.minTicket);
                  return {
                    label: `T${q} ${curYear}`, nb, ca,
                    min: mins.length > 0 ? Math.min(...mins) : 0,
                    max: rows.length > 0 ? Math.max(...rows.map(r => r.maxTicket)) : 0,
                    avg: nb > 0 ? Math.round(ca / nb) : 0,
                  };
                });
                const annual = {
                  label: `Annuel ${curYear}`,
                  nb: qtrs.reduce((s, q) => s + q.nb, 0),
                  ca: qtrs.reduce((s, q) => s + q.ca, 0),
                  min: Math.min(...qtrs.filter(q => q.min > 0).map(q => q.min).concat([0])),
                  max: Math.max(...qtrs.map(q => q.max), 0),
                  avg: 0,
                };
                annual.avg = annual.nb > 0 ? Math.round(annual.ca / annual.nb) : 0;

                const statsRows = [...qtrs, annual];
                const TDR: React.CSSProperties = { padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', borderBottom: '1px solid var(--fs-line)' };
                return (
                  <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Statistiques tickets — {curYear}</div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>T1 · T2 · T3 · T4 · Annuel — MIN / MAX / MOYENNE par ticket</div>
                    <div style={{ overflowX: 'auto' }}>
                    <table className="fs-grid" style={{ width: '100%', minWidth: isNarrow ? 560 : undefined, borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--fs-ivory)' }}>
                          {['Période', 'Nb tickets', 'CA total', 'MIN', 'MAX', 'Moyenne'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Période' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {statsRows.map((row, i) => (
                          <tr key={row.label} style={{ background: i === statsRows.length - 1 ? 'var(--fs-wine-50)' : i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: i === statsRows.length - 1 ? 800 : 600, color: 'var(--fs-ink-800)', borderBottom: '1px solid var(--fs-line)' }}>{row.label}</td>
                            <td style={{ ...TDR, color: 'var(--fs-ink-700)' }}>{row.nb || '—'}</td>
                            <td style={{ ...TDR, fontWeight: 700, color: 'var(--fs-wine-700)' }}>{row.ca > 0 ? fmtN(row.ca) : '—'}</td>
                            <td style={{ ...TDR, color: '#7AB87A' }}>{row.nb > 0 ? fmtN(row.min) : '—'}</td>
                            <td style={{ ...TDR, color: '#D1A660' }}>{row.nb > 0 ? fmtN(row.max) : '—'}</td>
                            <td style={{ ...TDR, color: 'var(--fs-ink-800)' }}>{row.nb > 0 ? fmtN(row.avg) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* ── Comparaison 5 dernières années ── */}
          {multiYear.length > 0 && (() => {
            const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
            const YEAR_COLORS = [brand,'#D1A660','#7A9EC2','#7AB87A','#9A7AC2'];
            const chartData = MONTHS_FR.map((m, mi) => {
              const entry: Record<string, string | number> = { month: m };
              multiYear.forEach(y => { entry[String(y.year)] = y.months[mi]; });
              return entry;
            });
            return (
              <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Comparaison des 5 dernières années</div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Évolution du CA mensuel par année · XAF</div>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={38}/>
                      <Tooltip formatter={(v: number) => `${fmtN(v)} XAF`} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 8, border: '1px solid var(--fs-line)', fontSize: 12 }}/>
                      <Legend wrapperStyle={{ fontSize: 11 }}/>
                      {multiYear.map((y, i) => (
                        <Line key={y.year} type="monotone" dataKey={String(y.year)} stroke={YEAR_COLORS[i % YEAR_COLORS.length]} strokeWidth={y.year === new Date().getFullYear() ? 2.5 : 1.5} dot={false} name={String(y.year)}/>
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {multiYear.map((y, i) => (
                    <div key={y.year} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 3, borderRadius: 2, background: YEAR_COLORS[i % YEAR_COLORS.length] }}/>
                      <span style={{ fontSize: 11, color: 'var(--fs-ink-600)', fontWeight: 600 }}>{y.year} : <span style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtM(y.totalCA)} XAF</span></span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Comparaisons (hors filtre mois) ── */}
          {comparisons && (
            <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Comparaisons de périodes</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 16 }}>Semaine · Mois · Année — CA, Tickets (nb, montant MIN/MAX/MOY) vs période précédente</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { label: 'Semaine en cours', curr: comparisons.week,  prev: comparisons.prevWeek,  icon: '📅' },
                  { label: 'Mois en cours',    curr: comparisons.month, prev: comparisons.prevMonth, icon: '🗓️' },
                  { label: 'Année en cours',   curr: comparisons.year,  prev: comparisons.prevYear,  icon: '📆' },
                ] as const).map(({ label, curr, prev, icon }) => {
                  const metrics = [
                    { name: 'CA Total',    curr: curr.ca,  prev: prev.ca,  fmt: (v: number) => `${fmtN(v)} XAF` },
                    { name: 'Nb Tickets',  curr: curr.nb,  prev: prev.nb,  fmt: (v: number) => String(v) },
                    { name: 'MIN Ticket',  curr: curr.min, prev: prev.min, fmt: (v: number) => `${fmtN(v)} XAF` },
                    { name: 'MAX Ticket',  curr: curr.max, prev: prev.max, fmt: (v: number) => `${fmtN(v)} XAF` },
                    { name: 'MOY Ticket',  curr: curr.avg, prev: prev.avg, fmt: (v: number) => `${fmtN(v)} XAF` },
                  ];
                  return (
                    <div key={label} style={{ border: '1px solid var(--fs-line)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: 'var(--fs-ivory)', padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-800)' }}>{icon} {label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                        {metrics.map((m, mi) => {
                          const pct = prev.ca > 0 || m.name !== 'CA' ? (m.prev > 0 ? ((m.curr - m.prev) / m.prev * 100) : null) : null;
                          const up  = pct !== null && pct >= 0;
                          return (
                            <div key={m.name} style={{ flex: '1 1 90px', padding: '10px 14px', borderLeft: mi > 0 ? '1px solid var(--fs-line)' : 'none', borderTop: '1px solid var(--fs-line)' }}>
                              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fs-ink-400)', marginBottom: 4 }}>{m.name}</div>
                              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{m.fmt(m.curr)}</div>
                              {pct !== null ? (
                                <>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: up ? '#16A34A' : '#DC2626', marginTop: 2 }}>
                                    {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                                  </div>
                                  <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', marginTop: 1 }}>
                                    vs {m.fmt(m.prev)} (période préc.)
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontSize: 10, color: 'var(--fs-ink-300)', marginTop: 2 }}>Pas de référence (période préc. vide)</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Graphiques tickets ── */}
          {(() => {
            const tabs: TicketTab[] = ['Sem','Mois','T1','T2','T3','T4','An'];
            const hasData = ticketData.some(r => r.nbVentes > 0);
            const fmtXKey = (r: PeriodDay) => r.label ?? String(r.date);
            return (
              <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                {/* Header + onglets */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Statistiques tickets</div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Nb tickets · MIN · MAX · MOY par période</div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {tabs.map(t => (
                      <button key={t} onClick={() => setTicketTab(t)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: ticketTab === t ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                        color: ticketTab === t ? '#fff' : 'var(--fs-ink-400)',
                      }}>{t}</button>
                    ))}
                  </div>
                </div>

                {!hasData ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fs-ink-300)', fontSize: 12 }}>Aucune donnée pour cette période</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 16 }}>

                    {/* Nb tickets */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        Nb tickets — total : {ticketData.reduce((s, r) => s + r.nbVentes, 0)}
                      </div>
                      <div style={{ height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ticketData} barSize={8} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                            <XAxis dataKey={fmtXKey} tick={{ fontSize: 8, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(ticketData.length / 8) - 1)}/>
                            <YAxis tick={{ fontSize: 8, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={24} allowDecimals={false}/>
                            <Tooltip formatter={(v: number) => [v, 'Tickets']} contentStyle={{ borderRadius: 8, fontSize: 11 }}/>
                            <Bar dataKey="nbVentes" fill={brand} radius={[2,2,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* MIN / MAX / MOY */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        MIN · MAX · MOY ticket (XAF)
                      </div>
                      <div style={{ height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={ticketData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                            <XAxis dataKey={fmtXKey} tick={{ fontSize: 8, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(ticketData.length / 8) - 1)}/>
                            <YAxis tickFormatter={fmtK} tick={{ fontSize: 8, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={36}/>
                            <Tooltip formatter={(v: number) => [`${fmtN(v)} XAF`]} contentStyle={{ borderRadius: 8, fontSize: 11 }}/>
                            <Legend wrapperStyle={{ fontSize: 10 }}/>
                            <Line type="monotone" dataKey="minTicket" stroke="#7AB87A" strokeWidth={1.5} dot={false} name="MIN"/>
                            <Line type="monotone" dataKey="avgTicket" stroke={brand} strokeWidth={2} dot={false} name="MOY"/>
                            <Line type="monotone" dataKey="maxTicket" stroke="#D1A660" strokeWidth={1.5} dot={false} name="MAX"/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Mini KPIs récap */}
                    {ticketData.length > 0 && (() => {
                      const rows = ticketData.filter(r => r.nbVentes > 0);
                      if (!rows.length) return null;
                      const totalNb  = rows.reduce((s, r) => s + r.nbVentes, 0);
                      const globalMin = Math.min(...rows.map(r => r.minTicket ?? 0).filter(v => v > 0));
                      const globalMax = Math.max(...rows.map(r => r.maxTicket ?? 0));
                      const globalAvg = rows.reduce((s, r) => s + r.totalCA, 0) / totalNb;
                      return (
                        <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginTop: 4 }}>
                          {[
                            { label: 'Total tickets',  val: fmtN(totalNb),        color: 'var(--fs-wine-700)' },
                            { label: 'Ticket MIN',     val: `${fmtN(globalMin)} XAF`, color: '#7AB87A' },
                            { label: 'Ticket MAX',     val: `${fmtN(globalMax)} XAF`, color: '#D1A660' },
                            { label: 'Ticket MOY',     val: `${fmtN(Math.round(globalAvg))} XAF`, color: 'var(--fs-ink-800)' },
                          ].map(s => (
                            <div key={s.label} style={{ background: 'var(--fs-ivory)', borderRadius: 8, padding: '10px 14px', textAlign: 'center', border: '1px solid var(--fs-line)' }}>
                              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fs-ink-400)', marginBottom: 5 }}>{s.label}</div>
                              <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.val}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Graphique CA (MIN/MAX/MOY par période) ── */}
          {(() => {
            const tabs: TicketTab[] = ['Sem','Mois','T1','T2','T3','T4','An'];
            const rows = ticketData.filter(r => r.nbVentes > 0);
            const hasData = rows.length > 0;
            const fmtXKey = (r: PeriodDay) => r.label ?? String(r.date);
            const caVals = rows.map(r => r.totalCA);
            const caTotal = caVals.reduce((s, v) => s + v, 0);
            const caMin = hasData ? Math.min(...caVals) : 0;
            const caMax = hasData ? Math.max(...caVals) : 0;
            const caMoy = hasData ? caTotal / caVals.length : 0;
            return (
              <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Statistiques CA</div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Chiffre d'affaires · MIN · MAX · MOY par période</div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {tabs.map(t => (
                      <button key={t} onClick={() => setTicketTab(t)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: ticketTab === t ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                        color: ticketTab === t ? '#fff' : 'var(--fs-ink-400)',
                      }}>{t}</button>
                    ))}
                  </div>
                </div>

                {!hasData ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fs-ink-300)', fontSize: 12 }}>Aucune donnée pour cette période</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 16 }}>

                    {/* CA par période (barres) */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        CA par période (XAF)
                      </div>
                      <div style={{ height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ticketData} barSize={8} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                            <XAxis dataKey={fmtXKey} tick={{ fontSize: 8, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(ticketData.length / 8) - 1)}/>
                            <YAxis tickFormatter={fmtK} tick={{ fontSize: 8, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={36}/>
                            <Tooltip formatter={(v: number) => [`${fmtN(v)} XAF`, 'CA']} contentStyle={{ borderRadius: 8, fontSize: 11 }}/>
                            <Bar dataKey="totalCA" fill={brand} radius={[2,2,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* CA cumulé (ligne) — progression du CA additionné au fil de la période */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        CA cumulé (XAF) — progression vers le total
                      </div>
                      <div style={{ height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={(() => { let cum = 0; return ticketData.map(r => ({ ...r, caCumule: (cum += r.totalCA) })); })()} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                            <XAxis dataKey={fmtXKey} tick={{ fontSize: 8, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(ticketData.length / 8) - 1)}/>
                            <YAxis tickFormatter={fmtK} tick={{ fontSize: 8, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={36}/>
                            <Tooltip formatter={(v: number) => [`${fmtN(v)} XAF`, 'CA cumulé']} contentStyle={{ borderRadius: 8, fontSize: 11 }}/>
                            <Line type="monotone" dataKey="caCumule" stroke={brand} strokeWidth={2} dot={false} name="CA cumulé"/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* KPIs CA */}
                    <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginTop: 4 }}>
                      {[
                        { label: 'CA total', val: `${fmtN(caTotal)} XAF`,            color: 'var(--fs-wine-700)' },
                        { label: 'CA MIN',   val: `${fmtN(caMin)} XAF`,              color: '#7AB87A' },
                        { label: 'CA MAX',   val: `${fmtN(caMax)} XAF`,              color: '#D1A660' },
                        { label: 'CA MOY',   val: `${fmtN(Math.round(caMoy))} XAF`,  color: 'var(--fs-ink-800)' },
                      ].map(s => (
                        <div key={s.label} style={{ background: 'var(--fs-ivory)', borderRadius: 8, padding: '10px 14px', textAlign: 'center', border: '1px solid var(--fs-line)' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fs-ink-400)', marginBottom: 5 }}>{s.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Journal par produit ── */}
          <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Journal des ventes par produit</div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{byProduct.length} produit{byProduct.length !== 1 ? 's' : ''} · toutes périodes si aucun filtre</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <input type="text" value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="🔎 Filtrer un produit…"
                  style={{ padding: '6px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, width: 170 }} />
                <input type="date" value={prodDateFrom} onChange={e => setProdDateFrom(e.target.value)}
                  style={{ padding: '6px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12 }} />
                <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>→</span>
                <input type="date" value={prodDateTo} onChange={e => setProdDateTo(e.target.value)}
                  style={{ padding: '6px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12 }} />
                <button onClick={loadByProduct} disabled={prodLoading}
                  style={{ padding: '6px 14px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: prodLoading ? 0.6 : 1 }}>
                  {prodLoading ? '…' : 'Filtrer'}
                </button>
                <button onClick={exportByProductPdf} disabled={prodExporting || byProduct.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (prodExporting || byProduct.length === 0) ? 0.5 : 1 }}>
                  ⬇ {prodExporting ? '…' : 'PDF'}
                </button>
              </div>
            </div>
            {byProduct.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fs-ink-400)', fontSize: 12 }}>Aucune donnée disponible</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="fs-grid" style={{ width: '100%', minWidth: isNarrow ? 720 : undefined, borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--fs-ivory)' }}>
                      {([
                        { h: 'Produit',         k: 'name' as const },
                        { h: 'Qté vendue',      k: 'qtySold' as const },
                        { h: 'CA généré',       k: 'caGenere' as const },
                        { h: 'Nb transactions', k: 'nbTransactions' as const },
                        { h: 'Prix moy. vente', k: 'prixMoyenVente' as const },
                      ]).map(({ h, k }) => (
                        <th key={h} onClick={() => toggleProdSort(k)} title="Cliquer pour trier"
                          style={{ padding: '8px 12px', textAlign: h === 'Produit' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: prodSort.key === k ? 'var(--fs-wine-700)' : 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                          {h}{prodSort.key === k ? (prodSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byProduct
                      .filter(p => !prodSearch.trim() || p.name.toLowerCase().includes(prodSearch.trim().toLowerCase()))
                      .sort((a, b) => {
                        const va = a[prodSort.key], vb = b[prodSort.key];
                        const cmp = typeof va === 'string' ? String(va).localeCompare(String(vb), 'fr') : Number(va) - Number(vb);
                        return prodSort.dir === 'asc' ? cmp : -cmp;
                      })
                      .map((p, i) => (
                      <tr key={p.name} style={{ borderBottom: '1px solid var(--fs-line)', background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--fs-ink-800)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(p.name)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{p.qtySold}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)' }}>{fmtN(p.caGenere)} XAF</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)' }}>{p.nbTransactions}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{fmtN(p.prixMoyenVente)} XAF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
