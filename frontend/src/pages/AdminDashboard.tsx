import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell,
} from 'recharts';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import {
  getStatsToday, getStatsPeriod, getTopProducts, getRecentSales,
  getPaymentBreakdown, getTokenPayload,
  StatsToday, PeriodDay, TopProduct, PaymentSlice, RecentSale,
} from '../api/dashboard';
import { getUsers, UserRecord } from '../api/auth';
import { getCaisses, CaisseRecord } from '../api/caisses';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');
const fmtK = (n: number) => n >= 1_000_000
  ? (n / 1_000_000).toFixed(2).replace('.', ',') + 'M'
  : n >= 1_000 ? Math.round(n / 1_000) + 'K' : String(Math.round(n));

function evoPct(current: number, prev: number): string | null {
  if (prev === 0) return null;
  const p = ((current - prev) / prev) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'À l\'instant';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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

const AVATAR_COLORS = ['#C2566B','#7A9EC2','#7AB87A','#C2A07A','#9A7AC2','#7ABFBF'];

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

type ChartTab = '7j' | '30j' | '90j' | '1an';
const CHART_DAYS: Record<ChartTab, number> = { '7j': 7, '30j': 30, '90j': 90, '1an': 365 };

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
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--fs-shadow-md)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--fs-ink-500)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(payload[0].value)} XAF</div>
      {payload[0].payload?.nbVentes > 0 && (
        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 2 }}>{payload[0].payload.nbVentes} vente{payload[0].payload.nbVentes > 1 ? 's' : ''}</div>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { toasts, addToast, removeToast } = useToast();
  const payload  = getTokenPayload();
  const prenom   = payload?.name?.split(' ')[0] ?? '';
  const today    = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const [stats,    setStats]    = useState<StatsToday | null>(null);
  const [period,   setPeriod]   = useState<PeriodDay[]>([]);
  const [topProds, setTopProds] = useState<TopProduct[]>([]);
  const [payment,  setPayment]  = useState<PaymentSlice[]>([]);
  const [recent,   setRecent]   = useState<RecentSale[]>([]);
  const [users,    setUsers]    = useState<UserRecord[]>([]);
  const [caisses,  setCaisses]  = useState<CaisseRecord[]>([]);
  const [chartTab, setChartTab] = useState<ChartTab>('7j');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chargement initial (données stables)
  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
    getCaisses().then(setCaisses).catch(() => {});
  }, []);

  // Rechargement des données live (stats + graphe + paiements + récent)
  const loadLive = useCallback(async (silent = false) => {
    try {
      const [s, prods, pay, rec] = await Promise.all([
        getStatsToday(),
        getTopProducts(),
        getPaymentBreakdown('week'),
        getRecentSales(),
      ]);
      setStats(s);
      setTopProds(prods);
      setPayment(pay);
      setRecent(rec);
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

  // Rechargement du graphe selon l'onglet
  useEffect(() => {
    getStatsPeriod(CHART_DAYS[chartTab])
      .then(setPeriod)
      .catch(() => {});
  }, [chartTab]);

  // ── Valeurs dérivées ────────────────────────────────────────────────────────

  const ca       = stats?.totalCA  ?? 0;
  const prevCA   = stats?.prevCA   ?? 0;
  const tickets  = stats?.nbVentes ?? 0;
  const benefice = stats?.benefice ?? 0;
  const marge    = stats?.marge    ?? 0;
  const panier   = tickets > 0 ? Math.round(ca / tickets) : 0;
  const evoCA    = evoPct(ca, prevCA);

  const chartData  = period.map(d => ({ label: d.label, value: d.totalCA, nbVentes: d.nbVentes }));
  const maxQty     = Math.max(...topProds.map(p => p.totalQty), 1);
  const totalPmCA  = payment.reduce((s, p) => s + p.total, 0);

  const caisseById = new Map(caisses.map(c => [c._id, c]));
  const team = users
    .filter(u => u.role !== 'patron')
    .slice(0, 5)
    .map((u, i) => {
      const caisse = u.caisseId ? caisseById.get(u.caisseId) : null;
      return {
        name:     u.name,
        initials: u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        color:    AVATAR_COLORS[i % AVATAR_COLORS.length],
        role:     u.role === 'caissier' ? 'Caissier(e)' : u.role === 'gestionnaire' ? 'Gestionnaire' : 'Magazinier',
        caisse:   caisse ? `${caisse.nom} (${caisse.code})` : u.role === 'caissier' ? '— Non assigné' : '—',
      };
    });

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px 28px' }}>

          {/* KPI cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
            <MetricCard
              title="Chiffre d'affaires"
              value={`${fmtN(ca)} XAF`}
              sup={evoCA ? `${evoCA} vs même jour semaine dernière` : null}
              accent
            />
            <MetricCard
              title="Tickets encaissés"
              value={String(tickets)}
              sub={tickets > 0 ? `Panier moyen : ${fmtN(panier)} XAF` : 'Aucune vente aujourd\'hui'}
            />
            <MetricCard
              title="Bénéfice brut"
              value={`${fmtN(benefice)} XAF`}
              sub={`Marge ${marge} % sur coût d'achat`}
            />
            <MetricCard
              title="Marge nette"
              value={`${marge} %`}
              sub={ca > 0 ? `CA : ${fmtK(ca)} XAF · ${tickets} ticket${tickets > 1 ? 's' : ''}` : 'En attente de ventes'}
            />
          </div>

          {/* Graphe + top produits */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>

            {/* Line chart */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Évolution des ventes</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Chiffre d'affaires · toutes caisses</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['7j','30j','90j','1an'] as ChartTab[]).map(t => (
                    <button key={t} onClick={() => setChartTab(t)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: chartTab === t ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                      color:      chartTab === t ? '#fff' : 'var(--fs-ink-400)',
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{ height: 180 }}>
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
                        activeDot={{ fill: '#D1A660', r: 5, strokeWidth: 0 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Top produits */}
            <div style={{ width: 280, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Meilleures ventes</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Par volume · 7 derniers jours</div>
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
          <div style={{ display: 'flex', gap: 16 }}>

            {/* Équipe */}
            <div style={{ width: 260, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--fs-shadow-sm)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Équipe en service</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{team.length} collaborateur{team.length !== 1 ? 's' : ''}</div>
                </div>
                <a href="/admin/equipe" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid var(--fs-line-2)', borderRadius: 6, background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-600)', textDecoration: 'none' }}>
                  <I d={D.plus} size={11}/> Gérer
                </a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {team.map(m => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {m.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.role} · {m.caisse}</div>
                    </div>
                  </div>
                ))}
                {team.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-300)', textAlign: 'center', padding: '16px 0' }}>Aucun collaborateur</div>
                )}
              </div>
            </div>

            {/* Dernières transactions */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--fs-shadow-sm)', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Dernières transactions</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>
                    {tickets > 0 ? `${tickets} ticket${tickets > 1 ? 's' : ''} aujourd'hui · ${fmtN(ca)} XAF` : 'Aucune vente enregistrée aujourd\'hui'}
                  </div>
                </div>
                <a href="/admin/journal" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--fs-wine-700)', textDecoration: 'none' }}>
                  Journal complet <I d={D.link} size={11}/>
                </a>
              </div>

              {recent.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                  <div style={{ textAlign: 'center', color: 'var(--fs-ink-300)' }}>
                    <I d={D.receipt} size={32}/>
                    <div style={{ fontSize: 12, marginTop: 8 }}>Aucune transaction pour le moment</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Les ventes apparaîtront ici en temps réel</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recent.map((s, i) => {
                    const pmColor = PM_COLORS[s.paymentMethod] ?? '#999';
                    const pmIcon  = PM_ICONS[s.paymentMethod]  ?? D.cash;
                    const nbArt   = s.items.reduce((n, it) => n + it.quantity, 0);
                    return (
                      <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', background: i % 2 === 0 ? 'var(--fs-ivory)' : '#fff', borderRadius: 8 }}>
                        {/* Ticket # */}
                        <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', flexShrink: 0, width: 60 }}>
                          #{s._id.slice(-6).toUpperCase()}
                        </div>
                        {/* Heure */}
                        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', flexShrink: 0, width: 38 }}>
                          {relTime(s.createdAt)}
                        </div>
                        {/* Articles */}
                        <div style={{ flex: 1, fontSize: 11, color: 'var(--fs-ink-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.items.length === 1
                            ? `${s.items[0].quantity}× ${s.items[0].name}`
                            : `${nbArt} article${nbArt > 1 ? 's' : ''} (${s.items.length} réf.)`}
                        </div>
                        {/* Mode paiement */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: pmColor, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                          <I d={pmIcon} size={11}/>
                        </span>
                        {/* Montant */}
                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', flexShrink: 0, textAlign: 'right', minWidth: 90 }}>
                          {fmtN(s.total)} XAF
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Donut modes de paiement */}
            <div style={{ width: 220, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--fs-shadow-sm)', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Modes de paiement</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 10 }}>Répartition · 7 derniers jours</div>

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
        </div>
      </main>
    </div>
  );
}
