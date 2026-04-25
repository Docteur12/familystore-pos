import React, { useEffect, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell,
} from 'recharts';
import AdminSidebar from '../components/AdminSidebar';
import { getStatsToday, getStatsWeek, getTopProducts, getTokenPayload, StatsToday, WeekDay, TopProduct } from '../api/dashboard';
import { getUsers, UserRecord } from '../api/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtN = (n: number) => n.toLocaleString('fr-FR');
const fmtK = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(2).replace('.', ',') + 'M'
  : n >= 1_000 ? Math.round(n / 1_000) + 'K' : String(n);

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = {
  calendar: 'M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-.293.707L13 13.414V19a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 7 21v-7.586L3.293 6.707A1 1 0 0 1 3 6V4z',
  export:   'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  bell:     'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  plus:     'M12 5v14M5 12h14',
  cash:     'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  mobile:   'M12 18h.01M8 21h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z',
  card:     'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z',
  link:     'M9 18l6-6-6-6',
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_TRANSACTIONS = [
  { id: 'T00847', caissier: 'Aïcha N.', caisse: 'C01', articles: 4, paiement: 'espèces',  heure: '14:23', total: 21750, flag: false },
  { id: 'T00846', caissier: 'Marie N.', caisse: 'C01', articles: 2, paiement: 'mobile',   heure: '14:19', total: 8550,  flag: false },
  { id: 'T00845', caissier: 'Marie N.', caisse: 'C01', articles: 6, paiement: 'carte',    heure: '14:12', total: 15280, flag: false },
  { id: 'T00844', caissier: 'Jean D.',  caisse: 'C03', articles: 11,paiement: 'espèces',  heure: '14:05', total: 12488, flag: false },
  { id: 'T00843', caissier: 'Marie N.', caisse: 'C02', articles: 1, paiement: 'mobile',   heure: '13:58', total: 4508,  flag: true  },
  { id: 'T00842', caissier: 'Fatou K.', caisse: 'C02', articles: 3, paiement: 'espèces',  heure: '13:51', total: 12980, flag: false },
];

const PAYMENT_DATA = [
  { name: 'Espèces',      value: 42, color: '#7A1D2E' },
  { name: 'Mobile Money', value: 38, color: '#D1A660' },
  { name: 'Carte bancaire',value:20, color: '#B8D8EC' },
];

const AVATAR_COLORS = ['#C2566B', '#7A9EC2', '#7AB87A', '#C2A07A', '#9A7AC2', '#7ABFBF'];

const MOCK_TEAM = [
  { name: 'Aïcha N.',  role: 'Caissière',       caisse: 'Caisse 01', horaire: '08:00–16:00', ventes: 18, initials: 'AN', color: '#C2566B' },
  { name: 'Marie T.',  role: 'Caissière',        caisse: 'Caisse 02', horaire: '04:00–11:00', ventes: 24, initials: 'MT', color: '#7A9EC2' },
  { name: 'Samuel O.', role: 'Gestionnaire',     caisse: 'Stock',     horaire: '07:00–15:00', ventes: 0,  initials: 'SO', color: '#7AB87A' },
  { name: 'Jean D.',   role: 'Caissier',         caisse: 'Caisse 03', horaire: '12:00–20:00', ventes: 4,  initials: 'JD', color: '#C2A07A' },
  { name: 'Fatou K.',  role: 'Caissière (repos)', caisse: '—',        horaire: 'Repos',        ventes: 0,  initials: 'FK', color: '#9A7AC2' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ title, value, sub, sup, accent, icon }: {
  title: string; value: string; sub?: string; sup?: string; accent?: boolean; icon?: string;
}) {
  if (accent) {
    return (
      <div style={{ flex: 1, background: 'var(--fs-wine-800)', borderRadius: 12, padding: '16px 20px', color: '#fff', minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,235,217,0.6)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', letterSpacing: '-0.01em', lineHeight: 1, marginBottom: 4 }}>{value}</div>
        {sup && <div style={{ fontSize: 12, color: 'var(--fs-gold-400)', fontWeight: 600 }}>{sup}</div>}
      </div>
    );
  }
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)' }}>{title}</div>
        {icon && <span style={{ color: 'var(--fs-ink-300)' }}><I d={icon} size={14}/></span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function PaymentIcon({ type }: { type: string }) {
  const icon = type === 'espèces' ? D.cash : type === 'mobile' ? D.mobile : D.card;
  return <span style={{ color: 'var(--fs-ink-400)' }}><I d={icon} size={13}/></span>;
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--fs-shadow-md)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--fs-ink-500)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(payload[0].value)} XAF</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type ChartTab = '7j' | '30j' | '90j' | '1an';

export default function AdminDashboard() {
  const payload = getTokenPayload();
  const prenom  = payload?.name?.split(' ')[0] ?? 'Rose';

  const [stats,    setStats]    = useState<StatsToday | null>(null);
  const [week,     setWeek]     = useState<WeekDay[]>([]);
  const [topProds, setTopProds] = useState<TopProduct[]>([]);
  const [users,    setUsers]    = useState<UserRecord[]>([]);
  const [chartTab, setChartTab] = useState<ChartTab>('7j');
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    getStatsToday().then(setStats).catch(() => {});
    getStatsWeek().then(setWeek).catch(() => {});
    getTopProducts().then(setTopProds).catch(() => {});
    getUsers().then(setUsers).catch(() => {});
  }, []);

  const ca       = stats?.totalCA  ?? 4_287_500;
  const tickets  = stats?.nbVentes ?? 342;
  const benefice = stats?.benefice ?? 1_624_100;
  const marge    = stats?.marge    ?? 38;
  const panier   = tickets > 0 ? Math.round(ca / tickets) : 12_536;

  const chartData = week.length > 0
    ? week.map(d => ({ label: d.label, value: d.totalCA }))
    : ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'].map((l, i) => ({
        label: l,
        value: [378000, 562000, 604000, 583000, 650000, 758000, 612000][i],
      }));

  const maxChart = Math.max(...chartData.map(d => d.value), 1);
  const topProdsData = topProds.length > 0 ? topProds : [
    { _id: '1', name: 'Savon noir du Cameroun', category: 'hygiène', unit: 'pièce', totalQty: 127, totalRevenue: 158750 },
    { _id: '2', name: 'Eau Minérale 1,5L',      category: 'boissons',unit: 'bouteille',totalQty: 98, totalRevenue: 97000 },
    { _id: '3', name: 'Gel douche hibiscus',    category: 'beauté',  unit: 'pièce', totalQty: 64, totalRevenue: 134800 },
    { _id: '4', name: 'Huile de karité',        category: 'beauté',  unit: 'pièce', totalQty: 52, totalRevenue: 147800 },
    { _id: '5', name: 'Dentifrice giroflée',    category: 'hygiène', unit: 'tube',  totalQty: 48, totalRevenue: 43800  },
  ] as TopProduct[];
  const maxQty = Math.max(...topProdsData.map(p => p.totalQty), 1);

  const totalPayments = PAYMENT_DATA.reduce((s, p) => s + p.value, 0);

  const team = users.length > 0
    ? users.filter(u => u.role !== 'patron').slice(0, 5).map((u, i) => ({
        ...MOCK_TEAM[i] ?? { caisse: '—', horaire: '—', ventes: 0 },
        name: u.name,
        initials: u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        color: AVATAR_COLORS[i % AVATAR_COLORS.length],
        role: u.role === 'caissier' ? 'Caissier(e)' : 'Gestionnaire',
      }))
    : MOCK_TEAM;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Tableau de bord</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
                Bonjour {prenom}, voici l'activité du jour
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, color: 'var(--fs-ink-600)', background: '#fff' }}>
                <I d={D.calendar} size={13}/>
                <span style={{ fontWeight: 600 }}>{today.charAt(0).toUpperCase() + today.slice(1)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', border: '1px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, color: 'var(--fs-ink-600)', background: '#fff' }}>
                <span style={{ fontWeight: 600 }}>7 derniers jours</span>
                <span style={{ fontSize: 10 }}>▾</span>
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <I d={D.export} size={13}/> Exporter
              </button>
              <button style={{ padding: '7px', border: '1px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex' }}>
                <I d={D.bell} size={15}/>
              </button>
              <button style={{ padding: '7px', border: '1px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex' }}>
                <I d={D.settings} size={15}/>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px 28px' }}>

          {/* Metric cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
            <MetricCard title="Chiffre d'affaires" value={`${fmtN(ca)} XAF`} sup="+12,4 % vs semaine dernière" accent/>
            <MetricCard title="Tickets encaissés" value={String(tickets)} sub={`+28 tickets · ${Math.min(tickets, 56)} aujourd'hui`}/>
            <MetricCard title="Panier moyen" value={`${fmtN(panier)} XAF`} sub={`+33 % · toutes caisses`}/>
            <MetricCard title="Bénéfice brut" value={`${fmtN(benefice)} XAF`} sub={`+${marge} % de marge · après coût d'achat`}/>
          </div>

          {/* Charts row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
            {/* Line chart */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Ventes sur 7 jours</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Chiffre d'affaires journalier · toutes caisses</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['7j', '30j', '90j', '1an'] as ChartTab[]).map(t => (
                    <button key={t} onClick={() => setChartTab(t)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: chartTab === t ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                      color: chartTab === t ? '#fff' : 'var(--fs-ink-400)',
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={38}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Line type="monotone" dataKey="value" stroke="#7A1D2E" strokeWidth={2.5} dot={{ fill: '#7A1D2E', r: 3, strokeWidth: 0 }} activeDot={{ fill: '#D1A660', r: 5, strokeWidth: 0 }}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top products */}
            <div style={{ width: 280, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Meilleures ventes</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Par volume · 7 derniers jours</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topProdsData.slice(0, 5).map((p, i) => (
                  <div key={p._id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: i === 0 ? '#7A1D2E' : i === 1 ? '#D1A660' : i === 2 ? '#7AB87A' : i === 3 ? '#7A9EC2' : '#C2566B', flexShrink: 0 }}/>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{p.name}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{p.totalQty}</div>
                        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{fmtN(p.totalRevenue)}</div>
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'var(--fs-line)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((p.totalQty / maxQty) * 100)}%`, background: i === 0 ? '#7A1D2E' : i === 1 ? '#D1A660' : '#B8893E', borderRadius: 2, transition: 'width 0.5s' }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Équipe */}
            <div style={{ width: 280, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--fs-shadow-sm)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Équipe en service</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>4 présents · 1 au repos</div>
                </div>
                <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid var(--fs-line-2)', borderRadius: 6, background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-600)' }}>
                  <I d={D.plus} size={11}/> Ajouter
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {team.map(m => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {m.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{m.role} · {m.caisse}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>{m.horaire}</div>
                      {m.ventes > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-success-700)' }}>{m.ventes} ventes</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transactions */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--fs-shadow-sm)', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Dernières transactions</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Journal des ventes en temps réel</div>
                </div>
                <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--fs-wine-700)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Tout voir <I d={D.link} size={11}/>
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Ticket', 'Caissier', 'Articles', 'Paiement', 'Heure', 'Total'].map(h => (
                      <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_TRANSACTIONS.map((t, i) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--fs-line)', background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                      <td style={{ padding: '7px 8px', fontSize: 11, fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)' }}>{t.id}</td>
                      <td style={{ padding: '7px 8px', fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{t.caissier}<br/><span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 400 }}>{t.caisse}</span></td>
                      <td style={{ padding: '7px 8px', fontSize: 11, color: 'var(--fs-ink-500)' }}>{t.articles} art.</td>
                      <td style={{ padding: '7px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fs-ink-600)', textTransform: 'capitalize' }}>
                          <PaymentIcon type={t.paiement}/> {t.paiement}
                        </div>
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 11, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>{t.heure}</td>
                      <td style={{ padding: '7px 8px', fontSize: 12, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: t.flag ? 'var(--fs-danger-700)' : 'var(--fs-ink-900)' }}>
                        {fmtN(t.total)} {t.flag && <span style={{ fontSize: 9, background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '1px 5px', borderRadius: 4 }}>susp.</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payment donut */}
            <div style={{ width: 220, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--fs-shadow-sm)', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Modes de paiement</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 10 }}>Répartition · 7 derniers jours</div>
              <div style={{ position: 'relative', height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={PAYMENT_DATA} cx="50%" cy="50%" innerRadius={38} outerRadius={56} dataKey="value" paddingAngle={2}>
                      {PAYMENT_DATA.map((p, i) => <Cell key={i} fill={p.color}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1 }}>
                    {fmtK(ca)}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', fontWeight: 600 }}>XAF</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {PAYMENT_DATA.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }}/>
                      <span style={{ fontSize: 11, color: 'var(--fs-ink-600)' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{p.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
