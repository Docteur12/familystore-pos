/**
 * Page Caisse — Interface POS 3 colonnes
 * Gauche : catégories  |  Centre : grille produits  |  Droite : ticket
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { getAllProducts, createSale, getProductByBarcode, Product, SalePayload, SaleError, effectivePrice } from '../api/products';
import { trouverParCode } from '../utils/sku';
import { openSession, closeSession, getActiveSession } from '../api/sessions';
import { getCaisseAudit, AuditLogEntry } from '../api/audit';
import { getTokenPayload } from '../api/dashboard';
import ToastContainer, { useToast } from '../components/Toast';
import {
  cacheProducts, getCachedProducts, savePendingSale, getPendingSales,
  syncPendingSales, decrementCachedStock, silentRefreshProductCache,
} from '../services/offlineSync';
import QRScanner from '../components/QRScanner';
import Receipt, { ReceiptData } from '../components/Receipt';
import { buildReceiptHTML, buildReceiptPDF, doPrint, getPrintSettings, openCashDrawer } from '../components/ReceiptPrint';
import { saveFacture } from '../api/factures';
import { useSettings } from '../contexts/SettingsContext';
import { storeIdentity } from '../api/settings';
import { verifierPin } from '../utils/pin';
import { useIsMobile } from '../hooks/useIsMobile';
import { formatVolume, displayName } from '../utils/text';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import StoreLogo from '../components/StoreLogo';
import { t, dateLocale } from '../i18n';

// ── Constants ─────────────────────────────────────────────────────────────────

const fmtN = (n: number) => n.toLocaleString(dateLocale());

const PAYMENT_METHODS = [
  { value: 'cash',         label: t('Espèces', 'Cash')  },
  { value: 'mobile_money', label: 'Mobile M.' },
  { value: 'card',         label: t('Carte', 'Card')    },
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
  if (key === 'tout' || key === 'all') return ICO_TOUT;
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

// Un article « divers » est un produit synthétique non enregistré en base.
const isDiversProduct = (p: Product) => !!p.divers || p._id.startsWith('divers-');

// Construit une ligne de vente : sans productId (avec flag divers) pour un
// article non référencé, sinon avec le vrai productId.
function toSaleItem(i: CartItem) {
  const base = { name: i.product.name, quantity: i.quantity, unitPrice: effectivePrice(i.product) };
  return isDiversProduct(i.product) ? { ...base, divers: true } : { ...base, product: i.product._id };
}

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
  const [sortBy,         setSortBy]         = useState<'pop' | 'name' | 'price' | 'subCategory'>('pop');
  // Filtre de disponibilité : tous / en stock uniquement / en rupture uniquement
  type StockFilter = 'all' | 'available' | 'unavailable';
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
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
  const [showDivers,     setShowDivers]     = useState(false);
  const [diversName,     setDiversName]     = useState('');
  const [diversPrice,    setDiversPrice]    = useState('');
  const [receiptData,    setReceiptData]    = useState<ReceiptData | null>(null);
  const [ticketNo]                          = useState(genTicketNo);
  const [ticketTime]                        = useState(() =>
    new Date().toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
  );
  const [isOnline,       setIsOnline]       = useState(() => navigator.onLine);
  const [pendingCount,   setPendingCount]   = useState(0);
  // Offre sur facture : en POURCENTAGE ou en MONTANT (FCFA) — un seul mode
  // par ticket (changer de mode remet l'autre valeur à zéro).
  const [offreMode,      setOffreMode]      = useState<'pct' | 'fcfa'>('pct');
  const [offrePct,       setOffrePct]       = useState(0);
  const [offreFcfa,      setOffreFcfa]      = useState(0);
  const [showLogoutModal,setShowLogoutModal]= useState(false);
  const [showAudit,      setShowAudit]      = useState(false);
  const [auditRows,      setAuditRows]      = useState<AuditLogEntry[]>([]);
  const [auditLoading,   setAuditLoading]   = useState(false);
  const [sessionId,      setSessionId]      = useState<string | null>(null);
  const [sessionStart,   setSessionStart]   = useState<Date | null>(null);
  const [sessionSales,   setSessionSales]   = useState(0);
  const [locked,         setLocked]         = useState(false);
  const [lockPin,        setLockPin]        = useState('');
  const [lockError,      setLockError]      = useState(false);

  // Dérivation PBKDF2 du PIN (jamais en clair) — vérification hors-ligne, voir utils/pin.ts
  const caissePinKdf  = payload?.caisse?.pinKdf  ?? null;
  const caissePinSalt = payload?.caisse?.pinSalt ?? null;
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
      const c = p.category?.trim() || t('Autre', 'Other');
      map.set(c, (map.get(c) ?? 0) + p.stock);
    });
    const totalStock = allProducts.reduce((s, p) => s + p.stock, 0);
    return [
      { name: t('Tout', 'All'), count: totalStock },
      ...Array.from(map.entries()).map(([name, count]) => ({ name, count })),
    ];
  }, [allProducts]);

  // ── Filtered + sorted products ────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let list = allProducts;
    if (stockFilter === 'available')   list = list.filter(p => p.stock > 0);   // en stock
    if (stockFilter === 'unavailable') list = list.filter(p => p.stock <= 0);  // en rupture
    if (selectedCat) list = list.filter(p => (p.category?.trim() || t('Autre', 'Other')) === selectedCat);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'name')  return a.name.localeCompare(b.name, dateLocale());
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'subCategory') {
        const cmp = (a.subCategory ?? '').localeCompare(b.subCategory ?? '', dateLocale());
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name, dateLocale());
      }
      return b.stock - a.stock; // popularity = most stocked
    });
  }, [allProducts, selectedCat, searchQuery, sortBy, stockFilter]);

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

  // Ajoute un article « divers » (non référencé en base) : produit synthétique
  // avec un stock élevé pour ne déclencher aucune alerte/écart.
  const addDivers = useCallback(() => {
    const prix = Math.round(Number(diversPrice));
    if (!prix || prix <= 0) { addToast(t('Saisissez un prix valide', 'Enter a valid price'), 'error'); return; }
    const item: Product = {
      _id: `divers-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: diversName.trim() || t('Article divers', 'Miscellaneous item'),
      price: prix, costPrice: 0, stock: 999999, alertThreshold: 0,
      unit: '', divers: true,
    };
    addToCart(item);
    setShowDivers(false); setDiversName(''); setDiversPrice('');
  }, [diversPrice, diversName, addToCart, addToast]);

  const changeQty = useCallback((id: string, delta: number) =>
    setCart(prev =>
      prev.map(i => i.product._id === id ? { ...i, quantity: i.quantity + delta } : i)
          .filter(i => i.quantity > 0)
    ), []);

  // ── Écart stock : modal de confirmation ──────────────────────────────────
  const [ecartModal, setEcartModal] = useState<{
    items: Array<{ product: CartItem['product']; stockSysteme: number; quantiteVendue: number; ecart: number }>;
    onConfirmReduce: () => void;
    onConfirmForce: () => void;
  } | null>(null);

  const removeItem = useCallback((id: string) =>
    setCart(prev => prev.filter(i => i.product._id !== id)), []);

  const clearCart = useCallback(() => {
    setCart([]); setAmountPaid(''); setOffrePct(0); setOffreFcfa(0); focusScan();
  }, [focusScan]);

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async (codeArg?: string) => {
    // On lit le code passé en argument (valeur réelle du champ au moment du
    // scan) plutôt que l'état React, qui peut être en retard d'un caractère
    // avec un scanner physique rapide → évite les « produit introuvable ».
    const code = (codeArg ?? searchQuery).trim();
    if (!code || scanning) return;
    setScanError(null);
    setScanning(true);
    try {
      // Recherche locale d'abord (instantané, pas de réseau) : code-barres du
      // produit, PUIS numéro interne des étiquettes maison (produits sans code
      // fabricant) — voir utils/sku.ts, la même source que la page Étiquettes.
      const local = trouverParCode(allProducts, code);
      const prod = local ?? await getProductByBarcode(code);
      addToCart(prod);
      // Garde-fou : confirme à voix haute le produit ajouté (nom + prix) pour
      // que le caissier détecte tout de suite un code-barres mal attribué.
      addToast(`✓ ${displayName(prod.name)} — ${fmtN(effectivePrice(prod))} XAF`, 'success');
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : t('Produit non trouvé', 'Product not found'));
      setSearchQuery(''); // vide le champ pour ne pas concaténer le scan suivant
      playBeep(false); vibrate(150);
    } finally {
      setScanning(false); focusScan();
    }
  }, [searchQuery, scanning, allProducts, addToCart, focusScan, addToast]);

  const handleQRDetected = useCallback((code: string) => {
    setScanError(null); setScanning(true);
    getProductByBarcode(code)
      .then(prod => { addToCart(prod); addToast(`✓ ${displayName(prod.name)} — ${fmtN(effectivePrice(prod))} XAF`, 'success'); })
      .catch(err => { setScanError(err instanceof Error ? err.message : t('Non trouvé', 'Not found')); playBeep(false); vibrate(150); })
      .finally(() => { setScanning(false); focusScan(); });
  }, [addToCart, focusScan, addToast]);

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
  // Montant de la réduction facture selon le mode choisi (jamais plus que le sous-total)
  const offreAmt   = offreMode === 'pct'
    ? (offrePct > 0 ? Math.round(subtotal * offrePct / 100) : 0)
    : Math.min(Math.max(0, Math.round(offreFcfa)), subtotal);
  const total      = subtotal - offreAmt;
  const itemCount  = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const paid       = parseFloat(amountPaid) || 0;
  const change     = Math.max(0, paid - total);
  const notEnough  = paymentMethod === 'cash' && paid > 0 && paid < total;
  const canValidate = cart.length > 0 && !validating && !(paymentMethod === 'cash' && (paid === 0 || paid < total));

  // ── Hold / resume ─────────────────────────────────────────────────────────
  const handleHold = useCallback(() => {
    if (cart.length === 0) return;
    if (heldTickets.length >= 5) {
      addToast(t('Maximum 5 tickets en attente simultanément', 'Maximum 5 receipts on hold at once'), 'error');
      return;
    }
    const held: HeldTicket = {
      id: Date.now().toString(),
      ticketNo,
      time: new Date().toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      total,
    };
    setHeldTickets(prev => [...prev, held]);
    setCart([]);
    setAmountPaid('');
    addToast(t(`Ticket #${ticketNo} mis en attente`, `Receipt #${ticketNo} put on hold`), 'success');
    focusScan();
  }, [cart, heldTickets.length, ticketNo, total, addToast, focusScan]);

  const handleResume = useCallback((id: string) => {
    if (cart.length > 0) {
      addToast(t('Encaissez ou annulez le ticket courant avant de reprendre', 'Check out or cancel the current receipt before resuming'), 'warning');
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

  // ── Exécute la vente (normale ou forcée) ─────────────────────────────────
  const doValidate = useCallback(async (forceVente = false, ecartsData?: SalePayload['ecarts']) => {
    const cartSnap = [...cart];
    const pmLabel  = PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label ?? paymentMethod;
    const effPaid  = paymentMethod === 'cash' ? paid : total;

    // Clé d'idempotence : générée UNE fois pour cette vente et réutilisée sur
    // tous les chemins (réessais, sauvegarde hors-ligne) → jamais de doublon.
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setValidating(true);
    setEcartModal(null);

    // ── Offline path ───────────────────────────────────────────────────────
    if (!navigator.onLine) {
      try {
        await savePendingSale({ items: cart.map(toSaleItem), total, subtotal, ...(offreAmt > 0 ? { ...(offreMode === 'pct' ? { offrePct } : {}), offreAmt } : {}), cashierName: payload?.name ?? t('Caissier', 'Cashier'), paymentLabel: pmLabel, paymentMethod, amountPaid: effPaid, idempotencyKey });
        for (const item of cart) await decrementCachedStock(item.product._id, item.quantity);
        const cached = await getCachedProducts(); setAllProducts(cached);
        setPendingCount(prev => prev + 1); setSessionSales(n => n + 1);
        addToast(t('Mode hors ligne — vente sauvegardée, à synchroniser', 'Offline mode — sale saved, pending sync'), 'warning');
        const d = new Date(); const dateP = d.toISOString().slice(0,10).replace(/-/g,'');        const offlineData: ReceiptData = {
          receiptNo: `OFF-${dateP}-${Math.random().toString(36).slice(2,8).toUpperCase()}`, date: d,
          cashierName: payload?.name ?? t('Caissier', 'Cashier'), storePhone: settings.telephone || undefined, store: storeIdentity(settings),
          items: cartSnap.map(i => ({ name: i.product.name, localName: i.product.localName || undefined, unit: i.product.unit, valeur: i.product.valeur || undefined, quantity: i.quantity, unitPrice: effectivePrice(i.product), ...(i.product.discount && i.product.discount > 0 ? { discount: i.product.discount, originalPrice: i.product.price } : {}) })),
          subtotal, total, paymentLabel: pmLabel, amountPaid: effPaid, change: Math.max(0, effPaid - total),
          ...(offreAmt > 0 ? { ...(offreMode === 'pct' ? { offrePct } : {}), offreAmt } : {}),
          offre: settings.offreFacture,
        };
        setReceiptData(offlineData); setCart([]); setAmountPaid(''); setPaymentMethod('cash');
        const ps = getPrintSettings(); if (ps.auto) doPrint(buildReceiptHTML(offlineData), ps.copies);
      } catch { addToast(t('Erreur sauvegarde locale', 'Local save error'), 'error'); }
      finally { setValidating(false); focusScan(); }
      return;
    }

    const MAX_RETRIES = 3;
    const saleItems = cart.map(toSaleItem);
    let succeeded = false; let nonRetryable = false;

    for (let attempt = 0; attempt < MAX_RETRIES && !nonRetryable && !succeeded; attempt++) {
      if (attempt > 0) await new Promise<void>(r => setTimeout(r, 2000));
      try {
        const result = await createSale({ items: saleItems, total, subtotal, ...(offreAmt > 0 ? { ...(offreMode === 'pct' ? { offrePct } : {}), offreAmt } : {}), paymentMethod, amountPaid: effPaid, sessionId: sessionId ?? undefined, forceVente: forceVente || undefined, ecarts: ecartsData, idempotencyKey });
        succeeded = true;
        const d = new Date(); const dateP = d.toISOString().slice(0,10).replace(/-/g,''); const idPart = String(result.sale._id).slice(-6).toUpperCase();        const newData: ReceiptData = {
          receiptNo: `FSV-${dateP}-${idPart}`, date: d, cashierName: payload?.name ?? t('Caissier', 'Cashier'), storePhone: settings.telephone || undefined, store: storeIdentity(settings),
          items: cartSnap.map(i => ({ name: i.product.name, localName: i.product.localName || undefined, unit: i.product.unit, valeur: i.product.valeur || undefined, quantity: i.quantity, unitPrice: effectivePrice(i.product), ...(i.product.discount && i.product.discount > 0 ? { discount: i.product.discount, originalPrice: i.product.price } : {}) })),
          subtotal, total, paymentLabel: pmLabel, amountPaid: effPaid, change: result.change,
          ...(offreAmt > 0 ? { ...(offreMode === 'pct' ? { offrePct } : {}), offreAmt } : {}),
          offre: settings.offreFacture,
        };
        // Archive PDF automatique — l'historique des factures est complet même sans clic « Imprimer »
        try {
          saveFacture({ numero: newData.receiptNo, caissier: newData.cashierName, montant: total, paymentMethod: pmLabel, items: newData.items.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })), pdfBase64: buildReceiptPDF(newData), date: d.toISOString() });
        } catch { /* silencieux — l'archive ne doit jamais bloquer la vente */ }
        setReceiptData(newData); setCart([]); setAmountPaid(''); setPaymentMethod('cash'); setOffrePct(0); setOffreFcfa(0);
        setSessionSales(n => n + 1);
        if (attempt > 0) addToast(t('Vente enregistrée ✅', 'Sale recorded ✅'), 'success');
        const ps = getPrintSettings(); if (ps.auto) { doPrint(buildReceiptHTML(newData), ps.copies); if (paymentMethod === 'cash') openCashDrawer(); }
        for (const a of result.alerts) addToast(a.stock === 0 ? t(`Rupture — ${a.productName}`, `Out of stock — ${a.productName}`) : t(`Stock bas — ${a.productName} : ${a.stock} restant(s)`, `Low stock — ${a.productName}: ${a.stock} left`), 'warning');
      } catch (err: unknown) {
        const kind = err instanceof SaleError ? err.kind : 'unknown';
        const msg  = err instanceof Error ? err.message : t("Erreur d'enregistrement", 'Save error');
        if (kind === 'auth') {
          nonRetryable = true;
          try { await savePendingSale({ items: saleItems, total, subtotal, ...(offreAmt > 0 ? { ...(offreMode === 'pct' ? { offrePct } : {}), offreAmt } : {}), cashierName: payload?.name ?? t('Caissier', 'Cashier'), paymentLabel: pmLabel, paymentMethod, amountPaid: effPaid, idempotencyKey }); addToast(t('Session expirée — ticket sauvegardé localement', 'Session expired — receipt saved locally'), 'warning'); } catch {}
          setTimeout(() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }, 1800);
        } else if (kind === 'stock') {
          nonRetryable = true;
          const availMatch = msg.match(/disponible[^\d]*(\d+)/i); const nameMatch = msg.match(/pour\s+"([^"]+)"/i) ?? msg.match(/pour\s+'([^']+)'/i);
          if (availMatch && nameMatch) {
            const available = parseInt(availMatch[1]); const productName = nameMatch[1];
            setCart(prev => prev.map(i => i.product.name === productName && i.quantity > available ? { ...i, quantity: available } : i).filter(i => i.quantity > 0));
            addToast(t(`Quantité réduite à ${available} pour "${productName}"`, `Quantity reduced to ${available} for "${productName}"`), 'warning');
          } else { addToast(msg, 'error'); }
        } else if (attempt < MAX_RETRIES - 1) {
          if (kind === 'timeout') { setRetryLabel(t(`Connexion lente, tentative ${attempt + 2}/${MAX_RETRIES}…`, `Slow connection, attempt ${attempt + 2}/${MAX_RETRIES}…`)); addToast(t('Connexion lente — nouvelle tentative…', 'Slow connection — retrying…'), 'warning'); }
          else if (kind === 'server_sleep') { setRetryLabel(t(`Serveur en démarrage, tentative ${attempt + 2}/${MAX_RETRIES}…`, `Server starting up, attempt ${attempt + 2}/${MAX_RETRIES}…`)); addToast(t('Serveur en démarrage (30s) — nouvelle tentative…', 'Server starting up (30s) — retrying…'), 'warning'); }
          else { setRetryLabel(t(`Tentative ${attempt + 2}/${MAX_RETRIES}…`, `Attempt ${attempt + 2}/${MAX_RETRIES}…`)); addToast(t(`Erreur réseau — tentative ${attempt + 2}/${MAX_RETRIES}…`, `Network error — attempt ${attempt + 2}/${MAX_RETRIES}…`), 'warning'); }
        } else {
          setRetryLabel(t('Sauvegarde locale…', 'Saving locally…'));
          try {
            await savePendingSale({ items: saleItems, total, subtotal, ...(offreAmt > 0 ? { ...(offreMode === 'pct' ? { offrePct } : {}), offreAmt } : {}), cashierName: payload?.name ?? t('Caissier', 'Cashier'), paymentLabel: pmLabel, paymentMethod, amountPaid: effPaid, idempotencyKey });
            for (const item of cart) await decrementCachedStock(item.product._id, item.quantity);
            const cached = await getCachedProducts(); setAllProducts(cached); setPendingCount(prev => prev + 1);
            const d = new Date(); const dateP = d.toISOString().slice(0,10).replace(/-/g,'');            const offlineData: ReceiptData = {
              receiptNo: `OFF-${dateP}-${Math.random().toString(36).slice(2,8).toUpperCase()}`, date: d, cashierName: payload?.name ?? t('Caissier', 'Cashier'), storePhone: settings.telephone || undefined, store: storeIdentity(settings),
              items: cartSnap.map(i => ({ name: i.product.name, localName: i.product.localName || undefined, unit: i.product.unit, valeur: i.product.valeur || undefined, quantity: i.quantity, unitPrice: effectivePrice(i.product), ...(i.product.discount && i.product.discount > 0 ? { discount: i.product.discount, originalPrice: i.product.price } : {}) })),
              subtotal, total, paymentLabel: pmLabel, amountPaid: effPaid, change: Math.max(0, effPaid - total),
              ...(offreAmt > 0 ? { ...(offreMode === 'pct' ? { offrePct } : {}), offreAmt } : {}),
              offre: settings.offreFacture,
            };
            setReceiptData(offlineData); setCart([]); setAmountPaid(''); setPaymentMethod('cash');
            addToast(t('Vente sauvegardée localement — synchronisation dès que possible', 'Sale saved locally — will sync as soon as possible'), 'warning');
            const ps = getPrintSettings(); if (ps.auto) doPrint(buildReceiptHTML(offlineData), ps.copies);
          } catch { addToast(t("Échec définitif — impossible d'enregistrer la vente", 'Permanent failure — unable to save the sale'), 'error'); }
        }
      }
    }
    setRetryLabel(''); setValidating(false); focusScan();
  }, [cart, paymentMethod, paid, total, subtotal, offrePct, offreAmt, offreMode, sessionId, addToast, focusScan, payload, settings]);

  // ── Validate — vérifie les écarts avant d'appeler doValidate ─────────────
  const handleValidate = useCallback(async () => {
    if (!canValidate) return;
    if (paymentMethod === 'cash' && (paid === 0 || paid < total)) {
      addToast(t('Montant reçu insuffisant', 'Insufficient amount received'), 'error'); return;
    }

    // Détecter les écarts de stock
    const ecarts = cart.filter(i => !isDiversProduct(i.product) && i.quantity > i.product.stock).map(i => ({
      product: i.product,
      stockSysteme:   i.product.stock,
      quantiteVendue: i.quantity,
      ecart:          i.product.stock - i.quantity, // négatif
    }));

    if (ecarts.length > 0) {
      // Afficher le modal de confirmation
      setEcartModal({
        items: ecarts.map(e => ({ product: e.product, stockSysteme: e.stockSysteme, quantiteVendue: e.quantiteVendue, ecart: e.ecart })),
        onConfirmReduce: () => {
          // Réduire les quantités au stock disponible
          setCart(prev => prev.map(i => {
            const ec = ecarts.find(e => e.product._id === i.product._id);
            return ec ? { ...i, quantity: ec.stockSysteme } : i;
          }).filter(i => i.quantity > 0));
          setEcartModal(null);
          // doValidate sera rappelé depuis le cart mis à jour
        },
        onConfirmForce: () => {
          const ecartsData = ecarts.map(e => ({
            produit:        e.product._id,
            nomProduit:     e.product.name,
            stockSysteme:   e.stockSysteme,
            quantiteVendue: e.quantiteVendue,
            ecart:          e.ecart,
          }));
          doValidate(true, ecartsData);
        },
      });
      return;
    }

    // Pas d'écart → validation normale
    doValidate(false);
  }, [canValidate, cart, paymentMethod, paid, total, addToast, doValidate]);




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

  const SORT_LABELS = { pop: t('Trier par popularité', 'Sort by popularity'), name: t('Trier par nom', 'Sort by name'), price: t('Trier par prix', 'Sort by price'), subCategory: t('Trier par sous-catégorie', 'Sort by subcategory') };

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

      {/* ── Modal écart de stock ── */}
      {ecartModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ background: '#DC2626', padding: '16px 22px' }}>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: 0 }}>{t('⚠ Stock insuffisant en système', '⚠ Insufficient stock in system')}</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: '4px 0 0' }}>{t('Ces produits dépassent le stock enregistré', 'These products exceed the recorded stock')}</p>
            </div>
            <div style={{ padding: '18px 22px' }}>
              {ecartModal.items.map((item, i) => (
                <div key={i} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1F1A1A', marginBottom: 6 }}>{displayName(item.product.name)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: t('Stock système', 'System stock'), val: item.stockSysteme,   color: '#DC2626' },
                      { label: t('Qté vendue', 'Qty sold'),   val: item.quantiteVendue, color: 'var(--fs-wine-700)' },
                      { label: t('Écart', 'Discrepancy'),        val: item.ecart,          color: '#991B1B' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7280', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '14px 0 16px', textAlign: 'center' }}>
                {t('Confirmez-vous que ces produits sont physiquement disponibles ?', 'Do you confirm these products are physically available?')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => { setEcartModal(null); }}
                  style={{ padding: '11px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#6B7280' }}>
                  {t('Annuler la vente', 'Cancel the sale')}
                </button>
                <button
                  onClick={ecartModal.onConfirmReduce}
                  style={{ padding: '11px', border: '1.5px solid #D97706', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFF7ED', color: '#92400E' }}>
                  {t('Réduire au stock disponible', 'Reduce to available stock')}
                </button>
                <button
                  onClick={ecartModal.onConfirmForce}
                  style={{ padding: '11px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#DC2626', color: '#fff' }}>
                  {t('✓ Confirmer la vente avec écart', '✓ Confirm sale with discrepancy')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lock screen (inactivité 10 min) ── */}
      {locked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--fs-wine-900)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ color: 'var(--fs-gold-400)', fontFamily: 'var(--fs-font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '0.1em' }}>{(settings.nomMagasin || 'Family Store').toUpperCase()}</div>
          <div style={{ color: 'rgba(245,235,217,0.6)', fontSize: 13 }}>{t('Session verrouillée — Saisir le code PIN', 'Session locked — Enter PIN code')}</div>
          <div style={{ display: 'flex', gap: 10, margin: '8px 0' }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: lockPin.length > i ? 'var(--fs-gold-400)' : 'rgba(255,255,255,0.2)' }}/>
            ))}
          </div>
          {lockError && <div style={{ color: '#f87171', fontSize: 12 }}>{t('Code incorrect', 'Incorrect code')}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 10 }}>
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, idx) => (
              <button key={idx} onClick={() => {
                if (k === '⌫') { setLockPin(p => p.slice(0,-1)); setLockError(false); return; }
                if (k === '') return;
                const next = lockPin + String(k);
                setLockPin(next);
                if (next.length === 4) {
                  (async () => {
                    if (caissePinKdf && caissePinSalt && await verifierPin(next, caissePinSalt, caissePinKdf)) {
                      setLocked(false); setLockPin(''); setLockError(false);
                    } else { setLockError(true); setLockPin(''); }
                  })();
                }
              }}
                style={{ width: 64, height: 64, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', background: k === '' ? 'transparent' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 20, fontWeight: 600, cursor: k === '' ? 'default' : 'pointer' }}>
                {k}
              </button>
            ))}
          </div>
          <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(245,235,217,0.35)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
            {t('Changer de session', 'Switch session')}
          </button>
        </div>
      )}

      {/* ── Logout confirmation modal ── */}
      {showLogoutModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 360, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'var(--fs-wine-900)', padding: '16px 22px' }}>
              <p style={{ color: 'var(--fs-gold-400)', fontWeight: 800, fontSize: 15, margin: 0 }}>{t('Ticket en cours', 'Receipt in progress')}</p>
              <p style={{ color: 'rgba(245,235,217,0.7)', fontSize: 12, margin: '4px 0 0' }}>
                {t(`Vous avez ${cart.length} article${cart.length > 1 ? 's' : ''} dans le ticket (${cart.reduce((s,i)=>s+i.quantity,0)} qté — ${cart.reduce((s,i)=>s+i.product.price*i.quantity,0).toLocaleString(dateLocale())} XAF).`, `You have ${cart.length} item${cart.length > 1 ? 's' : ''} in the receipt (${cart.reduce((s,i)=>s+i.quantity,0)} qty — ${cart.reduce((s,i)=>s+i.product.price*i.quantity,0).toLocaleString(dateLocale())} XAF).`)}
              </p>
            </div>
            <div style={{ padding: '18px 22px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  // Sauvegarder le ticket dans localStorage AVANT la redirection
                  const held: HeldTicket = {
                    id: Date.now().toString(),
                    ticketNo,
                    time: new Date().toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }),
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
                {t('Mettre en attente & se déconnecter', 'Put on hold & log out')}
              </button>
              <button
                onClick={() => { setCart([]); setAmountPaid(''); setShowLogoutModal(false); if (sessionId) closeSession(sessionId); localStorage.removeItem('access_token'); window.location.href = '/login'; }}
                style={{ padding: '11px 0', borderRadius: 10, border: '2px solid #ef4444', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {t('Annuler le ticket & se déconnecter', 'Cancel receipt & log out')}
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ padding: '10px 0', borderRadius: 10, border: '1.5px solid var(--fs-line-2)', background: 'var(--fs-ivory)', color: 'var(--fs-ink-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {t('Rester connecté', 'Stay logged in')}
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

      {/* Modal Article divers (produit non référencé) */}
      {showDivers && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowDivers(false); focusScan(); } }}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 26px', maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-900)', marginBottom: 4 }}>{t('Article divers', 'Miscellaneous item')}</div>
            <div style={{ fontSize: 12, color: 'var(--fs-ink-500)', marginBottom: 18 }}>
              {t('Produit non enregistré. Saisissez le prix affiché en rayon pour servir le client tout de suite.', 'Unregistered product. Enter the shelf price to serve the customer right away.')}
            </div>

            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{t('Désignation (optionnel)', 'Description (optional)')}</label>
            <input
              value={diversName}
              onChange={e => setDiversName(e.target.value)}
              placeholder={t('Ex : Article en rayon', 'E.g. shelf item')}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', marginBottom: 14 }}
            />

            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{t('Prix (XAF) *', 'Price (XAF) *')}</label>
            <input
              type="text" inputMode="numeric"
              value={diversPrice}
              onChange={e => setDiversPrice(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') addDivers(); }}
              placeholder="0"
              autoFocus
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 18, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowDivers(false); focusScan(); }}
                style={{ flex: 1, padding: '11px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)' }}>
                {t('Annuler', 'Cancel')}
              </button>
              <button onClick={addDivers}
                style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-wine-700)', color: '#fff', fontFamily: 'var(--fs-font-sans)' }}>
                {t('Ajouter au ticket', 'Add to receipt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panneau Audit admin — actions de l'administrateur sur la caisse */}
      {showAudit && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowAudit(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fs-ink-900)' }}>{t('Audit admin', 'Admin audit')}</div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>{t("Actions de l'administrateur sur la caisse (suppressions de vente…)", 'Administrator actions on the cash register (sale deletions…)')}</div>
              </div>
              <button onClick={() => setShowAudit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 0' }}>
              {auditLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13 }}>{t('Chargement…', 'Loading…')}</div>
              ) : auditRows.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13 }}>{t('Aucune action enregistrée', 'No recorded actions')}</div>
              ) : auditRows.map(a => (
                <div key={a._id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--fs-line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--fs-wine-100)', color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Suppression', 'Deletion')}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{a.actorName}</span>
                    <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>({a.actorRole})</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-700)' }}>{a.detail}</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>
                    {new Date(a.createdAt).toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' })} {t('à', 'at')} {new Date(a.createdAt).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
        {/* Logo du magasin + espace courant */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <StoreLogo width={140}/>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fs-gold-500)', marginBottom: 2 }}>{settings.nomMagasin || 'Family Store'}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{t('Caisse', 'Checkout')}</div>
        </div>

        {/* Identity panel */}
        <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.caisse?.nom ?? (payload?.role === 'patron' ? t('Mode dépannage', 'Backup mode') : '—')}</div>
            <div style={{ fontSize: 10, color: 'rgba(245,235,217,0.45)', marginTop: 1 }}>
              {sessionStart ? sessionStart.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : '—'} · {sessionSales} {t(`vente${sessionSales !== 1 ? 's' : ''}`, `sale${sessionSales !== 1 ? 's' : ''}`)}
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
          }}>{t('Catégories', 'Categories')}</p>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {categories.map(cat => {
            const isActive = cat.name === t('Tout', 'All') ? !selectedCat : selectedCat === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCat(cat.name === t('Tout', 'All') ? null : cat.name)}
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

        {/* Audit admin */}
        <div style={{ padding: '6px 12px 0' }}>
          <button
            onClick={() => { setShowAudit(true); setAuditLoading(true); getCaisseAudit().then(setAuditRows).catch(() => {}).finally(() => setAuditLoading(false)); }}
            style={{ width: '100%', background: 'none', border: '1px solid rgba(245,235,217,0.15)', borderRadius: 7, color: 'rgba(245,235,217,0.6)', cursor: 'pointer', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}
            title={t("Voir les actions de l'administrateur (suppressions de vente…)", 'View administrator actions (sale deletions…)')}
          >
            <Ico d="M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z" size={13}/>
            {t('Audit admin', 'Admin audit')}
          </button>
        </div>

        {/* Retour admin (patron uniquement) */}
        {payload?.role === 'patron' && (
          <div style={{ padding: '6px 12px 0' }}>
            <button
              onClick={() => { window.location.href = '/admin/dashboard'; }}
              style={{ width: '100%', background: 'rgba(245,235,217,0.06)', border: '1px solid rgba(245,235,217,0.2)', borderRadius: 7, color: 'var(--fs-gold-400)', cursor: 'pointer', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}
            >
              <Ico d="M15 18l-6-6 6-6" size={13}/> {t('Retour admin', 'Back to admin')}
            </button>
          </div>
        )}

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
            title={t('Déconnexion', 'Log out')}
          >
            <Ico d={ICO_LOGOUT} size={13}/>
            {t('Déconnexion', 'Log out')}
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
              const isActive = cat.name === t('Tout', 'All') ? !selectedCat : selectedCat === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCat(cat.name === t('Tout', 'All') ? null : cat.name)}
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
              inputMode="numeric"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setScanError(null); }}
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                // Valeur réelle saisie (complète même si l'état React est en retard)
                const code = e.currentTarget.value.trim();
                if (code) {
                  if (!code.includes(' ') || filteredProducts.length === 0) handleScan(code);
                } else if (canValidate) {
                  handleValidate();
                }
              }}
              placeholder={t('Rechercher un produit, scanner un code-barres...', 'Search for a product, scan a barcode...')}
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
            title={t('Cliquez pour activer la saisie scanner (douchette / F2)', 'Click to activate scanner input (barcode gun / F2)')}
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
            {!isMobile && t('SCANNER PRÊT', 'SCANNER READY')}
          </button>

          {/* Camera scanner — separate button */}
          <button
            onClick={() => setShowQR(true)}
            title={t('Scanner via caméra (QR code)', 'Scan via camera (QR code)')}
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

          {/* Article divers — produit non référencé */}
          <button
            onClick={() => { setDiversName(''); setDiversPrice(''); setShowDivers(true); }}
            title={t('Vendre un article non enregistré dans le système', 'Sell an item not registered in the system')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: isMobile ? '6px 8px' : '6px 12px',
              border: '1.5px solid var(--fs-wine-700)',
              borderRadius: 'var(--fs-r-md)',
              background: 'var(--fs-paper)',
              color: 'var(--fs-wine-700)',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
              fontFamily: 'var(--fs-font-sans)',
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
            {!isMobile && t('Article divers', 'Miscellaneous item')}
          </button>

          {/* Audit admin — mobile uniquement (desktop l'a dans la barre latérale) */}
          {isMobile && (
            <button
              onClick={() => { setShowAudit(true); setAuditLoading(true); getCaisseAudit().then(setAuditRows).catch(() => {}).finally(() => setAuditLoading(false)); }}
              title={t("Audit admin — actions de l'administrateur", 'Admin audit — administrator actions')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '6px 8px', border: '1.5px solid var(--fs-line-2)',
                borderRadius: 'var(--fs-r-md)', background: 'var(--fs-paper)',
                color: 'var(--fs-ink-500)', cursor: 'pointer',
              }}
            >
              <Ico d="M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z" size={15}/>
            </button>
          )}

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
            {!isMobile && (isOnline ? t('En ligne', 'Online') : t('Hors ligne', 'Offline'))}
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
            {selectedCat ?? t('Tout', 'All')}
            <span style={{ color: 'var(--fs-ink-300)', margin: '0 5px' }}>›</span>
            <span style={{ color: 'var(--fs-ink-300)', fontFamily: 'var(--fs-font-mono)', fontSize: 13 }}>
              {filteredProducts.length} {t(`produit${filteredProducts.length !== 1 ? 's' : ''} différent${filteredProducts.length !== 1 ? 's' : ''}`, `different product${filteredProducts.length !== 1 ? 's' : ''}`)}
            </span>
          </span>

          {scanError && (
            <span style={{ fontSize: 14, color: 'var(--fs-danger-700)', fontWeight: 600 }}>
              ✕ {scanError}
            </span>
          )}

          {/* Filtre de disponibilité : Tous / En stock / Ruptures */}
          <div
            role="group" aria-label={t('Filtrer par disponibilité', 'Filter by availability')}
            style={{ display: 'flex', border: '1.5px solid var(--fs-line-2)', borderRadius: 'var(--fs-r-sm)', overflow: 'hidden' }}
          >
            {([
              { key: 'all',         label: t('Tous', 'All'),        title: t('Tous les produits (en stock et en rupture)', 'All products (in stock and out of stock)') },
              { key: 'available',   label: t('En stock', 'In stock'), title: t('Uniquement les produits en stock', 'Only products in stock') },
              { key: 'unavailable', label: t('Ruptures', 'Out of stock'),    title: t('Uniquement les produits en rupture de stock', 'Only products that are out of stock') },
            ] as { key: StockFilter; label: string; title: string }[]).map((opt, i) => {
              const active = stockFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setStockFilter(opt.key)}
                  title={opt.title}
                  aria-pressed={active}
                  style={{
                    border: 'none',
                    borderLeft: i > 0 ? '1.5px solid var(--fs-line-2)' : 'none',
                    background: active ? 'var(--fs-wine-700)' : 'none',
                    color: active ? '#fff' : 'var(--fs-ink-500)',
                    padding: '5px 12px', fontSize: 13, cursor: 'pointer',
                    fontFamily: 'var(--fs-font-sans)', fontWeight: 600,
                  }}
                >
                  {active ? '✓ ' : ''}{opt.label}
                </button>
              );
            })}
          </div>

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
                {(['pop', 'name', 'price', 'subCategory'] as const).map(s => (
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
              {t('Chargement…', 'Loading…')}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fs-ink-300)', fontSize: 13 }}>
              {t('Aucun produit trouvé', 'No product found')}
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
                {t('Voir ticket', 'View receipt')} ({itemCount}) · {fmtN(total)} XAF
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
                    {retryLabel || t('Enregistrement…', 'Saving…')}
                  </>
                ) : t('✓ Encaisser', '✓ Collect payment')}
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
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{t('Tickets en attente', 'Receipts on hold')}</div>
                <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', marginTop: 1 }}>{heldTickets.length} / 5 {t(`ticket${heldTickets.length > 1 ? 's' : ''}`, `receipt${heldTickets.length > 1 ? 's' : ''}`)}</div>
              </div>
              <button onClick={() => setShowHeld(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex', padding: 4 }}>
                <Ico d={ICO_X} size={16}/>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {heldTickets.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fs-ink-300)', fontSize: 13 }}>
                  {t('Aucun ticket en attente', 'No receipt on hold')}
                </div>
              ) : heldTickets.map(tk => (
                <div key={tk.id} style={{ margin: '0 10px 8px', background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--fs-line)', background: 'var(--fs-ivory)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>#{tk.ticketNo}</span>
                    <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{tk.time}</span>
                  </div>
                  <div style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
                        {tk.cart.reduce((s, i) => s + i.quantity, 0)} {tk.cart.reduce((s, i) => s + i.quantity, 0) > 1 ? t('articles', 'items') : t('article', 'item')}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-mono)' }}>
                        {fmtN(tk.total)} XAF
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 10, lineHeight: 1.5 }}>
                      {tk.cart.slice(0, 3).map(i => i.product.name).join(', ')}
                      {tk.cart.length > 3 ? `… +${tk.cart.length - 3}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleResume(tk.id)}
                        style={{ flex: 2, padding: '8px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' }}
                      >
                        {t('↩ Reprendre', '↩ Resume')}
                      </button>
                      <button
                        onClick={() => handleCancelHeld(tk.id)}
                        style={{ flex: 1, padding: '8px', border: '1.5px solid rgba(194,62,36,0.25)', borderRadius: 8, background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' }}
                      >
                        {t('Annuler', 'Cancel')}
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
              {t('Ticket en cours', 'Receipt in progress')}
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
                {t('En attente', 'On hold')} ({heldTickets.length})
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
              <p style={{ fontSize: 14, margin: 0 }}>{t('Ticket vide', 'Empty receipt')}</p>
              <p style={{ fontSize: 13, margin: 0 }}>{t('Cliquez sur un produit', 'Click on a product')}</p>
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
              <Row label={t(`Sous-total (${itemCount} art.)`, `Subtotal (${itemCount} items)`)} value={fmtN(subtotal)} />
              {/* Offre globale sur facture : en % OU en montant (un seul mode par ticket,
                  changer de mode remet l'autre valeur à zéro) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--fs-ink-400)' }}>{t('Offre sur facture', 'Invoice discount')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Sélecteur de mode */}
                  <div style={{ display: 'flex', border: '1.5px solid var(--fs-line-2)', borderRadius: 6, overflow: 'hidden' }}>
                    {([['pct', '%'], ['fcfa', 'FCFA']] as const).map(([mode, lbl]) => (
                      <button key={mode} type="button"
                        onClick={() => { if (offreMode !== mode) { setOffreMode(mode); setOffrePct(0); setOffreFcfa(0); } }}
                        title={mode === 'pct' ? t('Réduction en pourcentage', 'Percentage discount') : t('Réduction en montant (FCFA)', 'Amount discount (FCFA)')}
                        style={{
                          padding: '2px 7px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                          background: offreMode === mode ? 'var(--fs-wine-700)' : '#fff',
                          color: offreMode === mode ? '#fff' : 'var(--fs-ink-400)',
                        }}>{lbl}</button>
                    ))}
                  </div>
                  {offreMode === 'pct' ? (
                    <input
                      type="number" min={0} max={100} step={1}
                      value={offrePct || ''}
                      onChange={e => setOffrePct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      placeholder="0"
                      style={{ width: 48, padding: '2px 6px', border: '1.5px solid var(--fs-line-2)', borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: 'center', outline: 'none', fontFamily: 'var(--fs-font-mono)', background: offrePct > 0 ? 'var(--fs-success-100)' : '#fff', color: offrePct > 0 ? 'var(--fs-success-700)' : 'var(--fs-ink-900)' }}
                    />
                  ) : (
                    <input
                      type="number" min={0} max={subtotal} step={5}
                      value={offreFcfa || ''}
                      onChange={e => setOffreFcfa(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder={t('ex : 500', 'e.g. 500')}
                      style={{ width: 76, padding: '2px 6px', border: '1.5px solid var(--fs-line-2)', borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: 'center', outline: 'none', fontFamily: 'var(--fs-font-mono)', background: offreAmt > 0 ? 'var(--fs-success-100)' : '#fff', color: offreAmt > 0 ? 'var(--fs-success-700)' : 'var(--fs-ink-900)' }}
                    />
                  )}
                  <span style={{ fontSize: 13, color: 'var(--fs-ink-400)' }}>{offreMode === 'pct' ? '%' : 'F'}</span>
                  {offreAmt > 0 && (
                    <span style={{ fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)', fontWeight: 600 }}>
                      −{fmtN(offreAmt)}
                    </span>
                  )}
                </div>
              </div>
              {offreMode === 'fcfa' && offreFcfa > subtotal && subtotal > 0 && (
                <div style={{ fontSize: 11, color: 'var(--fs-danger-700)', textAlign: 'right', marginBottom: 4 }}>
                  {t(`Réduction plafonnée au sous-total (${fmtN(subtotal)} XAF)`, `Discount capped at the subtotal (${fmtN(subtotal)} XAF)`)}
                </div>
              )}
            </div>

            {/* Gold rule */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--fs-gold-400) 30%, var(--fs-gold-400) 70%, transparent)', margin: '8px 14px', opacity: 0.6 }}/>

            <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-500)' }}>
                {offreAmt > 0 ? (offreMode === 'pct' ? `TOTAL (−${offrePct}%)` : `TOTAL (−${fmtN(offreAmt)} F)`) : 'TOTAL'}
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
                  placeholder={t(`Montant reçu (min. ${fmtN(total)})`, `Amount received (min. ${fmtN(total)})`)}
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
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-success-700)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('Monnaie à rendre', 'Change')}</span>
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
                    {retryLabel || t('Enregistrement…', 'Saving…')}
                  </>
                ) : (
                  <>{t('✓ Encaisser', '✓ Collect payment')} {fmtN(total)} XAF</>
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
                title={heldTickets.length >= 5 ? t('Maximum 5 tickets en attente', 'Maximum 5 receipts on hold') : ''}
              >
                <Ico d={ICO_PAUSE} size={14}/>
                {t('Mettre en attente', 'Put on hold')}
              </button>
              <button
                onClick={clearCart}
                style={{ background: 'none', border: 'none', color: 'var(--fs-danger-500)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fs-font-sans)' }}
              >
                <Ico d={ICO_X} size={12}/>
                {t('Annuler le ticket', 'Cancel receipt')}
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

// Volume du produit (champ « Valeur »). Renvoie '' si non renseigné.
// « 500ml » → « 500ml » ; « 500 » (sans unité) → « 500 mL ».
function volumeLabel(p: { valeur?: string; unit?: string }): string {
  return formatVolume(p.valeur, p.unit);   // L, mL, cL, g, Kg
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
      {/* Stock badge — en bas à droite (le haut est chargé, le bas-droite est libre) */}
      {product.stock > 0 && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
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
        }}>{t('STOCK BAS', 'LOW STOCK')}</div>
      )}
      {noStock && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: 'var(--fs-ink-700)',
          color: '#fff', borderRadius: 3,
          padding: '2px 6px',
          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
        }}>{t('RUPTURE', 'OUT OF STOCK')}</div>
      )}

      {/* Info area at bottom */}
      <div style={{ padding: '10px 10px 12px', background: 'rgba(255,255,255,0.62)' }}>
        <p style={{
          fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)',
          margin: '0 0 1px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{displayName(product.name)}</p>
        {product.localName && (
          <p style={{ fontSize: 11, color: '#999', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {product.localName}
          </p>
        )}
        <p style={{
          fontSize: 12, color: 'var(--fs-ink-500)', margin: '0 0 5px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {product.category ?? t('Autre', 'Other')}{product.subCategory ? ` › ${product.subCategory}` : ''}
        </p>
        {/* Emplacement volume réservé (même hauteur même sans volume) → cartes uniformes */}
        <div style={{ height: 22, marginBottom: 5 }}>
          {volumeLabel(product) && (
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: 'var(--fs-wine-700)', background: 'var(--fs-wine-50)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '2px 7px' }}>
              {volumeLabel(product)}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontFamily: 'var(--fs-font-mono)' }}>
          {(product.discount ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', textDecoration: 'line-through', marginRight: 5 }}>
              {product.price.toLocaleString(dateLocale())}
            </span>
          )}
          <span style={{ fontSize: 16, fontWeight: 800, color: (product.discount ?? 0) > 0 ? '#c0392b' : 'var(--fs-ink-800)', letterSpacing: '-0.01em' }}>
            {effectivePrice(product).toLocaleString(dateLocale())}
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
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(product.name)}</p>
        {product.localName && (
          <p style={{ fontSize: 10, color: '#aaa', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.localName}</p>
        )}
        <p style={{ fontSize: 10, color: 'var(--fs-ink-400)', margin: 0 }}>{product.category ?? t('Autre', 'Other')}{volumeLabel(product) ? ` · ${volumeLabel(product)}` : ''}</p>
      </div>
      {(product.discount ?? 0) > 0 && (
        <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', background: '#c0392b', borderRadius: 3, padding: '1px 5px' }}>-{product.discount}%</span>
      )}
      <span style={{ fontSize: 10, color: 'var(--fs-ink-300)', fontFamily: 'var(--fs-font-mono)' }}>×{product.stock}</span>
      <div style={{ textAlign: 'right' }}>
        {(product.discount ?? 0) > 0 && (
          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', textDecoration: 'line-through', fontFamily: 'var(--fs-font-mono)' }}>{product.price.toLocaleString(dateLocale())}</div>
        )}
        <span style={{ fontSize: 13, fontWeight: 700, color: (product.discount ?? 0) > 0 ? '#c0392b' : 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)' }}>{effectivePrice(product).toLocaleString(dateLocale())}</span>
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
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fs-ink-900)', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName(item.product.name)}
          </p>
          {item.product.localName && (
            <p style={{ fontSize: 11, color: '#999', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.product.localName}
            </p>
          )}
          <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: 0, fontFamily: 'var(--fs-font-mono)' }}>
            {item.product.price.toLocaleString(dateLocale())} × {item.quantity}
          </p>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)', flexShrink: 0 }}>
          {subtotal.toLocaleString(dateLocale())}
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
