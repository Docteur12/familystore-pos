import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';
import { getStatsWeek, getTopProducts, PeriodDay, TopProduct } from '../api/dashboard';
import { createDemande } from '../api/magazinier';
import ToastContainer, { useToast } from '../components/Toast';

function I({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const D = {
  pkg:     'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zM12 22V11.5M3 6.5l9 5 9-5',
  bell:    'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  truck:   'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
  receipt: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8L14 2zM14 2v6h6',
};

const SHORTCUTS = [
  { label: 'Réceptions',   path: '/stocks/receptions',   d: 'M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',  color: 'var(--fs-wine-700)' },
  { label: 'Inventaire',   path: '/stocks/inventaire',   d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 1 2 2', color: '#2563EB' },
  { label: 'Alertes',      path: '/stocks/alertes',      d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', color: '#D97706' },
  { label: 'Étiquettes',   path: '/stocks/etiquettes',   d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01', color: '#7C3AED' },
  { label: 'Fournisseurs', path: '/stocks/fournisseurs', d: 'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z', color: '#059669' },
  { label: 'Catalogue',    path: '/stocks',              d: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z', color: '#6B7280' },
];

function fmtN(n: number) { return n.toLocaleString('fr-FR'); }

const CAT_COLORS: Record<string, string> = {
  'beauté': '#F5C4B2', 'hygiène': '#B8D8EC', 'parfumerie': '#D8C4E8',
  'épicerie': '#EDD8A0', 'boissons': '#B4DCC4', 'alimentation': '#F0D4B0',
  'bien-être': '#A8E0D4', 'maison': '#D4C8B8',
};
const catColor = (c?: string) => CAT_COLORS[c?.toLowerCase() ?? ''] ?? '#DDD4C8';

export default function StocksDashboard() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [weekData, setWeekData] = useState<PeriodDay[]>([]);
  const [topProds, setTopProds] = useState<TopProduct[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Demande magazinier modal
  const [demandeModal, setDemandeModal] = useState<{ product: Product } | null>(null);
  const [demandeQty,   setDemandeQty]   = useState('');
  const [dSending,     setDSending]     = useState(false);
  const [alertPanel,   setAlertPanel]   = useState<'stock' | 'expiry' | null>(null);

  const handleDemander = useCallback(async () => {
    if (!demandeModal) return;
    const qty = parseInt(demandeQty);
    if (!qty || qty < 1) { addToast('Quantité invalide', 'error'); return; }
    setDSending(true);
    try {
      await createDemande({ produitId: demandeModal.product._id, quantiteDemandee: qty });
      addToast(`Demande envoyée au magazinier — ${demandeModal.product.name}`, 'success');
      setDemandeModal(null); setDemandeQty('');
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setDSending(false); }
  }, [demandeModal, demandeQty, addToast]);

  useEffect(() => {
    Promise.all([
      getAllProducts(),
      getStatsWeek().catch(() => [] as PeriodDay[]),
      getTopProducts().catch(() => [] as TopProduct[]),
    ]).then(([prods, week, top]) => {
      setProducts(prods);
      setWeekData(week);
      setTopProds(top.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const lowCount     = products.filter(p => p.stock <= p.alertThreshold).length;
  const stockValue   = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const ruptureCount = products.filter(p => p.stock === 0).length;
  const in6months    = new Date(); in6months.setMonth(in6months.getMonth() + 6);
  const expiryProds  = products.filter(p => p.expiryDate && new Date(p.expiryDate) <= in6months).sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());

  const todayReceptions = (() => {
    try {
      const recs = JSON.parse(localStorage.getItem('fs_receptions') ?? '[]');
      const today = new Date().toISOString().slice(0, 10);
      return recs.filter((r: { date: string }) => r.date === today).length;
    } catch { return 0; }
  })();

  const lowProducts = [...products]
    .filter(p => p.stock <= p.alertThreshold)
    .sort((a, b) => (a.stock / Math.max(a.alertThreshold, 1)) - (b.stock / Math.max(b.alertThreshold, 1)))
    .slice(0, 5);

  const kpis = [
    { label: 'Références',      value: products.length,   sub: 'produits actifs',              icon: D.pkg,     accent: false, panel: null as 'stock'|'expiry'|null },
    { label: 'Valeur du stock', value: fmtN(stockValue),  sub: 'XAF coût achat',               icon: D.receipt, accent: true,  panel: null as 'stock'|'expiry'|null },
    { label: 'Stock faible',    value: lowCount,           sub: `dont ${ruptureCount} ruptures`, icon: D.bell,    accent: false, panel: 'stock' as 'stock'|'expiry'|null, link: true },
    { label: 'Péremption < 6 mois', value: expiryProds.length, sub: expiryProds.length > 0 ? 'À surveiller' : 'Aucun', icon: D.bell, accent: false, panel: 'expiry' as 'stock'|'expiry'|null, link: expiryProds.length > 0 },
  ];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <StocksSidebar alertCount={lowCount}/>

      {/* ── Modal demande magazinier ───────────────────────────────────── */}
      {demandeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setDemandeModal(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Demande au magazinier</p>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-900)', margin: '0 0 16px' }}>{demandeModal.product.name}</h3>
            <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: '0 0 14px' }}>
              Stock actuel : <strong style={{ color: 'var(--fs-danger-700)' }}>{demandeModal.product.stock}</strong>
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
                Quantité à demander
              </label>
              <input
                type="number" min={1} autoFocus
                value={demandeQty}
                onChange={e => setDemandeQty(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleDemander(); if (e.key === 'Escape') setDemandeModal(null); }}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="Quantité"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDemandeModal(null)}
                style={{ flex: 1, padding: '10px', background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>
                Annuler
              </button>
              <button onClick={handleDemander} disabled={dSending}
                style={{ flex: 1, padding: '10px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: dSending ? 0.7 : 1 }}>
                {dSending ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Tableau de bord</h1>
            </div>
            <span style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {kpis.map(kpi => (
              <div key={kpi.label}
                onClick={() => kpi.panel && setAlertPanel(alertPanel === kpi.panel ? null : kpi.panel)}
                style={{
                  background: '#fff',
                  border: `1px solid ${alertPanel === kpi.panel ? 'var(--fs-wine-700)' : kpi.accent ? 'rgba(122,29,46,0.2)' : 'var(--fs-line)'}`,
                  borderRadius: 12, padding: '16px 18px',
                  cursor: kpi.panel ? 'pointer' : 'default',
                  boxShadow: alertPanel === kpi.panel ? '0 0 0 3px rgba(122,29,46,0.1)' : 'var(--fs-shadow-sm)',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</span>
                  <span style={{ color: kpi.panel ? 'var(--fs-wine-700)' : kpi.accent ? 'var(--fs-wine-700)' : 'var(--fs-ink-300)' }}><I d={kpi.icon} size={14}/></span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: kpi.accent ? 'var(--fs-wine-700)' : 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-mono)', lineHeight: 1 }}>
                  {kpi.value}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                  <span style={{ fontSize: 11, color: (kpi as any).link && Number(kpi.value) > 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)' }}>{kpi.sub}</span>
                  {kpi.panel && <span style={{ fontSize: 10, color: 'var(--fs-wine-700)', fontWeight: 600 }}>{alertPanel === kpi.panel ? '▲' : '▼'}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Panneau produits à surveiller */}
          {alertPanel && (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                  {alertPanel === 'stock' ? `⚠ Produits sous le seuil d'alerte (${lowCount})` : `📅 Produits expirant dans moins de 6 mois (${expiryProds.length})`}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => navigate(alertPanel === 'stock' ? '/stocks/alertes' : '/stocks')}
                    style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-wine-700)', background: 'none', border: '1px solid var(--fs-wine-700)', padding: '4px 12px', borderRadius: 7, cursor: 'pointer' }}>
                    Voir tout →
                  </button>
                  <button onClick={() => setAlertPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', fontSize: 16 }}>✕</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {(alertPanel === 'stock' ? lowProducts : expiryProds.slice(0, 10)).map(p => {
                  const daysLeft = p.expiryDate ? Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--fs-ivory)', borderRadius: 9, border: '1px solid var(--fs-line)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>
                          {alertPanel === 'stock'
                            ? `Stock : ${p.stock} / Seuil : ${p.alertThreshold}`
                            : daysLeft !== null
                              ? daysLeft < 0 ? '🔴 Expiré' : `⏱ ${daysLeft} j restants (${new Date(p.expiryDate!).toLocaleDateString('fr-FR')})`
                              : '—'
                          }
                        </div>
                      </div>
                      {alertPanel === 'stock' && (
                        <button onClick={() => { setDemandeModal({ product: p }); setDemandeQty(''); }}
                          style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', background: '#FEF0E0', color: '#92400e', border: '1px solid #FCD34D', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}>
                          + Demander
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chart + Shortcuts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 14 }}>
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
                Activité des ventes — 7 derniers jours
              </p>
              {loading || weekData.length === 0 ? (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fs-ink-300)', fontSize: 13 }}>
                  {loading ? 'Chargement…' : 'Aucune donnée'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={weekData} barSize={30} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => fmtN(v)} width={60}/>
                    <Tooltip
                      formatter={(v: number) => [`${fmtN(v)} XAF`, 'CA']}
                      contentStyle={{ border: '1px solid var(--fs-line)', borderRadius: 8, fontSize: 12, boxShadow: 'none' }}
                    />
                    <Bar dataKey="totalCA" fill="var(--fs-wine-700)" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
                Raccourcis
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SHORTCUTS.map(sc => (
                  <button key={sc.path} onClick={() => navigate(sc.path)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '14px 8px', border: '1.5px solid var(--fs-line)', borderRadius: 10,
                      background: 'var(--fs-ivory)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      color: 'var(--fs-ink-700)', fontFamily: 'var(--fs-font-sans)',
                    }}
                    onMouseEnter={e => { (e.currentTarget.style.borderColor = sc.color); (e.currentTarget.style.background = '#fff'); }}
                    onMouseLeave={e => { (e.currentTarget.style.borderColor = 'var(--fs-line)'); (e.currentTarget.style.background = 'var(--fs-ivory)'); }}>
                    <span style={{ color: sc.color }}><I d={sc.d} size={18}/></span>
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Top products + Low stock */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>
                Top 5 produits vendus
              </p>
              {topProds.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                  {loading ? 'Chargement…' : 'Aucune vente enregistrée'}
                </div>
              ) : topProds.map((p, i) => (
                <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < topProds.length - 1 ? '1px solid var(--fs-line)' : 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', width: 18, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor(p.category), flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{p.totalQty} {p.unit} · {fmtN(p.totalRevenue)} XAF</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>
                À réapprovisionner
              </p>
              {lowProducts.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                  {loading ? 'Chargement…' : '✓ Tous les stocks sont suffisants'}
                </div>
              ) : lowProducts.map((p, i) => {
                const ratio = p.alertThreshold > 0 ? Math.min(1, p.stock / p.alertThreshold) : 1;
                return (
                  <div key={p._id} style={{ padding: '9px 0', borderBottom: i < lowProducts.length - 1 ? '1px solid var(--fs-line)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{p.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: p.stock === 0 ? 'var(--fs-danger-700)' : '#D97706' }}>
                          {p.stock} <span style={{ fontSize: 10, fontWeight: 400 }}>u.</span>
                        </span>
                        <button
                          onClick={() => { setDemandeModal({ product: p }); setDemandeQty(''); }}
                          style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', background: '#FEF0E0', color: '#92400e', border: '1px solid #FCD34D', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          + Demander
                        </button>
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'var(--fs-line)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(ratio * 100)}%`, background: p.stock === 0 ? 'var(--fs-danger-500)' : '#D97706', borderRadius: 2 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
