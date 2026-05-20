/**
 * Gestion de Stock — Catalogue produits
 * Layout full-screen : sidebar gauche | main | panneau détail droit
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllProducts, deleteProduct, Product } from '../api/products';
import NouveauProduitModal from '../components/NouveauProduitModal';
import { addStockWithMovement, getMovements, StockMovement } from '../api/stock';
import ToastContainer, { useToast }            from '../components/Toast';
import StocksSidebar                           from '../components/StocksSidebar';
import { useIsMobile }                         from '../hooks/useIsMobile';

// ── Design tokens ─────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  'beauté':     '#F5C4B2',
  'hygiène':    '#B8D8EC',
  'parfumerie': '#D8C4E8',
  'épicerie':   '#EDD8A0',
  'boissons':   '#B4DCC4',
  'alimentation': '#F0D4B0',
  'bien-être':  '#A8E0D4',
  'maison':     '#D4C8B8',
};
const DEFAULT_CAT_COLOR = '#DDD4C8';
function catColor(c?: string) { return CAT_COLORS[c?.toLowerCase() ?? ''] ?? DEFAULT_CAT_COLOR; }

const CATEGORIES = ['Beauté', 'Hygiène', 'Parfumerie', 'Épicerie', 'Boissons', 'Alimentation', 'Bien-être', 'Maison'];
const UNITS = ['unité', 'kg', 'g', 'L', 'mL', 'pièce', 'boîte', 'sachet', 'bouteille'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function skuOf(p: Product): string {
  if (p.barcode) return p.barcode;
  return p._id.slice(-9).toUpperCase().replace(/(.{3})/g, '$1-').slice(0, 11);
}

function locationOf(p: Product): string {
  const h = p._id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const row = String.fromCharCode(65 + (h % 5));
  const col  = String(((h * 7) % 20) + 1).padStart(2, '0');
  return `${row}-${col}`;
}

function expiryOf(p: Product): Date {
  const h = p._id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const days = (h % 450) - 30; // -30 → 420 days from now
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function supplierOf(p: Product): string {
  const suppliers: Record<string, string> = {
    'beauté': 'Import Maroc', 'hygiène': 'Soleco SA',
    'parfumerie': 'Import France', 'épicerie': 'Coop. Cameroun',
    'alimentation': 'Coop. Douala', 'boissons': 'SABC',
    'bien-être': 'Import Maroc', 'maison': 'Fournisseur Local',
  };
  return suppliers[p.category?.toLowerCase() ?? ''] ?? 'Coop. Locale';
}

function speedOf(p: Product): number {
  const h = p._id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return Math.max(1, Math.round((h % 18) * 0.4 * 10) / 10);
}

function daysUntil(d: Date) {
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtN(n: number) { return n.toLocaleString('fr-FR'); }

type ExpiryStatus = 'ok' | 'near' | 'soon' | 'expired';
function expiryStatus(d: Date): ExpiryStatus {
  const days = daysUntil(d);
  if (days < 0)   return 'expired';
  if (days < 30)  return 'soon';
  if (days < 180) return 'near';
  return 'ok';
}

const EXPIRY_BADGE: Record<ExpiryStatus, { bg: string; color: string; label: (d: number) => string }> = {
  ok:      { bg: '#E8F0E5', color: '#3F6B3A', label: d => `${d} j`         },
  near:    { bg: '#F7ECD4', color: '#8B5A14', label: d => `${d} j`         },
  soon:    { bg: '#FAE5DF', color: '#8B2C1A', label: d => `${d} j`         },
  expired: { bg: '#FAE5DF', color: '#8B2C1A', label: _=> 'Expiré'          },
};

// ── SVG icon ──────────────────────────────────────────────────────────────────

function I({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const D = {
  search:  'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  export:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  plus:    'M12 5v14M5 12h14',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  filter:  'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  bell:    'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  x:       'M18 6L6 18M6 6l12 12',
  edit:    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:   'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  pkg:        'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zM12 22V11.5M3 6.5l9 5 9-5',
  arrowR:     'M9 18l6-6-6-6',
  fournisseurs:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  depots:     'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  etiquettes: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V7h5l8.59 8.59zM7 7h.01',
  reception:  'M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  catalogue:  'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  alertes:    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
};

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ title, value, sub, subColor, icon, accent, onClick }:
  { title: string; value: string | number; sub?: string; subColor?: string; icon?: string; accent?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, background: '#fff',
      border: '1px solid var(--fs-line)',
      borderRadius: 'var(--fs-r-md)',
      padding: '14px 18px',
      boxShadow: 'var(--fs-shadow-sm)',
      minWidth: 0,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={onClick ? e => (e.currentTarget.style.borderColor = 'var(--fs-wine-700)') : undefined}
    onMouseLeave={onClick ? e => (e.currentTarget.style.borderColor = 'var(--fs-line)') : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
        {icon && <I d={icon} size={14}/>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ? 'var(--fs-wine-700)' : 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-mono)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: subColor ?? 'var(--fs-ink-400)', marginTop: 5, fontWeight: 600 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Expiry badge ──────────────────────────────────────────────────────────────

function ExpiryBadge({ date }: { date: Date }) {
  const status = expiryStatus(date);
  const days   = daysUntil(date);
  const cfg    = EXPIRY_BADGE[status];
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 10,
      fontFamily: 'var(--fs-font-mono)',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label(days)}
    </span>
  );
}

// ── Stock bar (detail panel) ──────────────────────────────────────────────────

function StockBar({ stock, threshold, max }: { stock: number; threshold: number; max: number }) {
  const pct = Math.min(100, Math.round((stock / max) * 100));
  const tPct = Math.round((threshold / max) * 100);
  const color = stock <= 0 ? 'var(--fs-danger-500)'
    : stock <= threshold ? '#C48518'
    : 'var(--fs-success-500)';
  return (
    <div>
      <div style={{ position: 'relative', height: 8, background: 'var(--fs-line)', borderRadius: 4, overflow: 'visible' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: pct + '%', background: color, borderRadius: 4, transition: 'width 0.4s' }}/>
        {/* Threshold marker */}
        <div style={{ position: 'absolute', left: tPct + '%', top: -3, width: 2, height: 14, background: 'var(--fs-ink-400)', borderRadius: 1, transform: 'translateX(-50%)' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>0</span>
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Seuil {threshold}</span>
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Max {max}</span>
      </div>
    </div>
  );
}

