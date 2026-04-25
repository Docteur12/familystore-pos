/**
 * Page Caisse — Interface POS 3 colonnes
 * Gauche : catégories  |  Centre : grille produits  |  Droite : ticket
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { getAllProducts, createSale, getProductByBarcode, Product } from '../api/products';
import { getTokenPayload } from '../api/dashboard';
import ToastContainer, { useToast } from '../components/Toast';
import QRScanner from '../components/QRScanner';
import Receipt, { ReceiptData } from '../components/Receipt';

// ── Constants ─────────────────────────────────────────────────────────────────

const TVA_RATE = 0.1925;
const fmtN = (n: number) => n.toLocaleString('fr-FR');

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Espèces'  },
  { value: 'mobile', label: 'Mobile M.' },
  { value: 'card',   label: 'Carte'    },
] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];

// Pastel card color by category (lowercase key)
const CAT_COLORS: Record<string, string> = {
  'beauté':     '#F5C4B2',
  'hygiène':    '#B8D8EC',
  'parfumerie': '#D8C4E8',
  'épicerie':   '#EDD8A0',
  'boissons':   '#B4DCC4',
  'bien-être':  '#A8E0D4',
  'maison':     '#D4C8B8',
};
const DEFAULT_COLOR = '#DDD4C8';
function cardColor(cat?: string) {
  return CAT_COLORS[cat?.toLowerCase() ?? ''] ?? DEFAULT_COLOR;
}

// ── Audio / haptic ────────────────────────────────────────────────────────────

function playBeep(ok = true) {
  try {
    const ctx  = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    const dur  = ok ? 0.07 : 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(ok ? 1200 : 380, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    setTimeout(() => ctx.close().catch(() => {}), (dur + 0.05) * 1000);
  } catch { /* ignore */ }
}
function vibrate(ms = 40) { try { navigator.vibrate?.(ms); } catch { /* ignore */ } }

// ── SVG icons ─────────────────────────────────────────────────────────────────

