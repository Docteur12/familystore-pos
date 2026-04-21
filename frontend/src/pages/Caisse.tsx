import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSale, getProductByBarcode, Product } from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS = [
  { value: 'cash',         label: 'Espèces',      icon: '💵' },
  { value: 'mtn_momo',     label: 'MTN MoMo',     icon: '📲' },
  { value: 'orange_money', label: 'Orange Money', icon: '🔶' },
  { value: 'card',         label: 'Carte',        icon: '💳' },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

const fmt = (n: number) => n.toLocaleString('fr-FR') + ' FCFA';

// ── Component ─────────────────────────────────────────────────────────────────

export default function Caisse() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { toasts, addToast, removeToast } = useToast();

  const [barcode, setBarcode]             = useState('');
  const [cart, setCart]                   = useState<CartItem[]>([]);
  const [scanError, setScanError]         = useState<string | null>(null);
  const [scanning, setScanning]           = useState(false);
  const [validating, setValidating]       = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  // ── Scan ──────────────────────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    const code = barcode.trim();
    if (!code) return;
    setScanError(null);
    setScanning(true);
    try {
      const product = await getProductByBarcode(code);
      setCart(prev => {
        const idx = prev.findIndex(i => i.product._id === product._id);
        if (idx !== -1) {
          return prev.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i);
        }
        return [...prev, { product, quantity: 1 }];
      });
      setBarcode('');
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Produit non trouvé');
    } finally {
      setScanning(false);
      focusInput();
    }
  }, [barcode]);

  // ── Validate sale ─────────────────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    if (cart.length === 0 || validating) return;
    const saleTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
    setValidating(true);
    try {
      const result = await createSale({
        items: cart.map(i => ({
          product:   i.product._id,
          quantity:  i.quantity,
          unitPrice: i.product.price,
        })),
        total: saleTotal,
        paymentMethod,
      });

      setCart([]);
      setPaymentMethod('cash');
      addToast(`Vente de ${fmt(saleTotal)} enregistrée avec succès !`, 'success');

      // Toasts d'alerte rouge pour chaque produit en stock bas
      for (const alert of result.alerts) {
        const msg = alert.stock === 0
          ? `Rupture de stock — ${alert.productName} (plus aucune unité)`
          : `Stock bas — ${alert.productName} : ${alert.stock} restant${alert.stock > 1 ? 's' : ''} (seuil : ${alert.alertThreshold})`;
        addToast(msg, 'warning');
      }
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement',
        'error',
      );
    } finally {
      setValidating(false);
      focusInput();
    }
  }, [cart, paymentMethod, validating, addToast]);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  const changeQty = (id: string, delta: number) =>
    setCart(prev =>
      prev
        .map(i => i.product._id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0),
    );

  const removeItem = (id: string) =>
    setCart(prev => prev.filter(i => i.product._id !== id));

  const clearCart = () => { setCart([]); focusInput(); };

  const total     = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

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
            Caisse
          </span>
        </div>
        <div className="flex items-center gap-4">
          {itemCount > 0 && (
            <span className="bg-gold text-bordeaux text-xs font-bold px-2.5 py-1 rounded-full">
              {itemCount} article{itemCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-cream/50 text-sm hidden md:block">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'short', day: 'numeric', month: 'short',
            })}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Scan zone */}
        <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl select-none">
              ⌕
            </div>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={barcode}
              onChange={e => { setBarcode(e.target.value); setScanError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              placeholder="Scanner ou saisir le code-barres..."
              disabled={scanning || validating}
              className={`w-full pl-11 pr-32 py-4 text-lg rounded-xl border-2 outline-none bg-white
                placeholder-gray-300 transition-colors
                ${scanError
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-bordeaux/25 focus:border-bordeaux'
                }`}
            />
            <button
              onClick={handleScan}
              disabled={scanning || validating || !barcode.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-bordeaux text-cream
                text-sm font-semibold px-4 py-2 rounded-lg hover:bg-bordeaux-dark
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {scanning ? '…' : 'Ajouter'}
            </button>
          </div>

          {scanError ? (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700
              rounded-xl px-4 py-3 text-sm font-medium">
              <span className="text-lg shrink-0">✕</span>
              <span>{scanError}</span>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              Scannez un article ou tapez son code-barres puis appuyez sur{' '}
              <kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-mono text-xs shadow-sm">
                Entrée
              </kbd>
            </p>
          )}

          <div className="md:hidden mt-2 text-sm text-gray-500">
            {cart.length === 0
              ? 'Aucun article dans le ticket.'
              : `${itemCount} article(s) — Total : ${fmt(total)}`}
          </div>
        </div>

        {/* RIGHT — Ticket */}
        <aside className="hidden md:flex w-[420px] flex-col bg-white border-l border-gray-100 shadow-2xl">

          <div className="bg-bordeaux/5 border-b border-bordeaux/15 px-5 py-3
            flex items-center justify-between shrink-0">
            <h2 className="font-bold text-bordeaux text-sm uppercase tracking-widest">
              Ticket de vente
            </h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                disabled={validating}
                className="text-xs text-red-400 hover:text-red-600 font-medium
                  transition-colors disabled:opacity-40"
              >
                Vider le ticket
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-300">
                <span className="text-4xl">🧾</span>
                <span className="text-sm">Aucun article scanné</span>
              </div>
            ) : (
              cart.map(item => (
                <CartRow
                  key={item.product._id}
                  item={item}
                  disabled={validating}
                  onIncrease={() => changeQty(item.product._id, +1)}
                  onDecrease={() => changeQty(item.product._id, -1)}
                  onRemove={() => removeItem(item.product._id)}
                />
              ))
            )}
          </div>

          <div className="border-t border-gray-100 px-5 pt-4 pb-5 space-y-4 shrink-0">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Total</p>
                <p className="text-xs text-gray-400">
                  {cart.length} ligne{cart.length > 1 ? 's' : ''} · {itemCount} article{itemCount > 1 ? 's' : ''}
                </p>
              </div>
              <span className="text-3xl font-black text-bordeaux leading-none">
                {fmt(total)}
              </span>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  onClick={() => setPaymentMethod(pm.value)}
                  disabled={validating}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm
                    font-medium transition-all disabled:opacity-60
                    ${paymentMethod === pm.value
                      ? 'bg-bordeaux text-cream border-bordeaux shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-bordeaux/40 hover:bg-cream'
                    }`}
                >
                  <span className="text-base">{pm.icon}</span>
                  <span>{pm.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleValidate}
              disabled={cart.length === 0 || validating}
              className="relative w-full py-4 bg-bordeaux text-cream font-black text-base
                rounded-xl border-2 border-gold tracking-widest uppercase
                hover:bg-bordeaux-dark transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            >
              {validating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-cream/40 border-t-cream
                    rounded-full animate-spin" />
                  Enregistrement…
                </span>
              ) : (
                'Valider la vente'
              )}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── CartRow ───────────────────────────────────────────────────────────────────

function CartRow({
  item, disabled, onIncrease, onDecrease, onRemove,
}: {
  item: CartItem;
  disabled: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const subtotal = item.product.price * item.quantity;

  return (
    <div className={`group flex items-center gap-3 bg-cream rounded-xl px-3 py-2.5
      hover:bg-cream-dark transition-colors ${disabled ? 'opacity-60' : ''}`}>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-800 truncate leading-tight">
          {item.product.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {item.product.price.toLocaleString('fr-FR')} FCFA / {item.product.unit}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onDecrease}
          disabled={disabled}
          className="w-6 h-6 rounded-full bg-white border border-bordeaux/20
            hover:bg-bordeaux hover:text-cream hover:border-bordeaux
            text-bordeaux font-bold text-sm flex items-center justify-center
            transition-colors shadow-sm disabled:pointer-events-none"
        >
          −
        </button>
        <span className="w-6 text-center font-bold text-sm text-gray-800">
          {item.quantity}
        </span>
        <button
          onClick={onIncrease}
          disabled={disabled}
          className="w-6 h-6 rounded-full bg-white border border-bordeaux/20
            hover:bg-bordeaux hover:text-cream hover:border-bordeaux
            text-bordeaux font-bold text-sm flex items-center justify-center
            transition-colors shadow-sm disabled:pointer-events-none"
        >
          +
        </button>
      </div>

      <span className="w-24 text-right font-bold text-sm text-bordeaux shrink-0">
        {subtotal.toLocaleString('fr-FR')}
      </span>

      <button
        onClick={onRemove}
        disabled={disabled}
        className="text-gray-200 hover:text-red-500 transition-colors text-xl
          leading-none shrink-0 ml-0.5 opacity-0 group-hover:opacity-100
          disabled:pointer-events-none"
        title="Supprimer"
      >
        ×
      </button>
    </div>
  );
}
