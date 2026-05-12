export interface Product {
  _id:            string;
  name:           string;
  barcode?:       string;
  price:          number;
  costPrice:      number;
  stock:          number;
  alertThreshold: number;
  category?:      string;
  unit:           string;
  discount?:      number;
}

export function effectivePrice(p: Product): number {
  if (!p.discount || p.discount <= 0) return p.price;
  return Math.round(p.price * (1 - p.discount / 100));
}

import { authHeaders } from './http';

export async function getProductByBarcode(barcode: string): Promise<Product> {
  const res = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) throw new Error('Produit introuvable pour ce code-barres');
  if (res.status === 401) throw new Error('Non authentifié — veuillez vous connecter');
  if (!res.ok) throw new Error('Erreur serveur');
  return res.json();
}

export async function getAllProducts(): Promise<Product[]> {
  const res = await fetch('/api/products', { headers: authHeaders() });
  if (res.status === 401) throw new Error('Non authentifié');
  if (!res.ok) throw new Error('Erreur chargement produits');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export interface SalePayload {
  items: Array<{ product: string; name: string; quantity: number; unitPrice: number }>;
  total:         number;
  paymentMethod: string;
  amountPaid:    number;
  sessionId?:    string;
}

export interface StockAlert {
  alert: true;
  productId: string;
  productName: string;
  stock: number;
  alertThreshold: number;
}

export interface SaleResponse {
  sale:   { _id: string; total: number; paymentMethod: string; amountPaid: number; change: number; createdAt: string };
  change: number;
  alerts: StockAlert[];
}

// Classification des types d'erreurs réseau/serveur
export type SaleErrorKind = 'auth' | 'stock' | 'timeout' | 'server_sleep' | 'network' | 'unknown';

export class SaleError extends Error {
  constructor(message: string, public readonly kind: SaleErrorKind) {
    super(message);
    this.name = 'SaleError';
  }
}

export async function createSale(payload: SalePayload): Promise<SaleResponse> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch('/api/sales', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timerId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new SaleError('Connexion lente — délai dépassé', 'timeout');
    }
    throw new SaleError('Erreur réseau — vérifiez votre connexion', 'network');
  }
  clearTimeout(timerId);

  if (res.status === 401) throw new SaleError('Non authentifié — veuillez vous connecter', 'auth');
  if (res.status === 400 || res.status === 422) {
    const body = await res.json().catch(() => ({}));
    const msg  = (body?.message as string) ?? 'Stock insuffisant pour ce produit';
    throw new SaleError(msg.includes('stock') || msg.includes('Stock') ? msg : 'Stock insuffisant pour ce produit', 'stock');
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new SaleError('Serveur en démarrage — patienter 30s puis réessayer', 'server_sleep');
  }
  if (!res.ok) throw new SaleError('Erreur serveur lors de l\'enregistrement', 'unknown');
  return res.json();
}

export interface ProductPayload {
  name:           string;
  barcode?:       string;
  price:          number;
  costPrice:      number;
  stock:          number;
  alertThreshold: number;
  category?:      string;
  unit:           string;
  discount?:      number;
}

export async function createProduct(data: ProductPayload): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 401) throw new Error('Non authentifié');
  if (res.status === 403) throw new Error('Accès réservé au patron');
  if (!res.ok) throw new Error('Erreur création produit');
  return res.json();
}

export async function updateProduct(id: string, data: Partial<ProductPayload>): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 401) throw new Error('Non authentifié');
  if (res.status === 403) throw new Error('Accès réservé au patron');
  if (!res.ok) throw new Error('Erreur modification produit');
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 401) throw new Error('Non authentifié');
  if (res.status === 403) throw new Error('Accès réservé au patron');
  if (!res.ok) throw new Error('Erreur suppression produit');
}

export async function addStock(id: string, quantity: number): Promise<Product> {
  const res = await fetch(`/api/products/${id}/stock/add`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ quantity }),
  });
  if (res.status === 401) throw new Error('Non authentifié — veuillez vous connecter');
  if (!res.ok) throw new Error('Erreur lors de l\'ajout de stock');
  return res.json();
}
