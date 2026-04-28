import { get, set } from 'idb-keyval';
import { authHeaders } from '../api/http';
import type { Product } from '../api/products';

// ── Keys ──────────────────────────────────────────────────────────────────────

const KEY_PRODUCTS  = 'products';
const KEY_PENDING   = 'pending_sales';
const KEY_LAST_SYNC = 'last_sync_time';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingSale {
  id: string;
  items: { product: string; name: string; quantity: number; unitPrice: number }[];
  total: number;
  paymentMethod: string;
  amountPaid: number;
  createdAt: string;
}

// ── Product cache ─────────────────────────────────────────────────────────────

export async function cacheProducts(products: Product[]): Promise<void> {
  await set(KEY_PRODUCTS, products);
}

export async function getCachedProducts(): Promise<Product[]> {
  return (await get<Product[]>(KEY_PRODUCTS)) ?? [];
}

export async function decrementCachedStock(productId: string, quantity: number): Promise<void> {
  const products = await getCachedProducts();
  const updated = products.map(p =>
    p._id === productId ? { ...p, stock: Math.max(0, p.stock - quantity) } : p,
  );
  await set(KEY_PRODUCTS, updated);
}

// ── Pending sales queue ───────────────────────────────────────────────────────

export async function savePendingSale(
  sale: Omit<PendingSale, 'id' | 'createdAt'>,
): Promise<void> {
  const pending: PendingSale[] = (await get<PendingSale[]>(KEY_PENDING)) ?? [];
  pending.push({
    ...sale,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  });
  await set(KEY_PENDING, pending);
}

export async function getPendingSales(): Promise<PendingSale[]> {
  return (await get<PendingSale[]>(KEY_PENDING)) ?? [];
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export async function getLastSyncTime(): Promise<Date | null> {
  const ts = await get<number>(KEY_LAST_SYNC);
  return ts ? new Date(ts) : null;
}

export async function syncPendingSales(
  addToast: (msg: string, type: 'success' | 'error' | 'warning') => void,
): Promise<void> {
  if (!navigator.onLine) return;
  const pending = await getPendingSales();
  if (pending.length === 0) return;

  let synced = 0;
  const remaining: PendingSale[] = [];

  for (const sale of pending) {
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          items: sale.items,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          amountPaid: sale.amountPaid,
        }),
      });
      if (res.ok) {
        synced++;
      } else {
        remaining.push(sale);
      }
    } catch {
      remaining.push(sale);
    }
  }

  await set(KEY_PENDING, remaining);
  await set(KEY_LAST_SYNC, Date.now());

  if (synced > 0) {
    addToast(`${synced} vente(s) synchronisée(s) ✅`, 'success');
  }
  if (remaining.length > 0) {
    addToast(`${remaining.length} vente(s) non synchronisée(s)`, 'error');
  }
}