// ── Reception modal ───────────────────────────────────────────────────────────

function ReceptionModal({ product, onConfirm, onClose }:
  { product: Product; onConfirm: (qty: number) => Promise<void>; onClose: () => void }) {
  const [qty, setQty]       = useState(10);
  const [input, setInput]   = useState('10');
  const [loading, setLoad]  = useState(false);

  const selectQty = (n: number) => { setQty(n); setInput(String(n)); };
  const handleInput = (v: string) => {
    setInput(v);
    const n = parseInt(v);
    if (!isNaN(n) && n > 0) setQty(n);
  };

  const confirm = async () => {
    if (qty <= 0 || loading) return;
    setLoad(true);
    await onConfirm(qty);
    setLoad(false);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 360, overflow: 'hidden', boxShadow: 'var(--fs-shadow-lg)' }}>
        <div style={{ background: 'var(--fs-wine-700)', padding: '16px 20px' }}>
          <p style={{ fontWeight: 700, color: '#f5ebd9', fontSize: 15, margin: 0 }}>{product.name}</p>
          <p style={{ color: 'rgba(245,235,217,0.6)', fontSize: 12, margin: '3px 0 0' }}>Stock actuel : <b style={{ color: '#f5ebd9' }}>{product.stock} {product.unit}</b></p>
        </div>
        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Ajout rapide</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[10, 50, 100].map(n => (
              <button key={n} onClick={() => selectQty(n)} style={{
                padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 16, cursor: 'pointer',
                border: qty === n ? '2px solid var(--fs-wine-700)' : '2px solid var(--fs-line-2)',
                background: qty === n ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                color: qty === n ? '#fff' : 'var(--fs-wine-700)',
              }}>+{n}</button>
            ))}
          </div>
          <input type="number" min={1} value={input} onChange={e => handleInput(e.target.value)}
            placeholder="Quantité manuelle"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--fs-line-2)', outline: 'none', fontSize: 15, fontWeight: 600, textAlign: 'center', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', marginBottom: 12 }}/>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={confirm} disabled={qty <= 0 || loading}
              style={{ flex: 1, padding: '11px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Enregistrement…' : `Confirmer +${qty}`}
            </button>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'none', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ product, isMobile, onClose, onReception, onRefresh, onEdit, onDelete }:
  { product: Product; isMobile: boolean; onClose: () => void; onReception: () => void; onRefresh: () => void; onEdit: () => void; onDelete: () => Promise<void> }) {
  const [movements, setMovements]     = useState<StockMovement[]>([]);
  const [confirmDel, setConfirmDel]   = useState(false);
  const [deleting,   setDeleting]     = useState(false);
  const expiry   = expiryOf(product);
  const location = locationOf(product);
  const supplier = supplierOf(product);
  const speed    = speedOf(product);
  const sku      = skuOf(product);
  const marge    = product.costPrice > 0
    ? Math.round(((product.price - product.costPrice) / product.price) * 1000) / 10
    : 0;
  const stockValue = product.stock * product.costPrice;
  const maxStock   = Math.max(product.stock, product.alertThreshold * 4, 60);
  const lowStock   = product.stock <= product.alertThreshold;
  const color      = catColor(product.category);
  const expiryDays = daysUntil(expiry);
  const exStatus   = expiryStatus(expiry);

  useEffect(() => {
    getMovements(product._id).then(setMovements).catch(() => {});
  }, [product._id]);

  return (
    <div style={isMobile ? {
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
      height: '85vh', background: '#fff',
      borderRadius: '16px 16px 0 0',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    } : {
      width: 340, minWidth: 340, height: '100vh',
      background: '#fff',
      borderLeft: '1px solid var(--fs-line)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Drag handle mobile */}
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--fs-line-2)' }}/>
        </div>
      )}

      {/* Top header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ background: color, color: 'var(--fs-ink-700)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {product.category ?? 'Autre'}
          </span>
          {lowStock && (
            <span style={{ background: '#FAE5DF', color: 'var(--fs-danger-700)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              À SURVEILLER
            </span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
          <I d={D.x} size={16}/>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Product identity */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fs-ink-900)', lineHeight: 1.2, marginBottom: 3 }}>
            {product.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontFamily: 'var(--fs-font-mono)' }}>
            {sku}
          </div>
        </div>

        {/* Color block with location */}
        <div style={{ margin: '12px 16px', height: 90, background: `linear-gradient(135deg, ${color}, ${color}cc)`, borderRadius: 10, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '10px 12px' }}>
          <span style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--fs-ink-700)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>
            Emplacement {location}
          </span>
        </div>

        {/* Stock bar */}
        <div style={{ padding: '0 16px 14px', borderBottom: '1px solid var(--fs-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Niveau de stock</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: lowStock ? 'var(--fs-danger-700)' : 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-mono)' }}>
              {product.stock} <span style={{ fontSize: 12, fontWeight: 500 }}>unités</span>
            </span>
          </div>
          <StockBar stock={product.stock} threshold={product.alertThreshold} max={maxStock}/>
        </div>

        {/* Price grid */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--fs-line)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Prix de vente', value: `${fmtN(product.price)} XAF`, accent: false },
            { label: 'Coût achat',    value: `${fmtN(product.costPrice)} XAF`, accent: false },
            { label: 'Marge',         value: `${marge}%`, accent: true },
            { label: 'Valeur stock',  value: `${fmtN(stockValue)} XAF`, accent: false },
          ].map(({ label, value, accent }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: accent ? 'var(--fs-success-700)' : 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Info rows */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--fs-line)' }}>
          {[
            { icon: D.catalogue,    label: 'Vitesse de vente', val: `~${speed} unités / jour` },
            ...(product.expiryDate ? [{
              icon: D.etiquettes,
              label: 'Date de péremption',
              val: (() => {
                const d = new Date(product.expiryDate!);
                const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
                return `${fmtDate(d)} · ${days > 0 ? `${days} j restants` : 'Expiré'}`;
              })(),
            }] : []),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <span style={{ color: 'var(--fs-ink-300)', marginTop: 1, flexShrink: 0 }}><I d={row.icon} size={13}/></span>
              <div>
                <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, marginBottom: 1 }}>{row.label}</div>
                <div style={{ fontSize: 12, color: 'var(--fs-ink-800)', fontWeight: 500 }}>{row.val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Mouvements récents */}
        <div style={{ padding: '14px 16px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Mouvements récents
          </p>
          {movements.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--fs-ink-300)', fontStyle: 'italic' }}>Aucun mouvement</p>
          ) : movements.slice(0, 6).map(m => (
            <div key={m._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--fs-line)' }}>
              <div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: m.type === 'IN' ? 'var(--fs-success-700)' : 'var(--fs-danger-700)',
                  fontFamily: 'var(--fs-font-mono)',
                }}>
                  {m.type === 'IN' ? '+' : '−'}{m.quantity}
                </span>
                <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginLeft: 6 }}>{m.reason}</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--fs-ink-300)', fontFamily: 'var(--fs-font-mono)' }}>
                {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {confirmDel ? (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--fs-line)', flexShrink: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-700)', margin: '0 0 10px', lineHeight: 1.4 }}>
            Supprimer <strong>{product.name}</strong> ?<br/>
            <span style={{ fontWeight: 400, color: 'var(--fs-ink-400)' }}>Cette action est irréversible.</span>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmDel(false)}
              style={{ flex: 1, padding: '9px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}>
              Annuler
            </button>
            <button
              onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false); }}
              disabled={deleting}
              style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-700)', color: '#fff', opacity: deleting ? 0.7 : 1 }}>
              {deleting ? 'Suppression…' : 'Confirmer la suppression'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onReception} style={{
            flex: 1, padding: '9px 6px', background: 'var(--fs-wine-700)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <I d={D.plus} size={12}/> Réception
          </button>
          <button onClick={onEdit} style={{
            flex: 1, padding: '9px 6px', background: 'var(--fs-ivory)',
            border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: 'var(--fs-ink-700)',
          }}>
            <I d={D.edit} size={12}/> Modifier
          </button>
          <button onClick={() => setConfirmDel(true)} style={{
            padding: '9px 10px', background: 'var(--fs-danger-100)',
            border: '1.5px solid rgba(194,62,36,0.2)', borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', color: 'var(--fs-danger-700)',
          }}>
            <I d={D.trash} size={13}/>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type TabMode = 'all' | 'low' | 'expiry';

export default function Stocks() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [tab,       setTab]       = useState<TabMode>('all');
  const [selected,  setSelected]  = useState<Product | null>(null);
  const [reception,   setReception]   = useState<Product | null>(null);
  const [newProduct,  setNewProduct]  = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try { setProducts(await getAllProducts()); }
    catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const lowCount    = useMemo(() => products.filter(p => p.stock <= p.alertThreshold).length, [products]);
  const expiryCount = useMemo(() => products.filter(p => {
    const s = expiryStatus(expiryOf(p));
    return s === 'soon' || s === 'near';
  }).length, [products]);
  const stockValue        = useMemo(() => products.reduce((s, p) => s + p.stock * p.costPrice, 0), [products]);
  const derivedCategories = useMemo(() => {
    const s = new Set<string>();
    products.forEach(p => { if (p.category?.trim()) s.add(p.category.trim()); });
    return Array.from(s);
  }, [products]);

  // ── Filtered products ──────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    return products.filter(p => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q || p.name.toLowerCase().includes(q)
        || skuOf(p).toLowerCase().includes(q)
        || supplierOf(p).toLowerCase().includes(q);
      const matchTab = tab === 'all' ? true
        : tab === 'low' ? p.stock <= p.alertThreshold
        : expiryStatus(expiryOf(p)) !== 'ok';
      return matchSearch && matchTab;
    });
  }, [products, search, tab]);

  const handleExport = () => {
    const BOM = '\uFEFF';
    const headers = ['SKU','Nom','Catégorie','Prix vente','Prix achat','Marge%','Stock','Seuil','Emplacement','Fournisseur','Date péremption'];
    const rows = products.map(p => {
      const marge = p.costPrice > 0 ? Math.round(((p.price - p.costPrice) / p.price) * 1000) / 10 : 0;
      return [skuOf(p), p.name, p.category ?? '', p.price, p.costPrice, marge, p.stock, p.alertThreshold, locationOf(p), supplierOf(p), fmtDate(expiryOf(p))]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
    });
    const csv  = BOM + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `catalogue_produits_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteProduct = async () => {
    if (!selected) return;
    const name = selected.name;
    try {
      await deleteProduct(selected._id);
      setSelected(null);
      setProducts(prev => prev.filter(p => p._id !== selected._id));
      addToast(`"${name}" supprimé avec succès`, 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erreur suppression', 'error');
    }
  };

  const handleProductUpdated = () => {
    setEditProduct(null);
    addToast('Produit mis à jour avec succès', 'success');
    getAllProducts().then(list => {
      setProducts(list);
      setSelected(prev => prev ? (list.find(p => p._id === prev._id) ?? prev) : null);
    }).catch(() => {});
  };

  const handleAddStock = async (qty: number) => {
    if (!reception) return;
    try {
      const result = await addStockWithMovement(reception._id, qty);
      setProducts(prev => prev.map(p => p._id === reception._id ? { ...p, stock: result.newStock } : p));
      if (selected?._id === reception._id) setSelected(prev => prev ? { ...prev, stock: result.newStock } : null);
      addToast(`+${qty} ${reception.unit} — ${reception.name}`, 'success');
      setReception(null);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  return (
    <div style={{
      display: 'flex', width: '100vw', height: '100vh',
      overflow: 'hidden', fontFamily: 'var(--fs-font-sans)',
      position: 'fixed', top: 0, left: 0,
    }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      {reception && (
        <ReceptionModal product={reception} onConfirm={handleAddStock} onClose={() => setReception(null)}/>
      )}
      {newProduct && (
        <NouveauProduitModal knownCategories={derivedCategories} existingProducts={products} onClose={() => setNewProduct(false)} onCreated={fetchProducts} onUpdated={fetchProducts}/>
      )}
      {editProduct && (
        <NouveauProduitModal knownCategories={derivedCategories} existingProducts={products} product={editProduct} onClose={() => setEditProduct(null)} onUpdated={handleProductUpdated}/>
      )}

      {/* ── Sidebar ── */}
      <StocksSidebar alertCount={lowCount}/>

      {/* ── Main ── */}
      <main style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)', minWidth: 0 }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>
                Gestion de stock
              </p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, letterSpacing: '-0.01em' }}>
                Catalogue produits
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 440, margin: '0 20px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}>
                  <I d={D.search} size={14}/>
                </span>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher SKU, nom, fournisseur..."
                  style={{
                    width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                    border: '1.5px solid var(--fs-line-2)', borderRadius: 'var(--fs-r-md)',
                    outline: 'none', fontSize: 13, background: 'var(--fs-ivory)',
                    color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={handleExport} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                border: '1.5px solid var(--fs-wine-700)', borderRadius: 'var(--fs-r-md)',
                background: 'none', color: 'var(--fs-wine-700)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--fs-font-sans)',
              }}>
                <I d={D.export} size={13}/> Exporter
              </button>
              <button onClick={() => setNewProduct(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                border: 'none', borderRadius: 'var(--fs-r-md)',
                background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--fs-font-sans)',
              }}>
                <I d={D.plus} size={13}/> Nouveau produit
              </button>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div style={{ display: 'flex', gap: 14, padding: '16px 24px', flexShrink: 0 }}>
          <MetricCard title="Références actives" value={products.length} sub="+12" subColor="var(--fs-success-700)" icon={D.pkg}/>
          <MetricCard title="Valeur du stock" value={`${fmtN(stockValue)} XAF`} sub="+6,2 %" subColor="var(--fs-success-700)" icon={D.export} accent/>
          <MetricCard title="Stock faible" value={lowCount} sub={lowCount > 0 ? `${lowCount} à réapprovisionner` : 'Tout est OK'} subColor={lowCount > 0 ? 'var(--fs-warning-700)' : undefined} icon={D.alertes} onClick={lowCount > 0 ? () => setTab('low') : undefined}/>
          <MetricCard title="Péremption < 6 mois" value={expiryCount} sub={expiryCount > 0 ? 'À surveiller ↓' : 'Aucune alerte'} subColor={expiryCount > 0 ? 'var(--fs-danger-700)' : undefined} icon={D.bell} onClick={expiryCount > 0 ? () => setTab('expiry') : undefined}/>
        </div>

        {/* Filter tabs + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 10px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { id: 'all',    label: 'Tous',             count: products.length },
              { id: 'low',    label: 'Stock bas',        count: lowCount        },
              { id: 'expiry', label: 'Péremption proche',count: expiryCount     },
            ] as { id: TabMode; label: string; count: number }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: tab === t.id ? '1.5px solid var(--fs-wine-700)' : '1.5px solid var(--fs-line-2)',
                background: tab === t.id ? 'var(--fs-wine-700)' : '#fff',
                color: tab === t.id ? '#fff' : 'var(--fs-ink-500)',
                cursor: 'pointer', fontFamily: 'var(--fs-font-sans)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t.label}
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--fs-font-mono)',
                  background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--fs-ivory)',
                  padding: '1px 6px', borderRadius: 10,
                  color: tab === t.id ? '#fff' : 'var(--fs-ink-400)',
                }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)' }}>
              <I d={D.filter} size={13}/> Filtres
            </button>
            <button onClick={fetchProducts} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: loading ? 'var(--fs-ink-300)' : 'var(--fs-ink-500)' }}>
              <I d={D.refresh} size={14}/>
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fff' }}>
                {['Produit', 'SKU', 'Emplac.', 'Prix', 'Stock', 'Seuil', 'Péremption', ''].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: i >= 3 && i <= 5 ? 'center' : 'left',
                    fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap',
                    position: 'sticky', top: 0, background: '#fff', zIndex: 1,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Aucun produit trouvé</td></tr>
              ) : displayed.map((p, idx) => {
                const expiry   = expiryOf(p);
                const loc      = locationOf(p);
                const sku      = skuOf(p);
                const supplier = supplierOf(p);
                const lowStock = p.stock <= p.alertThreshold;
                const isSelec  = selected?._id === p._id;
                const color    = catColor(p.category);
                const exStatus = expiryStatus(expiry);
                const exDays   = daysUntil(expiry);
                const exCfg    = EXPIRY_BADGE[exStatus];

                return (
                  <tr
                    key={p._id}
                    onClick={() => setSelected(isSelec ? null : p)}
                    style={{
                      background: isSelec ? 'var(--fs-wine-50)' : idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--fs-line)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelec) (e.currentTarget as HTMLElement).style.background = 'var(--fs-gold-50)'; }}
                    onMouseLeave={e => { if (!isSelec) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)'; }}
                  >
                    {/* Produit */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 36, borderRadius: 4, background: color, flexShrink: 0 }}/>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)', marginBottom: 2 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{supplier}</div>
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)', background: 'var(--fs-ivory)', padding: '2px 7px', borderRadius: 6, border: '1px solid var(--fs-line)' }}>
                        {sku}
                      </span>
                    </td>

                    {/* Emplacement */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)', background: 'var(--fs-ivory)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--fs-line)' }}>
                        {loc}
                      </span>
                    </td>

                    {/* Prix */}
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>
                        {fmtN(p.price)}
                      </span>
                    </td>

                    {/* Stock */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 14, fontWeight: 800, fontFamily: 'var(--fs-font-mono)',
                        color: p.stock === 0 ? 'var(--fs-danger-700)' : lowStock ? 'var(--fs-warning-700)' : 'var(--fs-ink-900)',
                      }}>
                        {p.stock}
                      </span>
                    </td>

                    {/* Seuil */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>
                        {p.alertThreshold}
                      </span>
                    </td>

                    {/* Péremption */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: exCfg.bg, color: exCfg.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, fontFamily: 'var(--fs-font-mono)', whiteSpace: 'nowrap' }}>
                        {exCfg.label(exDays)}
                      </span>
                    </td>

                    {/* Arrow */}
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ color: isSelec ? 'var(--fs-wine-700)' : 'var(--fs-ink-300)' }}>
                        <I d={D.arrowR} size={14}/>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* ── Detail panel ── */}
      {selected && isMobile && (
        <div onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.45)' }}/>
      )}
      {selected && (
        <DetailPanel
          product={selected}
          isMobile={isMobile}
          onClose={() => setSelected(null)}
          onReception={() => { if (isMobile) setSelected(null); setReception(selected); }}
          onRefresh={fetchProducts}
          onEdit={() => { if (isMobile) setSelected(null); setEditProduct(selected); }}
          onDelete={handleDeleteProduct}
        />
      )}
    </div>
  );
}