function Ico({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const ICO_TOUT       = 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z';
const ICO_BEAUTE     = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const ICO_HYGIENE    = 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z';
const ICO_PARFUMERIE = 'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zM12 22V11.5M3 6.5l9 5 9-5';
const ICO_EPICERIE   = 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0';
const ICO_BOISSONS   = 'M8 2h8l1 8a5 5 0 0 1-10 0L8 2zM5 22h14M12 10v6M9 13h6';
const ICO_BIENETRE   = 'M17 8C8 10 5.9 16.17 3.82 19.5M9.5 9.5C11 7 14 5 21 2c0 7-3 11.5-5.5 13M9.5 9.5C9 11 9 12 10 15c1.5-1 2.5-2 4.5-6.5';
const ICO_MAISON     = 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9zM9 22V12h6v10';
const ICO_AUTRE      = 'M4 6h16M4 12h16M4 18h7';
const ICO_SCAN       = 'M23 7V1h-6M1 7V1h6M23 17v6h-6M1 17v6h6M4 12h2M9 12h2M14 12h2M19 12h2';
const ICO_GRID       = 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z';
const ICO_LIST       = 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01';
const ICO_TRASH      = 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6';
const ICO_SORT       = 'M3 6h18M7 12h10M11 18h2';
const ICO_LOYALTY    = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';
const ICO_USER       = 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z';
const ICO_CHEVRON    = 'M6 9l6 6 6-6';
const ICO_LOGOUT     = 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12';
const ICO_MINUS      = 'M5 12h14';
const ICO_PLUS       = 'M12 5v14M5 12h14';
const ICO_PAUSE      = 'M6 4h4v16H6zM14 4h4v16h-4z';
const ICO_X          = 'M18 6L6 18M6 6l12 12';

function catIcon(name: string) {
  const key = name.toLowerCase();
  if (key === 'tout')       return ICO_TOUT;
  if (key === 'beauté')     return ICO_BEAUTE;
  if (key === 'hygiène')    return ICO_HYGIENE;
  if (key === 'parfumerie') return ICO_PARFUMERIE;
  if (key === 'épicerie')   return ICO_EPICERIE;
  if (key === 'boissons')   return ICO_BOISSONS;
  if (key === 'bien-être')  return ICO_BIENETRE;
  if (key === 'maison')     return ICO_MAISON;
  return ICO_AUTRE;
}

// ── Generate ticket number ─────────────────────────────────────────────────────

function genTicketNo() {
  const yr  = new Date().getFullYear().toString().slice(-2);
  const num = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  return `TR-${yr}-${num}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CartItem { product: Product; quantity: number }

export default function Caisse() {
  const payload   = getTokenPayload();
  const navigate  = undefined; // not needed here
  const { toasts, addToast, removeToast } = useToast();

  const scanInputRef = useRef<HTMLInputElement>(null);

  // ── State ────────────────────────────────────────────────────────────────
  const [allProducts,    setAllProducts]    = useState<Product[]>([]);
  const [loadingProds,   setLoadingProds]   = useState(true);
  const [selectedCat,    setSelectedCat]    = useState<string | null>(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [viewMode,       setViewMode]       = useState<'grid' | 'list'>('grid');
  const [sortBy,         setSortBy]         = useState<'pop' | 'name' | 'price'>('pop');
  const [showSortMenu,   setShowSortMenu]   = useState(false);

  const [cart,           setCart]           = useState<CartItem[]>([]);
  const [lastAdded,      setLastAdded]      = useState<string | null>(null);
  const [scanning,       setScanning]       = useState(false);
  const [scanError,      setScanError]      = useState<string | null>(null);
  const [validating,     setValidating]     = useState(false);
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('cash');
  const [amountPaid,     setAmountPaid]     = useState('');
  const [showQR,         setShowQR]         = useState(false);
  const [receiptData,    setReceiptData]    = useState<ReceiptData | null>(null);
  const [ticketNo]                          = useState(genTicketNo);
  const [ticketTime]                        = useState(() =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );

  // Dynamic row height — computed after filteredProducts (see below)

  // ── Load products ─────────────────────────────────────────────────────────
  useEffect(() => {
    getAllProducts()
      .then(setAllProducts)
      .catch(() => {})
      .finally(() => setLoadingProds(false));
  }, []);

  // ── Categories ────────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    allProducts.forEach(p => {
      const c = p.category?.trim() || 'Autre';
      map.set(c, (map.get(c) ?? 0) + p.stock);
    });
    const totalStock = allProducts.reduce((s, p) => s + p.stock, 0);
    return [
      { name: 'Tout', count: totalStock },
      ...Array.from(map.entries()).map(([name, count]) => ({ name, count })),
    ];
  }, [allProducts]);

  // ── Filtered + sorted products ────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let list = allProducts;
    if (selectedCat) list = list.filter(p => (p.category?.trim() || 'Autre') === selectedCat);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'name')  return a.name.localeCompare(b.name, 'fr');
      if (sortBy === 'price') return a.price - b.price;
      return b.stock - a.stock; // popularity = most stocked
    });
  }, [allProducts, selectedCat, searchQuery, sortBy]);

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const focusScan = useCallback(() => setTimeout(() => scanInputRef.current?.focus(), 0), []);

  const flashAdded = useCallback((id: string) => {
    setLastAdded(id);
    setTimeout(() => setLastAdded(null), 700);
  }, []);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product._id === product._id);
      return idx !== -1
        ? prev.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { product, quantity: 1 }];
    });
    setSearchQuery('');
    setScanError(null);
    playBeep(true);
    vibrate(40);
    flashAdded(product._id);
  }, [flashAdded]);

  const changeQty = useCallback((id: string, delta: number) =>
    setCart(prev =>
      prev.map(i => i.product._id === id ? { ...i, quantity: i.quantity + delta } : i)
          .filter(i => i.quantity > 0)
    ), []);

  const removeItem = useCallback((id: string) =>
    setCart(prev => prev.filter(i => i.product._id !== id)), []);

  const clearCart = useCallback(() => {
    setCart([]); setAmountPaid(''); focusScan();
  }, [focusScan]);

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    const code = searchQuery.trim();
    if (!code || scanning) return;
    setScanError(null);
    setScanning(true);
    try {
      addToCart(await getProductByBarcode(code));
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Produit non trouvé');
      playBeep(false); vibrate(150);
    } finally {
      setScanning(false); focusScan();
    }
  }, [searchQuery, scanning, addToCart, focusScan]);

  const handleQRDetected = useCallback((code: string) => {
    setScanError(null); setScanning(true);
    getProductByBarcode(code)
      .then(addToCart)
      .catch(err => { setScanError(err instanceof Error ? err.message : 'Non trouvé'); playBeep(false); vibrate(150); })
      .finally(() => { setScanning(false); focusScan(); });
  }, [addToCart, focusScan]);

  // ── Dynamic card row height ───────────────────────────────────────────────
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridRowHeight, setGridRowHeight] = useState(160);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const compute = () => {
      const h       = el.clientHeight - 24;
      const numRows = Math.max(1, Math.ceil(filteredProducts.length / 4));
      const raw     = Math.floor((h - (numRows - 1) * 12) / numRows);
      setGridRowHeight(Math.min(240, Math.max(140, raw)));
    };
    compute();
    const obs = new ResizeObserver(compute);
    obs.observe(el);
    return () => obs.disconnect();
  }, [filteredProducts.length]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const total      = useMemo(() => cart.reduce((s, i) => s + i.product.price * i.quantity, 0), [cart]);
  const itemCount  = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const tva        = Math.round(total * TVA_RATE / (1 + TVA_RATE));
  const paid       = parseFloat(amountPaid) || 0;
  const change     = Math.max(0, paid - total);
  const notEnough  = paymentMethod === 'cash' && paid > 0 && paid < total;
  const canValidate = cart.length > 0 && !validating && !(paymentMethod === 'cash' && (paid === 0 || paid < total));

  // ── Validate ──────────────────────────────────────────────────────────────
  const handleValidate = useCallback(async () => {
    if (!canValidate) return;
    if (paymentMethod === 'cash' && (paid === 0 || paid < total)) {
      addToast('Montant reçu insuffisant', 'error'); return;
    }
    const cartSnap = [...cart];
    const pmLabel  = PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label ?? paymentMethod;
    const effPaid  = paymentMethod === 'cash' ? paid : total;
    setValidating(true);
    try {
      const result = await createSale({
        items: cart.map(i => ({ product: i.product._id, name: i.product.name, quantity: i.quantity, unitPrice: i.product.price })),
        total, paymentMethod, amountPaid: effPaid,
      });
      const d      = new Date();
      const dateP  = d.toISOString().slice(0, 10).replace(/-/g, '');
      const idPart = String(result.sale._id).slice(-6).toUpperCase();
      setReceiptData({
        receiptNo:    `FSV-${dateP}-${idPart}`,
        date:         d,
        items:        cartSnap.map(i => ({ name: i.product.name, unit: i.product.unit, quantity: i.quantity, unitPrice: i.product.price })),
        total, paymentLabel: pmLabel, amountPaid: effPaid, change: result.change,
      });
      setCart([]); setAmountPaid(''); setPaymentMethod('cash');
      for (const a of result.alerts) {
        addToast(a.stock === 0 ? `Rupture — ${a.productName}` : `Stock bas — ${a.productName} : ${a.stock} restant(s)`, 'warning');
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Erreur d'enregistrement", 'error');
    } finally {
      setValidating(false); focusScan();
    }
  }, [canValidate, cart, paymentMethod, paid, total, addToast, focusScan]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2')  { e.preventDefault(); focusScan(); }
      if (e.key === 'F9')  { e.preventDefault(); handleValidate(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusScan, handleValidate]);

  const initials = (payload?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const SORT_LABELS = { pop: 'Trier par popularité', name: 'Trier par nom', price: 'Trier par prix' };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'var(--fs-font-sans)',
      position: 'fixed',
      top: 0,
      left: 0,
    }}>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {showQR && (
        <QRScanner
          onDetected={code => { setShowQR(false); handleQRDetected(code); }}
          onClose={() => setShowQR(false)}
        />
      )}

      {receiptData && (
        <Receipt
          data={receiptData}
          onNewSale={() => { setReceiptData(null); focusScan(); }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════
          LEFT — Categories
      ════════════════════════════════════════════════════════════════ */}
      <aside style={{
        width: 188,
        height: '100vh',
        background: 'var(--fs-wine-900)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--fs-gold-500)',
            margin: 0,
          }}>Catégories</p>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {categories.map(cat => {
            const isActive = cat.name === 'Tout' ? !selectedCat : selectedCat === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCat(cat.name === 'Tout' ? null : cat.name)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 10px',
                  marginBottom: 2,
                  borderRadius: 'var(--fs-r-sm)',
                  border: 'none',
                  background: isActive ? 'var(--fs-wine-700)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
                  color: isActive ? '#fff' : 'rgba(245,235,217,0.65)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.12s',
                  fontFamily: 'var(--fs-font-sans)',
                }}
              >
                <span style={{ color: isActive ? 'var(--fs-gold-300)' : 'var(--fs-gold-500)', flexShrink: 0 }}>
                  <Ico d={catIcon(cat.name)} size={16}/>
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cat.name}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isActive ? 'var(--fs-gold-300)' : 'rgba(245,235,217,0.4)',
                  fontFamily: 'var(--fs-font-mono)',
                  flexShrink: 0,
                }}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* User at bottom */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--fs-gold-500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {payload?.name?.split(' ')[0] ?? '—'} {payload?.name?.split(' ').slice(-1)[0]?.[0] ?? ''}.
            </div>
            <div style={{ fontSize: 11, color: 'var(--fs-gold-400)', marginTop: 1 }}>
              Caissière · CAISSE 01
            </div>
          </div>
          <button
            onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
            style={{ background: 'none', border: 'none', color: 'var(--fs-gold-400)', cursor: 'pointer', padding: 2, display: 'flex' }}
            title="Déconnexion"
          >
            <Ico d={ICO_LOGOUT} size={14}/>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════
          CENTER — Product grid
      ════════════════════════════════════════════════════════════════ */}
      <main style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)', minWidth: 0 }}>

        {/* Search bar */}
        <div style={{
          padding: '10px 14px',
          background: 'var(--fs-paper)',
          borderBottom: '1px solid var(--fs-line)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={scanInputRef}
              autoFocus
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setScanError(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (searchQuery.trim() && filteredProducts.length === 0) handleScan();
                  else if (searchQuery.trim() && !searchQuery.includes(' ')) handleScan();
                  else if (!searchQuery.trim() && canValidate) handleValidate();
                }
              }}
              placeholder="Rechercher un produit, scanner un code-barres..."
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: 14,
                paddingTop: 9,
                paddingBottom: 9,
                border: scanError ? '1.5px solid var(--fs-danger-500)' : '1.5px solid var(--fs-line-2)',
                borderRadius: 'var(--fs-r-md)',
                outline: 'none',
                fontSize: 15,
                background: scanError ? 'var(--fs-danger-100)' : 'var(--fs-ivory)',
                color: scanError ? 'var(--fs-danger-700)' : 'var(--fs-ink-900)',
                fontFamily: 'var(--fs-font-sans)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Scanner ready badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            border: '1.5px solid var(--fs-gold-400)',
            borderRadius: 'var(--fs-r-md)',
            background: 'var(--fs-gold-50)',
            color: 'var(--fs-gold-700)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }} onClick={() => setShowQR(true)}>
            <Ico d={ICO_SCAN} size={13}/>
            SCANNER PRÊT
          </div>

          {/* View toggle */}
          <button
            onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            style={{ background: 'none', border: '1.5px solid var(--fs-line-2)', borderRadius: 'var(--fs-r-sm)', padding: '6px 8px', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}
          >
            <Ico d={viewMode === 'grid' ? ICO_LIST : ICO_GRID} size={15}/>
          </button>
        </div>

        {/* Filter row */}
        <div style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: '1px solid var(--fs-line)',
          background: 'var(--fs-paper)',
        }}>
          <span style={{ fontSize: 14, color: 'var(--fs-ink-500)' }}>
            {selectedCat ?? 'Tout'}{' '}
            <span style={{ color: 'var(--fs-ink-300)', fontFamily: 'var(--fs-font-mono)', fontSize: 13 }}>
              {filteredProducts.length} produit{filteredProducts.length !== 1 ? 's' : ''}
            </span>
          </span>

          {scanError && (
            <span style={{ fontSize: 14, color: 'var(--fs-danger-700)', fontWeight: 600 }}>
              ✕ {scanError}
            </span>
          )}

          {/* Sort dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSortMenu(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: '1.5px solid var(--fs-line-2)',
                borderRadius: 'var(--fs-r-sm)', padding: '5px 12px',
                fontSize: 13, color: 'var(--fs-ink-500)', cursor: 'pointer',
                fontFamily: 'var(--fs-font-sans)',
              }}
            >
              <Ico d={ICO_SORT} size={12}/>
              {SORT_LABELS[sortBy]}
              <Ico d={ICO_CHEVRON} size={12}/>
            </button>
            {showSortMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 50,
                background: 'var(--fs-paper)',
                border: '1px solid var(--fs-line)',
                borderRadius: 'var(--fs-r-md)',
                boxShadow: 'var(--fs-shadow-md)',
                minWidth: 180,
                overflow: 'hidden',
              }}>
                {(['pop', 'name', 'price'] as const).map(s => (
                  <button key={s}
                    onClick={() => { setSortBy(s); setShowSortMenu(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 14px', background: sortBy === s ? 'var(--fs-wine-50)' : 'none',
                      border: 'none', fontSize: 12, cursor: 'pointer',
                      color: sortBy === s ? 'var(--fs-wine-700)' : 'var(--fs-ink-700)',
                      fontFamily: 'var(--fs-font-sans)',
                    }}
                  >{SORT_LABELS[s]}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product grid */}
        <div
          ref={gridContainerRef}
          onClick={() => setShowSortMenu(false)}
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 12, minHeight: 0 }}
        >
          {loadingProds ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fs-ink-300)', fontSize: 13 }}>
              Chargement…
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fs-ink-300)', fontSize: 13 }}>
              Aucun produit trouvé
            </div>
          ) : viewMode === 'grid' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridAutoRows: gridRowHeight + 'px',
              gap: 12,
            }}>
              {filteredProducts.map(product => (
                <ProductCard
                  key={product._id}
                  product={product}
                  flash={lastAdded === product._id}
                  onClick={() => addToCart(product)}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredProducts.map(product => (
                <ProductListRow
                  key={product._id}
                  product={product}
                  flash={lastAdded === product._id}
                  onClick={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ════════════════════════════════════════════════════════════════
          RIGHT — Ticket
      ════════════════════════════════════════════════════════════════ */}
      <aside style={{
        width: 320,
        minWidth: 320,
        height: '100vh',
        background: 'var(--fs-paper)',
        borderLeft: '1px solid var(--fs-line)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}>

        {/* Ticket header */}
        <div style={{
          padding: '12px 14px 10px',
          borderBottom: '1px solid var(--fs-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
              Ticket en cours
            </div>
            <div style={{ fontSize: 12, color: 'var(--fs-ink-300)', fontFamily: 'var(--fs-font-mono)', marginTop: 2 }}>
              #{ticketNo} · {ticketTime}
            </div>
          </div>
          {itemCount > 0 && (
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--fs-wine-700)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{itemCount}</div>
          )}
        </div>

        {/* Loyalty row */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px',
          background: 'var(--fs-gold-50)',
          border: 'none',
          borderBottom: '1px solid var(--fs-line)',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          flexShrink: 0,
        }}>
          <Ico d={ICO_LOYALTY} size={13}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-700)' }}>Associer un client fidélité</div>
            <div style={{ fontSize: 11, color: 'var(--fs-gold-600)' }}>Facultatif · +5% sur les achats</div>
          </div>
          <Ico d={ICO_CHEVRON} size={12}/>
        </button>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {cart.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 6, color: 'var(--fs-ink-300)', userSelect: 'none',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h4"/>
              </svg>
              <p style={{ fontSize: 14, margin: 0 }}>Ticket vide</p>
              <p style={{ fontSize: 13, margin: 0 }}>Cliquez sur un produit</p>
            </div>
          ) : cart.map(item => (
            <TicketItem
              key={item.product._id}
              item={item}
              flash={lastAdded === item.product._id}
              disabled={validating}
              onIncrease={() => changeQty(item.product._id, +1)}
              onDecrease={() => changeQty(item.product._id, -1)}
              onRemove={() => removeItem(item.product._id)}
            />
          ))}
        </div>

        {/* Summary */}
        {cart.length > 0 && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--fs-line)' }}>
            <div style={{ padding: '10px 14px 0' }}>
              <Row label={`Sous-total (${itemCount} art.)`} value={fmtN(total)} />
              <Row label={`TVA incluse (${(TVA_RATE * 100).toFixed(2).replace('.', ',')}%)`} value={fmtN(tva)} />
              <Row label="Remise" value="− 0" />
            </div>

            {/* Gold rule */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--fs-gold-400) 30%, var(--fs-gold-400) 70%, transparent)', margin: '8px 14px', opacity: 0.6 }}/>

            <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-500)' }}>TOTAL</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--fs-wine-700)', fontFamily: 'var(--fs-font-display)', letterSpacing: '0.01em' }}>
                {fmtN(total)} <span style={{ fontSize: 14, fontWeight: 600 }}>XAF</span>
              </span>
            </div>

            {/* Payment methods */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '0 14px 10px' }}>
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  onClick={() => { setPaymentMethod(pm.value); setAmountPaid(''); }}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 'var(--fs-r-md)',
                    border: paymentMethod === pm.value ? '1.5px solid var(--fs-wine-700)' : '1.5px solid var(--fs-line-2)',
                    background: paymentMethod === pm.value ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color: paymentMethod === pm.value ? '#fff' : 'var(--fs-ink-600)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--fs-font-sans)',
                    transition: 'all 0.1s',
                  }}
                >{pm.label}</button>
              ))}
            </div>

            {/* Cash amount */}
            {paymentMethod === 'cash' && (
              <div style={{ padding: '0 14px 10px' }}>
                <input
                  type="number"
                  min={0}
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder={`Montant reçu (min. ${fmtN(total)})`}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: notEnough ? '1.5px solid var(--fs-danger-500)' : '1.5px solid var(--fs-line-2)',
                    borderRadius: 'var(--fs-r-md)',
                    outline: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    background: notEnough ? 'var(--fs-danger-100)' : 'var(--fs-ivory)',
                    color: notEnough ? 'var(--fs-danger-700)' : 'var(--fs-ink-900)',
                    fontFamily: 'var(--fs-font-sans)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                  }}
                />
                {!notEnough && paid >= total && paid > 0 && (
                  <div style={{
                    marginTop: 6, padding: '6px 10px',
                    background: 'var(--fs-success-100)',
                    border: '1px solid rgba(90,139,83,0.25)',
                    borderRadius: 'var(--fs-r-sm)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--fs-success-700)' }}>Rendu</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-success-700)' }}>{fmtN(change)} XAF</span>
                  </div>
                )}
              </div>
            )}

            {/* Encaisser button */}
            <div style={{ padding: '0 14px 8px' }}>
              <button
                id="btn-validate"
                onClick={handleValidate}
                disabled={!canValidate}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: canValidate ? 'var(--fs-wine-700)' : 'var(--fs-wine-900)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--fs-r-md)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: canValidate ? 'pointer' : 'not-allowed',
                  opacity: canValidate ? 1 : 0.5,
                  fontFamily: 'var(--fs-font-sans)',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'opacity 0.15s',
                }}
              >
                {validating ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/>
                    Enregistrement…
                  </>
                ) : (
                  <>✓ Encaisser {fmtN(total)} XAF</>
                )}
              </button>
            </div>

            {/* Secondary actions */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 14px 12px',
            }}>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--fs-ink-400)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fs-font-sans)' }}
              >
                <Ico d={ICO_PAUSE} size={14}/>
                Mettre en attente
              </button>
              <button
                onClick={clearCart}
                style={{ background: 'none', border: 'none', color: 'var(--fs-danger-500)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fs-font-sans)' }}
              >
                <Ico d={ICO_X} size={12}/>
                Annuler le ticket
              </button>
            </div>
          </div>
        )}
      </aside>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Summary row ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 13, color: 'var(--fs-ink-400)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--fs-ink-600)', fontFamily: 'var(--fs-font-mono)' }}>{value}</span>
    </div>
  );
}

// ── Product card (grid view) ──────────────────────────────────────────────────

const ProductCard = memo(function ProductCard({
  product, flash, onClick,
}: { product: Product; flash: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const lowStock = product.stock <= product.alertThreshold && product.stock > 0;
  const noStock  = product.stock === 0;
  const color    = cardColor(product.category);

  return (
    <div
      onClick={noStock ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 'var(--fs-r-md)',
        background: flash ? '#d1fae5' : color,
        border: flash ? '2px solid #34d399' : hovered ? '2px solid var(--fs-wine-600)' : '2px solid transparent',
        cursor: noStock ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        transition: 'border-color 0.12s, transform 0.1s, box-shadow 0.1s',
        transform: hovered && !noStock ? 'translateY(-2px)' : 'none',
        opacity: noStock ? 0.5 : 1,
        boxShadow: hovered && !noStock ? 'var(--fs-shadow-lg)' : 'var(--fs-shadow-sm)',
      }}
    >
      {/* Stock badge */}
      {product.stock > 0 && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'var(--fs-wine-700)',
          color: '#fff',
          borderRadius: '50%',
          width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
          fontFamily: 'var(--fs-font-mono)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}>
          {product.stock > 99 ? '99+' : product.stock}
        </div>
      )}

      {/* Alert badges */}
      {lowStock && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: 'var(--fs-danger-500)',
          color: '#fff', borderRadius: 3,
          padding: '2px 6px',
          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
        }}>STOCK BAS</div>
      )}
      {noStock && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: 'var(--fs-ink-700)',
          color: '#fff', borderRadius: 3,
          padding: '2px 6px',
          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
        }}>RUPTURE</div>
      )}

      {/* Info area at bottom */}
      <div style={{ padding: '10px 10px 12px', background: 'rgba(255,255,255,0.62)' }}>
        <p style={{
          fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)',
          margin: '0 0 4px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{product.name}</p>
        <p style={{
          fontSize: 12, color: 'var(--fs-ink-500)', margin: '0 0 7px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {product.category ?? 'Autre'} · {product.unit}
        </p>
        <p style={{
          fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-800)',
          margin: 0, fontFamily: 'var(--fs-font-mono)',
          letterSpacing: '-0.01em',
        }}>
          {product.price.toLocaleString('fr-FR')}{' '}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fs-ink-500)' }}>XAF</span>
        </p>
      </div>
    </div>
  );
});

// ── Product list row ──────────────────────────────────────────────────────────

const ProductListRow = memo(function ProductListRow({
  product, flash, onClick,
}: { product: Product; flash: boolean; onClick: () => void }) {
  const noStock = product.stock === 0;
  const color   = cardColor(product.category);
  return (
    <div
      onClick={noStock ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: flash ? '#d1fae5' : 'var(--fs-paper)',
        border: '1px solid var(--fs-line)',
        borderRadius: 'var(--fs-r-sm)',
        cursor: noStock ? 'not-allowed' : 'pointer',
        opacity: noStock ? 0.55 : 1,
        transition: 'background 0.1s',
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 'var(--fs-r-sm)', background: color, flexShrink: 0 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
        <p style={{ fontSize: 10, color: 'var(--fs-ink-400)', margin: 0 }}>{product.category ?? 'Autre'} · {product.unit}</p>
      </div>
      <span style={{ fontSize: 10, color: 'var(--fs-ink-300)', fontFamily: 'var(--fs-font-mono)' }}>×{product.stock}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)' }}>{product.price.toLocaleString('fr-FR')}</span>
    </div>
  );
});

// ── Ticket item ───────────────────────────────────────────────────────────────

const TicketItem = memo(function TicketItem({
  item, flash, disabled, onIncrease, onDecrease, onRemove,
}: {
  item: CartItem; flash: boolean; disabled: boolean;
  onIncrease: () => void; onDecrease: () => void; onRemove: () => void;
}) {
  const color    = cardColor(item.product.category);
  const subtotal = item.product.price * item.quantity;

  return (
    <div style={{
      padding: '8px 14px',
      background: flash ? 'rgba(209,250,229,0.5)' : 'transparent',
      borderBottom: '1px solid var(--fs-line)',
      transition: 'background 0.4s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 4, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fs-ink-900)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.product.name}
          </p>
          <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: 0, fontFamily: 'var(--fs-font-mono)' }}>
            {item.product.price.toLocaleString('fr-FR')} × {item.quantity}
          </p>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)', flexShrink: 0 }}>
          {subtotal.toLocaleString('fr-FR')}
        </span>
      </div>

      {/* Qty controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingLeft: 14 }}>
        <QtyBtn icon="−" onClick={onDecrease} disabled={disabled}/>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)', minWidth: 24, textAlign: 'center' }}>
          {item.quantity}
        </span>
        <QtyBtn icon="+" onClick={onIncrease} disabled={disabled}/>
        <button
          onClick={onRemove}
          disabled={disabled}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--fs-danger-500)', cursor: 'pointer', padding: 2, display: 'flex', opacity: disabled ? 0.4 : 1 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

function QtyBtn({ icon, onClick, disabled }: { icon: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '1.5px solid var(--fs-line-2)',
        background: 'var(--fs-ivory)',
        color: 'var(--fs-wine-700)',
        fontSize: 14, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        lineHeight: 1,
      }}
    >{icon}</button>
  );
}
