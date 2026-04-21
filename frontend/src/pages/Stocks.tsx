import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addStock, getAllProducts, getProductByBarcode, Product } from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';

// ── Stock status helpers ──────────────────────────────────────────────────────

type StockStatus = 'ok' | 'alert' | 'rupture';

function getStatus(stock: number, threshold: number): StockStatus {
  if (stock === 0) return 'rupture';
  if (stock <= threshold) return 'alert';
  return 'ok';
}

const STATUS_BADGE: Record<StockStatus, { label: string; classes: string }> = {
  ok:      { label: 'OK',      classes: 'bg-green-100 text-green-700 border-green-200' },
  alert:   { label: 'Alerte',  classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  rupture: { label: 'Rupture', classes: 'bg-red-100   text-red-700   border-red-200'   },
};

const STOCK_COLOR: Record<StockStatus, string> = {
  ok:      'text-green-700',
  alert:   'text-amber-600',
  rupture: 'text-red-600 font-black',
};

// ── Component ─────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'alert';

export default function Stocks() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  // ── Products list ──────────────────────────────────────────────────────────
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter]       = useState<FilterMode>('all');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const displayed = filter === 'alert'
    ? products.filter(p => p.stock <= p.alertThreshold)
    : products;

  const alertCount = products.filter(p => p.stock <= p.alertThreshold).length;

  // ── Reception form ─────────────────────────────────────────────────────────
  const receptionInputRef         = useRef<HTMLInputElement>(null);
  const qtyInputRef               = useRef<HTMLInputElement>(null);
  const [rcBarcode, setRcBarcode] = useState('');
  const [rcProduct, setRcProduct] = useState<Product | null>(null);
  const [rcQty, setRcQty]         = useState<number>(1);
  const [rcError, setRcError]     = useState<string | null>(null);
  const [rcScanning, setRcScanning] = useState(false);
  const [rcSubmitting, setRcSubmitting] = useState(false);

  const handleRcScan = useCallback(async () => {
    const code = rcBarcode.trim();
    if (!code) return;
    setRcError(null);
    setRcScanning(true);
    try {
      const product = await getProductByBarcode(code);
      setRcProduct(product);
      setRcQty(1);
      setTimeout(() => qtyInputRef.current?.focus(), 0);
    } catch (err: unknown) {
      setRcError(err instanceof Error ? err.message : 'Produit introuvable');
      setRcProduct(null);
    } finally {
      setRcScanning(false);
    }
  }, [rcBarcode]);

  const handleRcSubmit = useCallback(async () => {
    if (!rcProduct || rcQty <= 0 || rcSubmitting) return;
    setRcSubmitting(true);
    try {
      const updated = await addStock(rcProduct._id, rcQty);
      // update product in list without re-fetching
      setProducts(prev => prev.map(p => p._id === updated._id ? updated : p));
      addToast(
        `+${rcQty} ${updated.unit} ajouté — ${updated.name} (stock : ${updated.stock})`,
        'success',
      );
      // reset form
      setRcBarcode('');
      setRcProduct(null);
      setRcQty(1);
      setTimeout(() => receptionInputRef.current?.focus(), 0);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erreur ajout stock', 'error');
    } finally {
      setRcSubmitting(false);
    }
  }, [rcProduct, rcQty, rcSubmitting, addToast]);

  const rcStatus = rcProduct ? getStatus(rcProduct.stock, rcProduct.alertThreshold) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-cream overflow-hidden">

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Header ── */}
      <header className="bg-bordeaux flex items-center justify-between px-6 py-3 shadow-lg shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="text-cream/50 hover:text-cream mr-2 transition-colors text-xl leading-none"
            title="Accueil"
          >
            ←
          </button>
          <span className="text-xl font-black tracking-widest text-cream">FAMILY</span>
          <span className="text-xl font-black tracking-widest text-gold">STORE</span>
          <span className="ml-3 pl-3 border-l border-cream/20 text-cream/60 text-sm font-medium">
            Stocks
          </span>
        </div>
        <div className="flex items-center gap-3">
          {alertCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
              {alertCount} alerte{alertCount > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="text-cream/60 hover:text-cream transition-colors text-sm disabled:opacity-40"
            title="Actualiser"
          >
            ↻
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Products table */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Table toolbar */}
          <div className="px-6 pt-4 pb-3 flex items-center gap-3 shrink-0">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
              {(['all', 'alert'] as FilterMode[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors
                    ${filter === f
                      ? 'bg-bordeaux text-cream'
                      : 'text-gray-500 hover:bg-cream'
                    }`}
                >
                  {f === 'all'
                    ? `Tous (${products.length})`
                    : `En alerte (${alertCount})`
                  }
                </button>
              ))}
            </div>
            {loading && (
              <span className="text-xs text-gray-400 animate-pulse">Chargement…</span>
            )}
          </div>

          {/* Error */}
          {loadError && (
            <div className="mx-6 mb-3 bg-red-50 border border-red-200 text-red-700
              rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <span>✕</span>
              <span>{loadError}</span>
              <button
                onClick={fetchProducts}
                className="ml-auto underline text-xs hover:no-underline"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {!loading && displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2">
                <span className="text-4xl">📦</span>
                <span className="text-sm">
                  {filter === 'alert' ? 'Aucune alerte stock' : 'Aucun produit'}
                </span>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="pb-3 pt-1 text-xs text-gray-400 uppercase tracking-wider font-semibold pr-4">
                      Produit
                    </th>
                    <th className="pb-3 pt-1 text-xs text-gray-400 uppercase tracking-wider font-semibold pr-4 hidden lg:table-cell">
                      Code-barres
                    </th>
                    <th className="pb-3 pt-1 text-xs text-gray-400 uppercase tracking-wider font-semibold pr-4 hidden md:table-cell">
                      Catégorie
                    </th>
                    <th className="pb-3 pt-1 text-xs text-gray-400 uppercase tracking-wider font-semibold pr-4 text-right">
                      Stock
                    </th>
                    <th className="pb-3 pt-1 text-xs text-gray-400 uppercase tracking-wider font-semibold pr-4 text-right hidden sm:table-cell">
                      Seuil
                    </th>
                    <th className="pb-3 pt-1 text-xs text-gray-400 uppercase tracking-wider font-semibold text-center">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayed.map(p => {
                    const status = getStatus(p.stock, p.alertThreshold);
                    const badge  = STATUS_BADGE[status];
                    return (
                      <tr
                        key={p._id}
                        className={`transition-colors hover:bg-white
                          ${status !== 'ok' ? 'bg-red-50/40' : ''}`}
                      >
                        <td className="py-3 pr-4">
                          <div>
                            <p className="font-semibold text-gray-800 leading-tight">{p.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{p.unit}</p>
                          </div>
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell">
                          <span className="font-mono text-xs text-gray-500 bg-gray-100
                            px-2 py-0.5 rounded">
                            {p.barcode ?? '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-500 hidden md:table-cell">
                          {p.category ?? '—'}
                        </td>
                        <td className={`py-3 pr-4 text-right font-bold text-base ${STOCK_COLOR[status]}`}>
                          {p.stock}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-400 hidden sm:table-cell">
                          {p.alertThreshold}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs
                            font-bold border ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT — Réception marchandise */}
        <aside className="hidden md:flex w-[360px] flex-col bg-white border-l border-gray-100 shadow-xl">

          {/* Form header */}
          <div className="bg-bordeaux/5 border-b border-bordeaux/15 px-5 py-3 shrink-0">
            <h2 className="font-bold text-bordeaux text-sm uppercase tracking-widest">
              Réception marchandise
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Scannez un produit pour augmenter son stock
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

            {/* Barcode input */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Code-barres produit
              </label>
              <div className="relative">
                <input
                  ref={receptionInputRef}
                  type="text"
                  value={rcBarcode}
                  onChange={e => { setRcBarcode(e.target.value); setRcError(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleRcScan()}
                  placeholder="Scanner ou saisir…"
                  disabled={rcScanning || rcSubmitting}
                  className={`w-full px-4 py-3 rounded-xl border-2 outline-none text-sm
                    bg-cream placeholder-gray-300 transition-colors
                    ${rcError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-bordeaux/25 focus:border-bordeaux'
                    }`}
                />
                {rcScanning && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2
                    text-bordeaux text-xs animate-pulse">
                    …
                  </span>
                )}
              </div>
              {rcError && (
                <p className="mt-1.5 text-red-600 text-xs flex items-center gap-1">
                  <span>✕</span>
                  {rcError}
                </p>
              )}
            </div>

            {/* Product preview */}
            {rcProduct && (
              <div className={`rounded-xl border-2 p-4 transition-colors
                ${rcStatus !== 'ok'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-green-200 bg-green-50'
                }`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 text-sm leading-tight truncate">
                      {rcProduct.name}
                    </p>
                    {rcProduct.barcode && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{rcProduct.barcode}</p>
                    )}
                  </div>
                  {rcStatus && (
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border
                      ${STATUS_BADGE[rcStatus].classes}`}>
                      {STATUS_BADGE[rcStatus].label}
                    </span>
                  )}
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Stock actuel</p>
                    <p className={`font-black text-xl ${rcStatus ? STOCK_COLOR[rcStatus] : ''}`}>
                      {rcProduct.stock}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Seuil alerte</p>
                    <p className="font-bold text-xl text-gray-500">{rcProduct.alertThreshold}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Unité</p>
                    <p className="font-bold text-xl text-gray-500">{rcProduct.unit}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Quantité à ajouter
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRcQty(q => Math.max(1, q - 1))}
                  disabled={!rcProduct || rcSubmitting}
                  className="w-10 h-10 rounded-xl bg-cream border border-bordeaux/20
                    hover:bg-bordeaux hover:text-cream hover:border-bordeaux
                    text-bordeaux font-bold text-lg flex items-center justify-center
                    transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  −
                </button>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min={1}
                  value={rcQty}
                  onChange={e => setRcQty(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={!rcProduct || rcSubmitting}
                  className="flex-1 text-center py-2.5 rounded-xl border-2 border-bordeaux/25
                    focus:border-bordeaux outline-none font-bold text-lg
                    disabled:opacity-40 disabled:bg-gray-50"
                />
                <button
                  onClick={() => setRcQty(q => q + 1)}
                  disabled={!rcProduct || rcSubmitting}
                  className="w-10 h-10 rounded-xl bg-cream border border-bordeaux/20
                    hover:bg-bordeaux hover:text-cream hover:border-bordeaux
                    text-bordeaux font-bold text-lg flex items-center justify-center
                    transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  +
                </button>
              </div>
              {rcProduct && (
                <p className="mt-2 text-xs text-gray-400 text-center">
                  Stock après réception :{' '}
                  <span className="font-bold text-green-600">
                    {rcProduct.stock + rcQty} {rcProduct.unit}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="border-t border-gray-100 px-5 py-4 shrink-0">
            <button
              onClick={handleRcSubmit}
              disabled={!rcProduct || rcQty <= 0 || rcSubmitting}
              className="w-full py-3.5 bg-bordeaux text-cream font-black text-sm
                rounded-xl border-2 border-gold tracking-widest uppercase
                hover:bg-bordeaux-dark transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              {rcSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-cream/40 border-t-cream
                    rounded-full animate-spin" />
                  Enregistrement…
                </span>
              ) : (
                `Enregistrer +${rcQty} unité${rcQty > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
