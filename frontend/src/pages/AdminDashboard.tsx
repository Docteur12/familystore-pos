import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import {
  getStatsToday, getStatsPeriod, getTopProducts,
  getPaymentBreakdown, getTokenPayload,
  StatsToday, PeriodDay, TopProduct, PaymentSlice,
} from '../api/dashboard';
import { useIsMobile } from '../hooks/useIsMobile';
import { getAllProducts, Product } from '../api/products';

// ── Helpers ───────────────────────────────────────────────────────────────────

type CatalogSortKey = 'name' | 'category' | 'subCategory' | 'price' | 'stock' | 'alertThreshold' | 'status';

const CATALOG_COLS: { key: CatalogSortKey; label: string }[] = [
  { key: 'name',           label: 'Produit' },
  { key: 'category',       label: 'Catégorie' },
  { key: 'subCategory',    label: 'Sous-catégorie' },
  { key: 'price',          label: 'Prix vente' },
  { key: 'stock',          label: 'Stock' },
  { key: 'alertThreshold', label: 'Seuil' },
  { key: 'status',         label: 'Statut' },
];

const catalogSortVal = (p: Product, key: CatalogSortKey): string | number => {
  switch (key) {
    case 'name':           return p.name;
    case 'category':       return p.category ?? '';
    case 'subCategory':    return p.subCategory ?? '';
    case 'price':          return p.price;
    case 'stock':          return p.stock;
    case 'alertThreshold': return p.alertThreshold;
    case 'status':         return p.stock === 0 ? 2 : p.stock <= p.alertThreshold ? 1 : 0;
  }
};

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');
const fmtK = (n: number) => n >= 1_000_000
  ? (n / 1_000_000).toFixed(2).replace('.', ',') + 'M'
  : n >= 1_000 ? Math.round(n / 1_000) + 'K' : String(Math.round(n));

function evoPct(current: number, prev: number): string | null {
  if (prev === 0) return null;
  const p = ((current - prev) / prev) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
}

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const D = {
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  refresh:  'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  export:   'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  link:     'M9 18l6-6-6-6',
  plus:     'M12 5v14M5 12h14',
  cash:     'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  mobile:   'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  card:     'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  receipt:  'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h4',
};

const PM_COLORS: Record<string, string> = {
  cash:         '#7A1D2E',
  mtn_momo:     '#FFCC00',
  orange_money:  '#FF6600',
  card:          '#5E8FBF',
  mobile_money:  '#4682B4',
  credit:        '#D1A660',
};

const PM_ICONS: Record<string, string> = {
  cash:         D.cash,
  mtn_momo:     D.mobile,
  orange_money:  D.mobile,
  mobile_money:  D.mobile,
  card:          D.card,
  credit:        D.cash,
};

type ChartTab = 'Jour' | 'Mois' | 'T1' | 'T2' | 'T3' | 'T4' | 'An';

const TAB_LABELS: Record<ChartTab, string> = {
  Jour: 'Journalier', Mois: 'Mois en cours',
  T1: '1er trimestre', T2: '2e trimestre', T3: '3e trimestre', T4: '4e trimestre',
  An: 'Annuel',
};

