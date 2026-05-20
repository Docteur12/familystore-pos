/**
 * Page Caisse — Interface POS 3 colonnes
 * Gauche : catégories  |  Centre : grille produits  |  Droite : ticket
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { getAllProducts, createSale, getProductByBarcode, Product, SaleError, effectivePrice } from '../api/products';
import { openSession, closeSession, getActiveSession } from '../api/sessions';
import { getTokenPayload } from '../api/dashboard';
import ToastContainer, { useToast } from '../components/Toast';
import {
  cacheProducts, getCachedProducts, savePendingSale, getPendingSales,
  syncPendingSales, decrementCachedStock, silentRefreshProductCache,
} from '../services/offlineSync';
import QRScanner from '../components/QRScanner';
import Receipt, { ReceiptData } from '../components/Receipt';
import { buildReceiptHTML, doPrint, getPrintSettings, openCashDrawer } from '../components/ReceiptPrint';
import { useSettings } from '../contexts/SettingsContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useInactivityTimer } from '../hooks/useInactivityTimer';

// ── Constants ─────────────────────────────────────────────────────────────────

const TVA_RATE = 0.1925;
const fmtN = (n: number) => n.toLocaleString('fr-FR');

const PAYMENT_METHODS = [
  { value: 'cash',         label: 'Espèces'  },
  { value: 'mobile_money', label: 'Mobile M.' },
  { value: 'card',         label: 'Carte'    },
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

interface HeldTicket {
  id: string;
  ticketNo: string;
  time: string;
  cart: CartItem[];
  total: number;
}

export default function Caisse() {
  const payload   = getTokenPayload();
  const navigate  = undefined; // not needed here
  const { toasts, addToast, removeToast } = useToast();
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  const [ticketDrawerOpen, setTicketDrawerOpen] = useState(false);

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
  const [retryLabel,     setRetryLabel]     = useState('');
  const [heldTickets,    setHeldTickets]    = useState<HeldTicket[]>(() => {
    try { const s = localStorage.getItem('fs_held_tickets'); if (s) { localStorage.removeItem('fs_held_tickets'); return JSON.parse(s); } } catch {}
    return [];
  });
  const [showHeld,       setShowHeld]       = useState(false);
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('cash');
  const [amountPaid,     setAmountPaid]     = useState('');
  const [showQR,         setShowQR]         = useState(false);
  const [receiptData,    setReceiptData]    = useState<ReceiptData | null>(null);
  const [ticketNo]                          = useState(genTicketNo);
  const [ticketTime]                        = useState(() =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
  const [isOnline,       setIsOnline]       = useState(() => navigator.onLine);
  const [pendingCount,   setPendingCount]   = useState(0);
  const [offrePct,       setOffrePct]       = useState(0);
  const [showLogoutModal,setShowLogoutModal]= useState(false);
  const [sessionId,      setSessionId]      = useState<string | null>(null);
  const [sessionStart,   setSessionStart]   = useState<Date | null>(null);
  const [sessionSales,   setSessionSales]   = useState(0);
  const [locked,         setLocked]         = useState(false);
  const [lockPin,        setLockPin]        = useState('');
  const [lockError,      setLockError]      = useState(false);

  const caissePIN = payload?.caisse?.pin ?? null;
  useInactivityTimer(10 * 60 * 1000, () => setLocked(true));

  // Dynamic row height — computed after filteredProducts (see below)

  // ── Load products (online → API + cache / offline → IndexedDB) ───────────
  useEffect(() => {
    (async () => {
      if (navigator.onLine) {
        try {
          const prods = await getAllProducts();
          setAllProducts(prods);
          await cacheProducts(prods);
        } catch {
          const cached = await getCachedProducts();
          setAllProducts(cached);
        }
      } else {
        const cached = await getCachedProducts();
        setAllProducts(cached);
      }
      setLoadingProds(false);
      const pending = await getPendingSales();
      setPendingCount(pending.length);
    })();
  }, []);

  // Silent cache refresh every 5 minutes when online
  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(async () => {
      await silentRefreshProductCache();
      const fresh = await getCachedProducts();
      if (fresh.length > 0) setAllProducts(fresh);
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline]);

  // Reprise ou création de session de travail au montage
  useEffect(() => {
    if (!navigator.onLine) return;
    (async () => {
      try {
        const existing = await getActiveSession();
        if (existing) {
          setSessionId(existing._id);
          setSessionStart(new Date(existing.dateDebut));
          setSessionSales(existing.liveCount ?? 0);
        } else {
          const s = await openSession();
          setSessionId(s._id);
          setSessionStart(new Date(s.dateDebut));
        }
      } catch { /* silently ignore si hors-ligne ou non authentifié */ }
    })();
  }, []);

  // Online / offline events
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      syncPendingSales(addToast).then(() =>
        getPendingSales().then(p => setPendingCount(p.length)),
      );
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [addToast]);

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
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
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
    if (product.stock === 0) {
      addToast(`${product.name} — rupture de stock`, 'warning');
      playBeep(false); return;
    }
    setCart(prev => {
      const idx = prev.findIndex(i => i.product._id === product._id);
      if (idx !== -1) {
        const cur = prev[idx].quantity;
        if (cur >= product.stock) {
          setTimeout(() => addToast(`Stock max atteint — ${product.stock} disponible${product.stock > 1 ? 's' : ''}`, 'warning'), 0);
          return prev;
        }
        return prev.map((i, n) => n === idx ? { ...i, quantity: cur + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchQuery('');
    setScanError(null);
    playBeep(true);
    vibrate(40);
    flashAdded(product._id);
  }, [flashAdded, addToast]);

  const changeQty = useCallback((id: string, delta: number) =>
    setCart(prev => {
      if (delta > 0) {
        const item = prev.find(i => i.product._id === id);
        if (item && item.quantity >= item.product.stock) {
          setTimeout(() => addToast(`Stock max atteint — ${item.product.stock} disponible${item.product.stock > 1 ? 's' : ''}`, 'warning'), 0);
          return prev;
        }
      }
      return prev.map(i => i.product._id === id ? { ...i, quantity: i.quantity + delta } : i)
                 .filter(i => i.quantity > 0);
    }), [addToast]);

  const removeItem = useCallback((id: string) =>
    setCart(prev => prev.filter(i => i.product._id !== id)), []);

  const clearCart = useCallback(() => {
    setCart([]); setAmountPaid(''); setOffrePct(0); focusScan();
  }, [focusScan]);

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    const code = searchQuery.trim();
    if (!code || scanning) return;
    setScanError(null);
    setScanning(true);
    try {
      // Recherche locale d'abord (instantané, pas de réseau)
      const local = allProducts.find(
        p => p.barcode && p.barcode.toLowerCase() === code.toLowerCase()
      );
      if (local) {
        addToCart(local);
      } else {
        // Fallback API si la liste locale ne contient pas le produit
        addToCart(await getProductByBarcode(code));
      }
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Produit non trouvé');
      playBeep(false); vibrate(150);
    } finally {
      setScanning(false); focusScan();
    }
  }, [searchQuery, scanning, allProducts, addToCart, focusScan]);

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
  const subtotal   = useMemo(() => cart.reduce((s, i) => s + effectivePrice(i.product) * i.quantity, 0), [cart]);
  const offreAmt   = offrePct > 0 ? Math.round(subtotal * offrePct / 100) : 0;
  const total      = subtotal - offreAmt;
  const itemCount  = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const tva        = Math.round(total * TVA_RATE / (1 + TVA_RATE));
  const paid       = parseFloat(amountPaid) || 0;
  const change     = Math.max(0, paid - total);
  const notEnough  = paymentMethod === 'cash' && paid > 0 && paid < total;
  const canValidate = cart.length > 0 && !validating && !(paymentMethod === 'cash' && (paid === 0 || paid < total));

  // ── Hold / resume ─────────────────────────────────────────────────────────
  const handleHold = useCallback(() => {
    if (cart.length === 0) return;
    if (heldTickets.length >= 5) {
      addToast('Maximum 5 tickets en attente simultanément', 'error');
      return;
    }
    const held: HeldTicket = {
      id: Date.now().toString(),
      ticketNo,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      total,
    };
    setHeldTickets(prev => [...prev, held]);
    setCart([]);
    setAmountPaid('');
    addToast(`Ticket #${ticketNo} mis en attente`, 'success');
    focusScan();
  }, [cart, heldTickets.length, ticketNo, total, addToast, focusScan]);

  const handleResume = useCallback((id: string) => {
    if (cart.length > 0) {
      addToast('Encaissez ou annulez le ticket courant avant de reprendre', 'warning');
      return;
    }
    const ticket = heldTickets.find(t => t.id === id);
    if (!ticket) return;
    setCart(ticket.cart);
    setHeldTickets(prev => prev.filter(t => t.id !== id));
    setShowHeld(false);
    focusScan();
  }, [cart.length, heldTickets, addToast, focusScan]);

  const handleCancelHeld = useCallback((id: string) => {
    setHeldTickets(prev => prev.filter(t => t.id !== id));
  }, []);

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

    // ── Offline path ─────────────────────────────────────────────────────────
    if (!navigator.onLine) {
      try {
        await savePendingSale({
          items: cart.map(i => ({ product: i.product._id, name: i.product.name, quantity: i.quantity, unitPrice: i.product.price })),
          total, paymentMethod, amountPaid: effPaid,
        });
        for (const item of cart) {
          await decrementCachedStock(item.product._id, item.quantity);
        }
        const cached = await getCachedProducts();
        setAllProducts(cached);
        setPendingCount(prev => prev + 1);
        setSessionSales(n => n + 1);
        addToast('Mode hors ligne — vente sauvegardée, à synchroniser', 'warning');

        // Générer et afficher le reçu hors ligne (impression possible)
        const d       = new Date();
        const dateP   = d.toISOString().slice(0, 10).replace(/-/g, '');
        const tvaAmt  = Math.round(total * TVA_RATE / (1 + TVA_RATE));
        const offlineData: ReceiptData = {
          receiptNo:    `OFF-${dateP}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          date:         d,
          cashierName:  payload?.name ?? 'Caissier',
          storePhone:   settings.telephone || undefined,
          items:        cartSnap.map(i => ({
            name: i.product.name, unit: i.product.unit, quantity: i.quantity,
            unitPrice: effectivePrice(i.product),
            ...(i.product.discount && i.product.discount > 0 ? { discount: i.product.discount, originalPrice: i.product.price } : {}),
          })),
          total,
          tva:          tvaAmt,
          paymentLabel: pmLabel,
          amountPaid:   effPaid,
          change:       Math.max(0, effPaid - total),
        };
        setReceiptData(offlineData);
        setCart([]); setAmountPaid(''); setPaymentMethod('cash');

        // Auto-impression si activée
        const ps = getPrintSettings();
        if (ps.auto) {
          const html = buildReceiptHTML(offlineData, ps.showTva);
          doPrint(html, ps.copies);
        }
      } catch {
        addToast('Erreur sauvegarde locale', 'error');
      } finally {
        setValidating(false); focusScan();
      }
      return;
    }

    // ── Retry loop (3 tentatives, 2s entre chaque) ──────────────────────────
    const MAX_RETRIES = 3;
    const saleItems   = cart.map(i => ({ product: i.product._id, name: i.product.name, quantity: i.quantity, unitPrice: effectivePrice(i.product) }));

    let succeeded      = false;
    let nonRetryable   = false;

    for (let attempt = 0; attempt < MAX_RETRIES && !nonRetryable && !succeeded; attempt++) {
      if (attempt > 0) {
        await new Promise<void>(r => setTimeout(r, 2000));
      }

      try {
        const result = await createSale({ items: saleItems, total, paymentMethod, amountPaid: effPaid, sessionId: sessionId ?? undefined });

        // ── Succès ───────────────────────────────────────────────────────────
        succeeded = true;
        const d      = new Date();
        const dateP  = d.toISOString().slice(0, 10).replace(/-/g, '');
        const idPart = String(result.sale._id).slice(-6).toUpperCase();
        const tvaAmt = Math.round(total * TVA_RATE / (1 + TVA_RATE));
        const newData: ReceiptData = {
          receiptNo:    `FSV-${dateP}-${idPart}`,
          date:         d,
          cashierName:  payload?.name ?? 'Caissier',
          storePhone:   settings.telephone || undefined,
          items:        cartSnap.map(i => ({
            name: i.product.name, unit: i.product.unit, quantity: i.quantity,
            unitPrice: effectivePrice(i.product),
            ...(i.product.discount && i.product.discount > 0 ? { discount: i.product.discount, originalPrice: i.product.price } : {}),
          })),
          total, tva: tvaAmt, paymentLabel: pmLabel, amountPaid: effPaid, change: result.change,
        };
        setReceiptData(newData);
        setCart([]); setAmountPaid(''); setPaymentMethod('cash'); setOffrePct(0);

        setSessionSales(n => n + 1);
        if (attempt > 0) addToast('Vente enregistrée ✅', 'success');

        const ps = getPrintSettings();
        if (ps.auto) {
          doPrint(buildReceiptHTML(newData, ps.showTva), ps.copies);
          if (paymentMethod === 'cash') openCashDrawer();
        }
        for (const a of result.alerts) {
          addToast(a.stock === 0 ? `Rupture — ${a.productName}` : `Stock bas — ${a.productName} : ${a.stock} restant(s)`, 'warning');
        }

      } catch (err: unknown) {
        const kind = err instanceof SaleError ? err.kind : 'unknown';
        const msg  = err instanceof Error ? err.message : "Erreur d'enregistrement";

        if (kind === 'auth') {
          nonRetryable = true;
          try {
            await savePendingSale({ items: saleItems, total, paymentMethod, amountPaid: effPaid });
            addToast('Session expirée — ticket sauvegardé localement', 'warning');
          } catch { /* ignore */ }
          setTimeout(() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }, 1800);

        } else if (kind === 'stock') {
          nonRetryable = true;
          // Auto-réduction : parse "disponible N" et "pour "Nom""
          const availMatch = msg.match(/disponible[^\d]*(\d+)/i);
          const nameMatch  = msg.match(/pour\s+"([^"]+)"/i) ?? msg.match(/pour\s+'([^']+)'/i);
          if (availMatch && nameMatch) {
            const available   = parseInt(availMatch[1]);
            const productName = nameMatch[1];
            setCart(prev => prev
              .map(i => i.product.name === productName && i.quantity > available
                ? { ...i, quantity: available }
                : i)
              .filter(i => i.quantity > 0));
            addToast(`Quantité réduite à ${available} pour "${productName}" — vérifiez le ticket`, 'warning');
          } else {
            addToast(msg, 'error');
          }

        } else if (attempt < MAX_RETRIES - 1) {
          // Erreur récupérable → on informe et on réessaie
          if (kind === 'timeout') {
            setRetryLabel(`Connexion lente, tentative ${attempt + 2}/${MAX_RETRIES}…`);
            addToast('Connexion lente — nouvelle tentative…', 'warning');
          } else if (kind === 'server_sleep') {
            setRetryLabel(`Serveur en démarrage, tentative ${attempt + 2}/${MAX_RETRIES}…`);
            addToast('Serveur en démarrage (30s) — nouvelle tentative…', 'warning');
          } else {
            setRetryLabel(`Tentative ${attempt + 2}/${MAX_RETRIES}…`);
            addToast(`Erreur réseau — tentative ${attempt + 2}/${MAX_RETRIES}…`, 'warning');
          }

        } else {
          // Toutes les tentatives épuisées → fallback offline
          setRetryLabel('Sauvegarde locale…');
          try {
            await savePendingSale({ items: saleItems, total, paymentMethod, amountPaid: effPaid });
            for (const item of cart) await decrementCachedStock(item.product._id, item.quantity);
            const cached = await getCachedProducts();
            setAllProducts(cached);
            setPendingCount(prev => prev + 1);

            const d      = new Date();
            const dateP  = d.toISOString().slice(0, 10).replace(/-/g, '');
            const tvaAmt = Math.round(total * TVA_RATE / (1 + TVA_RATE));
            const offlineData: ReceiptData = {
              receiptNo:    `OFF-${dateP}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
              date:         d,
              cashierName:  payload?.name ?? 'Caissier',
              storePhone:   settings.telephone || undefined,
              items:        cartSnap.map(i => ({
            name: i.product.name, unit: i.product.unit, quantity: i.quantity,
            unitPrice: effectivePrice(i.product),
            ...(i.product.discount && i.product.discount > 0 ? { discount: i.product.discount, originalPrice: i.product.price } : {}),
          })),
              total, tva: tvaAmt, paymentLabel: pmLabel, amountPaid: effPaid,
              change: Math.max(0, effPaid - total),
            };
            setReceiptData(offlineData);
            setCart([]); setAmountPaid(''); setPaymentMethod('cash');
            addToast('Vente sauvegardée localement — synchronisation dès que possible', 'warning');

            const ps = getPrintSettings();
            if (ps.auto) doPrint(buildReceiptHTML(offlineData, ps.showTva), ps.copies);
          } catch {
            addToast("Échec définitif — impossible d'enregistrer la vente", 'error');
          }
        }
      }
    }

    setRetryLabel('');
    setValidating(false);
    focusScan();
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
      flexDirection: isMobile ? 'column' : 'row',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'var(--fs-font-sans)',
      position: 'fixed',
      top: 0,
      left: 0,
    }}>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Lock screen (inactivité 10 min) ── */}
      {locked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--fs-wine-900)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ color: 'var(--fs-gold-400)', fontFamily: 'var(--fs-font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '0.1em' }}>FAMILY STORE</div>
          <div style={{ color: 'rgba(245,235,217,0.6)', fontSize: 13 }}>Session verrouillée — Saisir le code PIN</div>
          <div style={{ display: 'flex', gap: 10, margin: '8px 0' }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: lockPin.length > i ? 'var(--fs-gold-400)' : 'rgba(255,255,255,0.2)' }}/>
            ))}
          </div>
          {lockError && <div style={{ color: '#f87171', fontSize: 12 }}>Code incorrect</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 10 }}>
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, idx) => (
              <button key={idx} onClick={() => {
                if (k === '⌫') { setLockPin(p => p.slice(0,-1)); setLockError(false); return; }
                if (k === '') return;
                const next = lockPin + String(k);
                setLockPin(next);
                if (next.length === 4) {
                  if (caissePIN && next === caissePIN) { setLocked(false); setLockPin(''); setLockError(false); }
                  else { setLockError(true); setLockPin(''); }
                }
              }}
                style={{ width: 64, height: 64, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', background: k === '' ? 'transparent' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 20, fontWeight: 600, cursor: k === '' ? 'default' : 'pointer' }}>
                {k}
              </button>
            ))}
          </div>
          <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(245,235,217,0.35)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
            Changer de session
          </button>
        </div>
      )}

      {/* ── Logout confirmation modal ── */}
      {showLogoutModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 360, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'var(--fs-wine-900)', padding: '16px 22px' }}>
              <p style={{ color: 'var(--fs-gold-400)', fontWeight: 800, fontSize: 15, margin: 0 }}>Ticket en cours</p>
              <p style={{ color: 'rgba(245,235,217,0.7)', fontSize: 12, margin: '4px 0 0' }}>
                Vous avez {cart.length} article{cart.length > 1 ? 's' : ''} dans le ticket ({cart.reduce((s,i)=>s+i.quantity,0)} qté — {cart.reduce((s,i)=>s+i.product.price*i.quantity,0).toLocaleString('fr-FR')} XAF).
              </p>
            </div>
            <div style={{ padding: '18px 22px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  // Sauvegarder le ticket dans localStorage AVANT la redirection
                  const held: HeldTicket = {
                    id: Date.now().toString(),
                    ticketNo,
                    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    cart: [...cart],
                    total,
                  };
                  try { localStorage.setItem('fs_held_tickets', JSON.stringify([...heldTickets, held])); } catch {}
                  setShowLogoutModal(false);
                  if (sessionId) closeSession(sessionId);
                  localStorage.removeItem('access_token');
                  window.location.href = '/login';
                }}
                style={{ padding: '11px 0', borderRadius: 10, border: '2px solid var(--fs-wine-700)', background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Mettre en attente &amp; se déconnecter
              </button>
              <button
                onClick={() => { setCart([]); setAmountPaid(''); setShowLogoutModal(false); if (sessionId) closeSession(sessionId); localStorage.removeItem('access_token'); window.location.href = '/login'; }}
                style={{ padding: '11px 0', borderRadius: 10, border: '2px solid #ef4444', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Annuler le ticket &amp; se déconnecter
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ padding: '10px 0', borderRadius: 10, border: '1.5px solid var(--fs-line-2)', background: 'var(--fs-ivory)', color: 'var(--fs-ink-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Rester connecté
              </button>
            </div>
          </div>
        </div>
      )}

      {showQR && (
        <QRScanner
          onDetected={code => { setShowQR(false); handleQRDetected(code); }}
          onClose={() => { setShowQR(false); focusScan(); }}
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
        display: isMobile ? 'none' : 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Identity panel */}
        <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.caisse?.nom ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'rgba(245,235,217,0.45)', marginTop: 1 }}>
              {sessionStart ? sessionStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'} · {sessionSales} vente{sessionSales !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(245,235,217,0.35)',
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

        {/* Logout */}
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={() => { if (cart.length > 0) { setShowLogoutModal(true); } else { if (sessionId) closeSession(sessionId); localStorage.removeItem('access_token'); window.location.href = '/login'; } }}
            style={{ background: 'none', border: '1px solid rgba(245,235,217,0.15)', borderRadius: 7, color: 'rgba(245,235,217,0.5)', cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}
            title="Déconnexion"
          >
            <Ico d={ICO_LOGOUT} size={13}/>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════
          CENTER — Product grid
      ════════════════════════════════════════════════════════════════ */}
      <main style={{ flex: 1, height: isMobile ? undefined : '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)', minWidth: 0 }}>

        {/* Mobile categories strip */}
        {isMobile && (
          <div style={{
            display: 'flex', overflowX: 'auto', background: 'var(--fs-wine-900)',
            padding: '8px 10px', gap: 6, flexShrink: 0,
            WebkitOverflowScrolling: 'touch' as any,
            scrollbarWidth: 'none' as any,
          }}>
            {categories.map(cat => {
              const isActive = cat.name === 'Tout' ? !selectedCat : selectedCat === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCat(cat.name === 'Tout' ? null : cat.name)}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                    border: isActive ? '1.5px solid var(--fs-gold-400)' : '1.5px solid rgba(255,255,255,0.18)',
                    background: isActive ? 'var(--fs-wine-700)' : 'transparent',
                    color: isActive ? '#fff' : 'rgba(245,235,217,0.75)',
                    fontSize: 12, fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    fontFamily: 'var(--fs-font-sans)',
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

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

          {/* Physical scanner — click to re-focus the input */}
          <button
            onClick={focusScan}
            title="Cliquez pour activer la saisie scanner (douchette / F2)"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: isMobile ? '6px 8px' : '6px 12px',
              border: '1.5px solid var(--fs-gold-400)',
              borderRadius: 'var(--fs-r-md)',
              background: 'var(--fs-gold-50)',
              color: 'var(--fs-gold-700)',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
              whiteSpace: 'nowrap', cursor: 'pointer',
              fontFamily: 'var(--fs-font-sans)',
            }}
          >
            <Ico d={ICO_SCAN} size={13}/>
            {!isMobile && 'SCANNER PRÊT'}
          </button>

          {/* Camera scanner — separate button */}
          <button
            onClick={() => setShowQR(true)}
            title="Scanner via caméra (QR code)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '6px 8px',
              border: '1.5px solid var(--fs-line-2)',
              borderRadius: 'var(--fs-r-sm)',
              background: 'var(--fs-paper)',
              color: 'var(--fs-ink-400)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            📷
          </button>

          {/* Connection indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: isMobile ? '6px 8px' : '6px 12px',
            border: `1.5px solid ${isOnline ? '#22c55e' : '#f97316'}`,
            borderRadius: 'var(--fs-r-md)',
            background: isOnline ? '#f0fdf4' : '#fff7ed',
            color: isOnline ? '#16a34a' : '#c2410c',
            fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: isOnline ? '#22c55e' : '#f97316',
              boxShadow: isOnline ? '0 0 0 2px #bbf7d0' : '0 0 0 2px #fed7aa',
            }}/>
            {!isMobile && (isOnline ? 'En ligne' : 'Hors ligne')}
            {!isOnline && pendingCount > 0 && (
              <span style={{
                background: '#f97316', color: '#fff',
                borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700,
              }}>{pendingCount}</span>
            )}
          </div>

          {/* View toggle — desktop only */}
          {!isMobile && (
            <button
              onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
              style={{ background: 'none', border: '1.5px solid var(--fs-line-2)', borderRadius: 'var(--fs-r-sm)', padding: '6px 8px', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}
            >
              <Ico d={viewMode === 'grid' ? ICO_LIST : ICO_GRID} size={15}/>
            </button>
          )}
        </div>

        {/* Filter row — desktop only */}
        <div style={{
          padding: '8px 14px',
          display: isMobile ? 'none' : 'flex',
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
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 12, minHeight: 0, paddingBottom: isMobile && cart.length > 0 ? 78 : 12 }}
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
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gridAutoRows: isMobile ? '150px' : gridRowHeight + 'px',
              gap: isMobile ? 8 : 12,
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
          RIGHT — Ticket (drawer on mobile)
      ════════════════════════════════════════════════════════════════ */}

      {/* Mobile: backdrop + bottom action bar */}
      {isMobile && (
        <>
          {ticketDrawerOpen && (
            <div
              onClick={() => setTicketDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 298, background: 'rgba(0,0,0,0.5)' }}
            />
          )}
          {cart.length > 0 && (
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: ticketDrawerOpen ? 296 : 297,
              background: 'var(--fs-wine-900)',
              padding: '10px 14px',
              display: 'flex', gap: 10, alignItems: 'center',
              boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
              opacity: ticketDrawerOpen ? 0 : 1,
              pointerEvents: ticketDrawerOpen ? 'none' : 'auto',
              transition: 'opacity 0.2s',
            }}>
              <button
                onClick={() => setTicketDrawerOpen(true)}
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)', color: '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'var(--fs-font-sans)',
                }}
              >
                Voir ticket ({itemCount}) · {fmtN(total)} XAF
              </button>
              <button
                onClick={handleValidate}
                disabled={!canValidate}
                style={{
                  padding: '11px 20px', borderRadius: 10, border: 'none',
                  background: canValidate ? '#22c55e' : 'rgba(255,255,255,0.25)',
                  color: '#fff', fontSize: 14, fontWeight: 800,
                  cursor: canValidate ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--fs-font-sans)', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6, minWidth: 130,
                }}
              >
                {validating ? (
                  <>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                    {retryLabel || 'Enregistrement…'}
                  </>
                ) : '✓ Encaisser'}
              </button>
            </div>
          )}
        </>
      )}

      <aside style={isMobile ? {
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '88vh',
        background: 'var(--fs-paper)',
        borderRadius: '16px 16px 0 0',
        transform: ticketDrawerOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 299,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
      } : {
        width: 320, minWidth: 320, height: '100vh',
        background: 'var(--fs-paper)',
        borderLeft: '1px solid var(--fs-line)',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0, overflow: 'hidden', position: 'relative',
      }}>

        {/* Drag handle (mobile) */}
        {isMobile && (
          <div
            style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', cursor: 'pointer', flexShrink: 0 }}
            onClick={() => setTicketDrawerOpen(false)}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--fs-line-2)' }}/>
          </div>
        )}

        {/* ── Held tickets overlay ── */}
        {showHeld && (
          <div style={{
            position: 'absolute', inset: 0, background: 'var(--fs-paper)',
            zIndex: 20, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Tickets en attente</div>
                <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', marginTop: 1 }}>{heldTickets.length} / 5 ticket{heldTickets.length > 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => setShowHeld(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex', padding: 4 }}>
                <Ico d={ICO_X} size={16}/>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {heldTickets.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fs-ink-300)', fontSize: 13 }}>
                  Aucun ticket en attente
                </div>
              ) : heldTickets.map(t => (
                <div key={t.id} style={{ margin: '0 10px 8px', background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--fs-line)', background: 'var(--fs-ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>#{t.ticketNo}</span>
                    <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{t.time}</span>
                  </div>
                  <div style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
                        {t.cart.reduce((s, i) => s + i.quantity, 0)} article{t.cart.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-mono)' }}>
                        {fmtN(t.total)} XAF
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 10, lineHeight: 1.5 }}>
                      {t.cart.slice(0, 3).map(i => i.product.name).join(', ')}
                      {t.cart.length > 3 ? `… +${t.cart.length - 3}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleResume(t.id)}
                        style={{ flex: 2, padding: '8px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' }}
                      >
                        ↩ Reprendre
                      </button>
                      <button
                        onClick={() => handleCancelHeld(t.id)}
                        style={{ flex: 1, padding: '8px', border: '1.5px solid rgba(194,62,36,0.25)', borderRadius: 8, background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {heldTickets.length > 0 && (
              <button
                onClick={() => setShowHeld(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', border: '1.5px solid var(--fs-wine-700)',
                  borderRadius: 8, background: showHeld ? 'var(--fs-wine-700)' : 'var(--fs-wine-50)',
                  color: showHeld ? '#fff' : 'var(--fs-wine-700)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--fs-font-sans)', whiteSpace: 'nowrap',
                }}
              >
                <Ico d={ICO_PAUSE} size={12}/>
                En attente ({heldTickets.length})
              </button>
            )}
            {itemCount > 0 && (
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--fs-wine-700)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{itemCount}</div>
            )}
          </div>
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
              <Row label={`Sous-total (${itemCount} art.)`} value={fmtN(subtotal)} />
              <Row label={`TVA incluse (${(TVA_RATE * 100).toFixed(2).replace('.', ',')}%)`} value={fmtN(tva)} />
              {/* Offre globale sur facture */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--fs-ink-400)' }}>Offre sur facture</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number" min={0} max={100} step={1}
                    value={offrePct || ''}
                    onChange={e => setOffrePct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    placeholder="0"
                    style={{ width: 48, padding: '2px 6px', border: '1.5px solid var(--fs-line-2)', borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: 'center', outline: 'none', fontFamily: 'var(--fs-font-mono)', background: offrePct > 0 ? 'var(--fs-success-100)' : '#fff', color: offrePct > 0 ? 'var(--fs-success-700)' : 'var(--fs-ink-900)' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--fs-ink-400)' }}>%</span>
                  {offrePct > 0 && (
                    <span style={{ fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)', fontWeight: 600 }}>
                      −{fmtN(offreAmt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Gold rule */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--fs-gold-400) 30%, var(--fs-gold-400) 70%, transparent)', margin: '8px 14px', opacity: 0.6 }}/>

            <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-500)' }}>
                {offrePct > 0 ? `TOTAL (−${offrePct}%)` : 'TOTAL'}
              </span>
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
                    marginTop: 6, padding: '10px 12px',
                    background: 'var(--fs-success-100)',
                    border: '2px solid rgba(90,139,83,0.35)',
                    borderRadius: 'var(--fs-r-md)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-success-700)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monnaie à rendre</span>
                    <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--fs-success-700)', fontFamily: 'var(--fs-font-mono)', lineHeight: 1.1 }}>{fmtN(change)} <span style={{ fontSize: 14, fontWeight: 600 }}>XAF</span></span>
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
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }}/>
                    {retryLabel || 'Enregistrement…'}
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
                onClick={handleHold}
                disabled={heldTickets.length >= 5}
                style={{ background: 'none', border: 'none', color: heldTickets.length >= 5 ? 'var(--fs-ink-200)' : 'var(--fs-ink-400)', fontSize: 13, cursor: heldTickets.length >= 5 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fs-font-sans)' }}
                title={heldTickets.length >= 5 ? 'Maximum 5 tickets en attente' : ''}
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
      onClick={noStock ? undefined : (e) => { (e.currentTarget as HTMLElement).blur(); onClick(); }}
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
        userSelect: 'none',
        outline: 'none',
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

      {/* Badge réduction */}
      {(product.discount ?? 0) > 0 && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: '#c0392b', color: '#fff', borderRadius: 4,
          padding: '2px 7px', fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
        }}>-{product.discount}%</div>
      )}

      {/* Alert badges */}
      {lowStock && !(product.discount ?? 0) && (
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
          {product.category ?? 'Autre'}{product.subCategory ? ` › ${product.subCategory}` : ''} · {product.unit}
        </p>
        <p style={{ margin: 0, fontFamily: 'var(--fs-font-mono)' }}>
          {(product.discount ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', textDecoration: 'line-through', marginRight: 5 }}>
              {product.price.toLocaleString('fr-FR')}
            </span>
          )}
          <span style={{ fontSize: 16, fontWeight: 800, color: (product.discount ?? 0) > 0 ? '#c0392b' : 'var(--fs-ink-800)', letterSpacing: '-0.01em' }}>
            {effectivePrice(product).toLocaleString('fr-FR')}
          </span>{' '}
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
      {(product.discount ?? 0) > 0 && (
        <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', background: '#c0392b', borderRadius: 3, padding: '1px 5px' }}>-{product.discount}%</span>
      )}
      <span style={{ fontSize: 10, color: 'var(--fs-ink-300)', fontFamily: 'var(--fs-font-mono)' }}>×{product.stock}</span>
      <div style={{ textAlign: 'right' }}>
        {(product.discount ?? 0) > 0 && (
          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', textDecoration: 'line-through', fontFamily: 'var(--fs-font-mono)' }}>{product.price.toLocaleString('fr-FR')}</div>
        )}
        <span style={{ fontSize: 13, fontWeight: 700, color: (product.discount ?? 0) > 0 ? '#c0392b' : 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)' }}>{effectivePrice(product).toLocaleString('fr-FR')}</span>
      </div>
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
