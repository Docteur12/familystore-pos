import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getStatsToday,
  getStatsWeek,
  getTokenPayload,
  getTopProducts,
  StatsToday,
  TopProduct,
  WeekDay,
} from '../api/dashboard';
import { getAllProducts, Product } from '../api/products';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => n.toLocaleString('fr-FR') + ' FCFA';
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'k';
  return String(n);
};

// ── Custom recharts tooltip ───────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-bordeaux/20 rounded-xl shadow-xl px-4 py-3 text-sm">
      <p className="font-bold text-bordeaux mb-1">{label}</p>
      <p className="text-gray-700">
        CA : <span className="font-bold">{Number(payload[0]?.value ?? 0).toLocaleString('fr-FR')} FCFA</span>
      </p>
      {payload[1] && (
        <p className="text-gray-500">Ventes : {payload[1].value}</p>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();

  // ── Auth guard — patron only ───────────────────────────────────────────────
  useEffect(() => {
    const payload = getTokenPayload();
    if (!payload || payload.role !== 'patron') {
      navigate('/');
    }
  }, [navigate]);

  // ── Data states ───────────────────────────────────────────────────────────
  const [statsToday,  setStatsToday]  = useState<StatsToday | null>(null);
  const [weekData,    setWeekData]    = useState<WeekDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [products,    setProducts]    = useState<Product[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getStatsToday(),
      getStatsWeek(),
      getTopProducts(),
      getAllProducts(),
    ])
      .then(([today, week, top, prods]) => {
        setStatsToday(today);
        setWeekData(week);
        setTopProducts(top);
        setProducts(prods);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Erreur chargement'))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const stockValue  = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const stockAlerts = products.filter(p => p.stock <= p.alertThreshold);

  const userName = getTokenPayload()?.name ?? 'Patron';
  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    navigate('/');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* ── Header ── */}
      <header className="bg-bordeaux flex items-center justify-between px-6 py-3 shadow-lg shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="text-cream/50 hover:text-cream mr-2 transition-colors text-xl leading-none"
          >
            ←
          </button>
          <span className="text-xl font-black tracking-widest text-cream">FAMILY</span>
          <span className="text-xl font-black tracking-widest text-gold">STORE</span>
          <span className="ml-3 pl-3 border-l border-cream/20 text-cream/60 text-sm font-medium">
            Dashboard
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-cream text-sm font-medium capitalize">{dateLabel}</p>
            <p className="text-cream/50 text-xs">{userName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-cream/10 hover:bg-cream/20
              text-cream text-sm font-medium px-3 py-1.5 rounded-lg transition-colors border
              border-cream/20"
          >
            <span>↗</span>
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      {/* ── Error ── */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700
          rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <span>✕</span>{error}
        </div>
      )}

      {/* ── Body ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col gap-6">

        {/* ── Row 1: 4 metric cards ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CA du jour"
            value={statsToday ? fmt(statsToday.totalCA) : null}
            subtitle={statsToday ? `${statsToday.marge}% de marge` : undefined}
            icon="💰"
            loading={loading}
          />
          <MetricCard
            title="Bénéfice net"
            value={statsToday ? fmt(statsToday.benefice) : null}
            subtitle="Ventes − coût d'achat"
            icon="📈"
            loading={loading}
            accent
          />
          <MetricCard
            title="Ventes aujourd'hui"
            value={statsToday ? String(statsToday.nbVentes) : null}
            subtitle={statsToday?.nbVentes === 1 ? 'transaction' : 'transactions'}
            icon="🧾"
            loading={loading}
          />
          <MetricCard
            title="Valeur du stock"
            value={loading ? null : fmt(stockValue)}
            subtitle={`${products.length} produits`}
            icon="📦"
            loading={loading}
          />
        </section>

        {/* ── Row 2: Chart + Top 5 ── */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* LineChart */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow border border-cream-dark p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-bordeaux text-sm uppercase tracking-widest">
                CA — 7 derniers jours
              </h3>
              {!loading && weekData.length > 0 && (
                <span className="text-xs text-gray-400">
                  Total :{' '}
                  <span className="font-semibold text-bordeaux">
                    {fmt(weekData.reduce((s, d) => s + d.totalCA, 0))}
                  </span>
                </span>
              )}
            </div>

            {loading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-bordeaux rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={weekData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F0E8" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickFormatter={fmtShort}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#C9A84C', strokeWidth: 1, strokeDasharray: '4 2' }} />
                  <Line
                    type="monotone"
                    dataKey="totalCA"
                    stroke="#8B1A2B"
                    strokeWidth={2.5}
                    dot={{ fill: '#8B1A2B', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#C9A84C', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 5 products */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow border border-cream-dark p-5">
            <h3 className="font-bold text-bordeaux text-sm uppercase tracking-widest mb-4">
              Top 5 — cette semaine
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-300 gap-2">
                <span className="text-3xl">📊</span>
                <span className="text-sm">Aucune vente cette semaine</span>
              </div>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <TopProductRow key={p._id} product={p} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Row 3: Stock alerts ── */}
        {!loading && stockAlerts.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-bold text-bordeaux text-sm uppercase tracking-widest">
                Alertes stock
              </h3>
              <span className="bg-red-500 text-white text-xs font-bold
                px-2 py-0.5 rounded-full animate-pulse">
                {stockAlerts.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stockAlerts.map(p => (
                <StockAlertCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* No alerts */}
        {!loading && stockAlerts.length === 0 && products.length > 0 && (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50
            border border-green-200 rounded-xl px-4 py-3">
            <span>✓</span>
            <span>Tous les stocks sont au-dessus des seuils d'alerte.</span>
          </div>
        )}

      </main>
    </div>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  title, value, subtitle, icon, loading, accent,
}: {
  title: string;
  value: string | null;
  subtitle?: string;
  icon: string;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 shadow border flex flex-col gap-2
      ${accent
        ? 'bg-bordeaux text-cream border-bordeaux'
        : 'bg-white text-gray-800 border-cream-dark'
      }`}
    >
      <div className="flex items-start justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider
          ${accent ? 'text-cream/60' : 'text-gray-400'}`}>
          {title}
        </p>
        <span className="text-xl">{icon}</span>
      </div>

      {loading ? (
        <div className={`h-8 rounded-lg animate-pulse ${accent ? 'bg-cream/20' : 'bg-gray-100'}`} />
      ) : (
        <p className={`text-2xl font-black leading-none
          ${accent ? 'text-gold' : 'text-bordeaux'}`}>
          {value ?? '—'}
        </p>
      )}

      {subtitle && (
        <p className={`text-xs ${accent ? 'text-cream/50' : 'text-gray-400'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── TopProductRow ─────────────────────────────────────────────────────────────

function TopProductRow({ product, rank }: { product: TopProduct; rank: number }) {
  const RANK_COLORS = ['text-gold', 'text-gray-500', 'text-amber-700', 'text-gray-400', 'text-gray-400'];

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className={`w-5 text-center font-black text-sm ${RANK_COLORS[rank - 1] ?? 'text-gray-400'}`}>
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-800 truncate leading-tight">
          {product.name}
        </p>
        {product.category && (
          <p className="text-xs text-gray-400">{product.category}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-sm text-bordeaux">
          {product.totalQty} {product.unit}
        </p>
        <p className="text-xs text-gray-400">
          {product.totalRevenue.toLocaleString('fr-FR')} FCFA
        </p>
      </div>
    </div>
  );
}

// ── StockAlertCard ────────────────────────────────────────────────────────────

function StockAlertCard({ product }: { product: Product }) {
  const isRupture = product.stock === 0;

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border
      ${isRupture
        ? 'bg-red-50 border-red-200'
        : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-800 truncate">{product.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Seuil : {product.alertThreshold} {product.unit}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xl font-black leading-none ${isRupture ? 'text-red-600' : 'text-amber-600'}`}>
          {product.stock}
        </p>
        <p className={`text-xs font-bold ${isRupture ? 'text-red-500' : 'text-amber-500'}`}>
          {isRupture ? 'rupture' : 'bas'}
        </p>
      </div>
    </div>
  );
}