type DateRange = { days?: number; dateFrom?: string; dateTo?: string };
function getTabRange(tab: ChartTab): DateRange {
  const now = new Date();
  const y   = now.getFullYear();
  if (tab === 'Jour') return { days: 1 };
  if (tab === 'Mois') {
    const s = new Date(y, now.getMonth(), 1);
    return { dateFrom: s.toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10) };
  }
  if (tab === 'T1') return { dateFrom: `${y}-01-01`, dateTo: `${y}-03-31` };
  if (tab === 'T2') return { dateFrom: `${y}-04-01`, dateTo: `${y}-06-30` };
  if (tab === 'T3') return { dateFrom: `${y}-07-01`, dateTo: `${y}-09-30` };
  if (tab === 'T4') return { dateFrom: `${y}-10-01`, dateTo: `${y}-12-31` };
  return { dateFrom: `${y}-01-01`, dateTo: now.toISOString().slice(0, 10) }; // An
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ title, value, sub, sup, accent }: {
  title: string; value: string; sub?: string; sup?: string | null; accent?: boolean;
}) {
  if (accent) {
    return (
      <div style={{ flex: 1, background: 'var(--fs-wine-800)', borderRadius: 12, padding: '16px 20px', color: '#fff', minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,235,217,0.6)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', letterSpacing: '-0.01em', lineHeight: 1, marginBottom: 4 }}>{value}</div>
        {sup && <div style={{ fontSize: 12, color: 'var(--fs-gold-400)', fontWeight: 600 }}>{sup}</div>}
        {!sup && <div style={{ fontSize: 11, color: 'rgba(245,235,217,0.3)' }}>Pas de données semaine préc.</div>}
      </div>
    );
  }
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const ca  = payload.find((p: any) => p.dataKey === 'value');
  const avg = payload.find((p: any) => p.dataKey === 'avgTicket');
  const min = payload.find((p: any) => p.dataKey === 'minTicket');
  const max = payload.find((p: any) => p.dataKey === 'maxTicket');
  const nb  = ca?.payload?.nbVentes ?? 0;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--fs-shadow-md)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--fs-ink-500)', marginBottom: 4 }}>{label}</div>
      {ca  && <div style={{ fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>CA : {fmtN(ca.value)} XAF</div>}
      {nb > 0 && (
        <>
          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 2 }}>{nb} vente{nb > 1 ? 's' : ''}</div>
          {avg && <div style={{ fontSize: 11, color: 'var(--fs-ink-500)', marginTop: 2 }}>Moy : {fmtN(avg.value)} · Min : {fmtN(min?.value ?? 0)} · Max : {fmtN(max?.value ?? 0)}</div>}
        </>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile  = useIsMobile();
  const payload  = getTokenPayload();
  const prenom   = payload?.name?.split(' ')[0] ?? '';
  const today    = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const [stats,         setStats]         = useState<StatsToday | null>(null);
  const [period,        setPeriod]        = useState<PeriodDay[]>([]);
  const [topProds,      setTopProds]      = useState<TopProduct[]>([]);
  const [payment,       setPayment]       = useState<PaymentSlice[]>([]);
  const [prodCount,     setProdCount]     = useState<number | null>(null);
  const [prodLowCount,  setProdLowCount]  = useState(0);
  const [products,      setProducts]      = useState<Product[]>([]);
  const [prodSearch,    setProdSearch]    = useState('');
  const [prodSort,      setProdSort]      = useState<{ key: CatalogSortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  const toggleProdSort = useCallback((key: CatalogSortKey) => {
    setProdSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }, []);

  const catalogRows = useMemo(() => {
    const q = prodSearch.toLowerCase();
    const filtered = products.filter(p => !q
      || p.name.toLowerCase().includes(q)
      || (p.category ?? '').toLowerCase().includes(q)
      || (p.subCategory ?? '').toLowerCase().includes(q));
    const dir = prodSort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = catalogSortVal(a, prodSort.key);
      const vb = catalogSortVal(b, prodSort.key);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'fr') * dir;
    });
  }, [products, prodSearch, prodSort]);
  const [prodPanel,     setProdPanel]     = useState<'low' | 'expiry' | null>(null);
  const [chartTab, setChartTab] = useState<ChartTab>('Mois');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rechargement des données live
  const loadLive = useCallback(async (silent = false) => {
    try {
      const [s] = await Promise.all([getStatsToday()]);
      setStats(s);
      setLastRefresh(new Date());
    } catch {
      if (!silent) addToast('Erreur chargement des statistiques', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    loadLive();
    timerRef.current = setInterval(() => loadLive(true), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadLive]);

  // Chargement catalogue produits (une fois au montage)
  useEffect(() => {
    getAllProducts().then(prods => {
      setProducts(prods);
      setProdCount(prods.length);
      setProdLowCount(prods.filter(p => p.stock <= p.alertThreshold).length);
    }).catch(() => {});
    // Dérivés expiry pour le panneau

  }, []);

  // Rechargement graphe + top produits + paiements selon l'onglet
  useEffect(() => {
    const range = getTabRange(chartTab);
    Promise.all([
      getStatsPeriod(7, range),
      getTopProducts(range),
      getPaymentBreakdown(range),
    ]).then(([p, prods, pay]) => {
      setPeriod(p);
      setTopProds(prods);
      setPayment(pay);
    }).catch(() => {});
  }, [chartTab]);

  // ── Valeurs dérivées ────────────────────────────────────────────────────────

  const ca        = stats?.totalCA   ?? 0;
  const prevCA    = stats?.prevCA    ?? 0;
  const tickets   = stats?.nbVentes  ?? 0;
  const benefice  = stats?.benefice  ?? 0;
  const marge     = stats?.marge     ?? 0;
  const minTicket = stats?.minTicket ?? 0;
  const maxTicket = stats?.maxTicket ?? 0;
  const avgTicket = stats?.avgTicket ?? 0;
  const evoCA     = evoPct(ca, prevCA);

  const chartData = period.map(d => ({
    label: d.label, value: d.totalCA, nbVentes: d.nbVentes,
    minTicket: d.minTicket, maxTicket: d.maxTicket, avgTicket: d.avgTicket,
  }));
  const maxQty   = Math.max(...topProds.map(p => p.totalQty), 1);
  const totalPmCA = payment.reduce((s, p) => s + p.total, 0);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isMobile ? '10px 14px 10px 56px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Tableau de bord</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
                {prenom ? `Bonjour ${prenom}, ` : ''}activité du jour
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fs-ink-400)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 2px #bbf7d0' }}/>
                {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, color: 'var(--fs-ink-600)', background: '#fff' }}>
                <I d={D.calendar} size={13}/>
                <span style={{ fontWeight: 600 }}>{today.charAt(0).toUpperCase() + today.slice(1)}</span>
              </div>
              <button onClick={() => loadLive()}
                style={{ padding: '7px 10px', border: '1px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center' }}
                title="Rafraîchir">
                <I d={D.refresh} size={13}/>
              </button>
              <a href="/admin/rapports"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>
                <I d={D.export} size={13}/> Rapports
              </a>
            </div>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 14px 24px' : '18px 28px 28px' }}>

          {/* KPI cards */}
          <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? 10 : 14, marginBottom: 18 }}>
            <MetricCard
              title="Chiffre d'affaires"
              value={`${fmtN(ca)} XAF`}
              sup={evoCA ? `${evoCA} vs même jour semaine dernière` : null}
              accent
            />
            {/* Tickets + MIN/MAX/MOYENNE */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 18px', boxShadow: 'var(--fs-shadow-sm)', minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 8 }}>
                Tickets — {tickets} encaissé{tickets !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'MIN', value: minTicket, color: '#7AB87A' },
                  { label: 'MOY', value: avgTicket, color: 'var(--fs-wine-700)' },
                  { label: 'MAX', value: maxTicket, color: '#D1A660' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: 'var(--fs-ivory)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fs-ink-400)', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: tickets > 0 ? s.color : 'var(--fs-ink-200)', lineHeight: 1 }}>
                      {tickets > 0 ? fmtK(s.value) : '—'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', marginTop: 2 }}>XAF</div>
                  </div>
                ))}
              </div>
            </div>
            <MetricCard
              title="Bénéfice brut"
              value={`${fmtN(benefice)} XAF`}
              sub={`Marge ${marge} % sur coût d'achat`}
            />
            <div style={{ flex: 1, background: '#fff', border: `1px solid ${prodPanel ? 'var(--fs-wine-700)' : 'var(--fs-line)'}`, borderRadius: 12, padding: '16px 20px', boxShadow: prodPanel ? '0 0 0 3px rgba(122,29,46,0.1)' : 'var(--fs-shadow-sm)', minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 8 }}>Catalogue produits</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1, marginBottom: 6 }}>
                {prodCount === null ? '…' : prodCount}
              </div>
              {prodCount !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(() => {
                    const in6m = new Date(); in6m.setMonth(in6m.getMonth() + 6);
                    const expCount = products.filter(p => p.expiryDate && new Date(p.expiryDate) <= in6m).length;
                    return (
                      <>
                        <button onClick={() => setProdPanel(p => p === 'low' ? null : 'low')} style={{ textAlign: 'left', background: 'none', border: 'none', cursor: prodLowCount > 0 ? 'pointer' : 'default', padding: 0 }}>
                          <span style={{ fontSize: 11, color: prodLowCount > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)', fontWeight: 600 }}>
                            {prodLowCount > 0 ? `⚠ ${prodLowCount} stock bas →` : '✓ Stocks OK'}
                          </span>
                        </button>
                        {expCount > 0 && (
                          <button onClick={() => setProdPanel(p => p === 'expiry' ? null : 'expiry')} style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>📅 {expCount} péremption &lt; 6 mois →</span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            <MetricCard
              title="Marge nette"
              value={`${marge} %`}
              sub={ca > 0 ? `CA : ${fmtK(ca)} XAF · ${tickets} ticket${tickets > 1 ? 's' : ''}` : 'En attente de ventes'}
            />
          </div>

          {/* Panneau produits à surveiller */}
          {prodPanel && (() => {
            const in6m = new Date(); in6m.setMonth(in6m.getMonth() + 6);
            const liste = prodPanel === 'low'
              ? products.filter(p => p.stock <= p.alertThreshold).sort((a, b) => a.stock - b.stock)
              : products.filter(p => p.expiryDate && new Date(p.expiryDate) <= in6m).sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());
            const titre = prodPanel === 'low' ? `⚠ Produits en stock bas (${liste.length})` : `📅 Péremption < 6 mois (${liste.length})`;
            return (
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{titre}</span>
                  <button onClick={() => setProdPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', fontSize: 16 }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
                  {liste.slice(0, 9).map(p => {
                    const daysLeft = p.expiryDate ? Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000) : null;
                    return (
                      <div key={p._id} style={{ padding: '10px 14px', background: 'var(--fs-ivory)', borderRadius: 9, border: '1px solid var(--fs-line)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 3 }}>
                          {prodPanel === 'low'
                            ? <span style={{ color: p.stock === 0 ? 'var(--fs-danger-700)' : '#D97706', fontWeight: 600 }}>
                                {p.stock === 0 ? 'RUPTURE' : `Stock : ${p.stock} / Seuil : ${p.alertThreshold}`}
                              </span>
                            : daysLeft !== null
                              ? <span style={{ color: daysLeft < 0 ? 'var(--fs-danger-700)' : '#D97706', fontWeight: 600 }}>
                                  {daysLeft < 0 ? '🔴 Expiré' : `⏱ ${daysLeft} j — ${new Date(p.expiryDate!).toLocaleDateString('fr-FR')}`}
                                </span>
                              : '—'
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
                {liste.length > 9 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--fs-ink-400)', textAlign: 'center' }}>
                    + {liste.length - 9} autres — consultez la page Stocks pour la liste complète
                  </div>
                )}
              </div>
            );
          })()}

          {/* Graphe + top produits */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, marginBottom: 18 }}>

            {/* Line chart */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Évolution des ventes</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Chiffre d'affaires · toutes caisses</div>
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {(['Jour','Mois','T1','T2','T3','T4','An'] as ChartTab[]).map(t => (
                    <button key={t} onClick={() => setChartTab(t)} style={{
                      padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: chartTab === t ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                      color:      chartTab === t ? '#fff' : 'var(--fs-ink-400)',
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{ height: isMobile ? 160 : 180 }}>
                {chartData.length === 0 || chartData.every(d => d.value === 0) ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fs-ink-300)', fontSize: 12 }}>
                    Aucune donnée pour cette période
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false}
                        interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}/>
                      <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={38}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <Line type="monotone" dataKey="value" stroke="#7A1D2E" strokeWidth={2.5}
                        dot={{ fill: '#7A1D2E', r: 3, strokeWidth: 0 }}
                        activeDot={{ fill: '#D1A660', r: 5, strokeWidth: 0 }} name="CA"/>
                      <Line type="monotone" dataKey="avgTicket" stroke="#7A9EC2" strokeWidth={1.5}
                        strokeDasharray="4 3" dot={false} name="Moyenne"/>
                      <Line type="monotone" dataKey="minTicket" stroke="#7AB87A" strokeWidth={1}
                        strokeDasharray="2 4" dot={false} name="MIN"/>
                      <Line type="monotone" dataKey="maxTicket" stroke="#D1A660" strokeWidth={1}
                        strokeDasharray="2 4" dot={false} name="MAX"/>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Top produits */}
            <div style={{ width: 280, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)', display: isMobile ? 'none' : undefined }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Meilleures ventes</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Par volume · {TAB_LABELS[chartTab]}</div>
              {topProds.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 11, padding: '24px 0' }}>Aucune vente enregistrée</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topProds.slice(0, 5).map((p, i) => {
                    const colors = ['#7A1D2E','#D1A660','#7AB87A','#7A9EC2','#C2566B'];
                    return (
                      <div key={p._id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[i], flexShrink: 0 }}/>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{p.name}</span>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{p.totalQty}</div>
                            <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{fmtN(p.totalRevenue)} XAF</div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--fs-line)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round((p.totalQty / maxQty) * 100)}%`, background: colors[i], borderRadius: 2, transition: 'width 0.5s' }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Ligne basse */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>

            {/* Top produits (mobile: caché, déjà présent dans la section du haut sur desktop) */}

            {/* Donut modes de paiement */}
            <div style={{ width: isMobile ? '100%' : 220, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--fs-shadow-sm)', flexShrink: isMobile ? undefined : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Modes de paiement</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 10 }}>Répartition · {TAB_LABELS[chartTab]}</div>

              {payment.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fs-ink-300)', fontSize: 11 }}>Aucune donnée</div>
              ) : (
                <>
                  <div style={{ position: 'relative', height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={payment} cx="50%" cy="50%" innerRadius={38} outerRadius={56} dataKey="pct" paddingAngle={2}>
                          {payment.map((p, i) => (
                            <Cell key={i} fill={PM_COLORS[p.mode] ?? `hsl(${i * 60},50%,55%)`}/>
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1 }}>
                        {fmtK(totalPmCA)}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', fontWeight: 600 }}>XAF</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {payment.map((p, i) => (
                      <div key={p.mode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: PM_COLORS[p.mode] ?? `hsl(${i * 60},50%,55%)` }}/>
                          <span style={{ fontSize: 11, color: 'var(--fs-ink-600)' }}>{p.label}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{p.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* ── Catalogue produits ── */}
          {products.length > 0 && (
            <div style={{ marginTop: 18, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Catalogue produits</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{prodCount} référence{prodCount !== 1 ? 's' : ''} · {prodLowCount > 0 ? <span style={{ color: 'var(--fs-danger-700)', fontWeight: 600 }}>⚠ {prodLowCount} stock bas</span> : <span style={{ color: 'var(--fs-success-700)', fontWeight: 600 }}>✓ Stocks OK</span>}</div>
                </div>
                <input
                  value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                  placeholder="Rechercher un produit…"
                  style={{ padding: '7px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', width: 200, fontFamily: 'var(--fs-font-sans)' }}
                />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--fs-ivory)' }}>
                      {CATALOG_COLS.map(col => (
                        <th key={col.key}
                          onClick={() => toggleProdSort(col.key)}
                          style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: prodSort.key === col.key ? 'var(--fs-wine-700)' : 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                          {col.label}
                          <span style={{ marginLeft: 4, opacity: prodSort.key === col.key ? 1 : 0.25 }}>
                            {prodSort.key === col.key ? (prodSort.dir === 'asc' ? '▲' : '▼') : '▲'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catalogRows.map((p, i) => {
                        const low = p.stock <= p.alertThreshold;
                        const out = p.stock === 0;
                        return (
                          <tr key={p._id} style={{ borderBottom: '1px solid var(--fs-line)', background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                            <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--fs-ink-500)' }}>{p.category ?? '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--fs-ink-500)' }}>{p.subCategory ?? '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)' }}>{fmtN(p.price)} XAF</td>
                            <td style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--fs-font-mono)', fontWeight: 800, color: out ? 'var(--fs-danger-700)' : low ? '#D1A660' : 'var(--fs-ink-900)' }}>{p.stock}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>{p.alertThreshold}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'left' }}>
                              <span style={{
                                padding: '2px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                                background: out ? 'var(--fs-danger-100)' : low ? '#FFF7ED' : '#F0FDF4',
                                color:      out ? 'var(--fs-danger-700)' : low ? '#EA580C' : '#16A34A',
                              }}>
                                {out ? 'Rupture' : low ? 'Stock bas' : 'OK'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
