import React, { useCallback, useEffect, useState } from 'react';
import { getAllProducts, Product } from '../api/products';

type StockStatus = 'rupture' | 'critique' | 'alerte';

function getStatus(stock: number, threshold: number): StockStatus {
  if (stock === 0) return 'rupture';
  if (stock <= Math.ceil(threshold * 0.4)) return 'critique';
  return 'alerte';
}

const STATUS_STYLE: Record<StockStatus, { label: string; row: string; badge: string; bar: string }> = {
  rupture:  {
    label: 'Rupture',
    row:   'bg-red-50 border-l-4 border-l-red-500',
    badge: 'bg-red-100 text-red-700 border-red-300',
    bar:   'bg-red-500',
  },
  critique: {
    label: 'Critique',
    row:   'bg-orange-50 border-l-4 border-l-orange-500',
    badge: 'bg-orange-100 text-orange-700 border-orange-300',
    bar:   'bg-orange-500',
  },
  alerte:   {
    label: 'Alerte',
    row:   'bg-amber-50 border-l-4 border-l-amber-400',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    bar:   'bg-amber-400',
  },
};

function StockBar({ stock, threshold }: { stock: number; threshold: number }) {
  const pct = threshold > 0 ? Math.min(100, (stock / threshold) * 100) : 0;
  return (
    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all bg-red-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function Alertes() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllProducts();
      const low = all
        .filter(p => p.stock <= p.alertThreshold)
        .sort((a, b) => {
          // sort: rupture first, then by stock/threshold ratio ascending
          const ra = a.stock === 0 ? -1 : a.stock / a.alertThreshold;
          const rb = b.stock === 0 ? -1 : b.stock / b.alertThreshold;
          return ra - rb;
        });
      setProducts(low);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  const ruptures  = products.filter(p => p.stock === 0).length;
  const critiques = products.filter(p => p.stock > 0 && p.stock <= Math.ceil(p.alertThreshold * 0.4)).length;
  const alertes   = products.length - ruptures - critiques;

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 flex items-center justify-between
        px-6 py-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-bordeaux text-lg">Alertes Stock</h2>
          {products.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1
              rounded-full animate-pulse">
              {products.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs hidden sm:block">
            Actualisé à {lastRefresh.toLocaleTimeString('fr-FR')}
          </span>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="text-gray-400 hover:text-gray-700 transition-colors text-sm
              disabled:opacity-40"
            title="Actualiser"
          >
            ↻
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-6 flex flex-col gap-6">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ruptures',  count: ruptures,  color: 'border-red-200 bg-red-50',    num: 'text-red-600' },
            { label: 'Critiques', count: critiques, color: 'border-orange-200 bg-orange-50', num: 'text-orange-600' },
            { label: 'Alertes',   count: alertes,   color: 'border-amber-200 bg-amber-50', num: 'text-amber-600' },
          ].map(s => (
            <div key={s.label}
              className={`rounded-2xl border-2 ${s.color} px-4 py-3 text-center`}>
              <p className={`font-black text-2xl ${s.num}`}>{s.count}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl
            px-4 py-3 text-sm flex items-center gap-2">
            <span>✕</span>{error}
            <button onClick={fetchAlerts} className="ml-auto underline text-xs">
              Réessayer
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && products.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-bordeaux/20 border-t-bordeaux
              rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && products.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20
            text-gray-300 gap-3">
            <span className="text-5xl">✓</span>
            <p className="font-semibold text-gray-400">Tous les stocks sont suffisants</p>
            <p className="text-sm text-gray-300">Aucune alerte en ce moment</p>
          </div>
        )}

        {/* Alert list */}
        {products.length > 0 && (
          <div className="bg-white rounded-2xl shadow border border-cream-dark overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center
              justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Produits sous le seuil d'alerte
              </p>
              <p className="text-xs text-gray-400">
                {products.length} produit{products.length > 1 ? 's' : ''}
              </p>
            </div>

            <div className="divide-y divide-gray-50">
              {products.map(p => {
                const status = getStatus(p.stock, p.alertThreshold);
                const style  = STATUS_STYLE[status];
                return (
                  <div key={p._id}
                    className={`flex items-center gap-4 px-5 py-4 ${style.row}`}>

                    {/* Name + barcode */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm leading-tight truncate">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.barcode && (
                          <span className="font-mono text-xs text-gray-400">
                            {p.barcode}
                          </span>
                        )}
                        {p.category && (
                          <span className="text-xs text-gray-400">{p.category}</span>
                        )}
                      </div>
                    </div>

                    {/* Stock + bar */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-gray-400 mb-1">Stock / Seuil</p>
                      <StockBar stock={p.stock} threshold={p.alertThreshold} />
                    </div>

                    {/* Numbers */}
                    <div className="text-right shrink-0">
                      <p className="font-black text-xl text-red-600">
                        {p.stock}
                        <span className="text-xs font-normal text-gray-400 ml-1">
                          {p.unit}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">
                        seuil : {p.alertThreshold}
                      </p>
                    </div>

                    {/* Badge */}
                    <div className="shrink-0">
                      <span className={`inline-block text-xs font-bold px-2.5 py-1
                        rounded-full border ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notification hint */}
        <p className="text-center text-xs text-gray-400 pb-2">
          Actualisation automatique toutes les minutes — autorisez les notifications navigateur pour les alertes en temps réel
        </p>
      </main>
    </div>
  );
}
