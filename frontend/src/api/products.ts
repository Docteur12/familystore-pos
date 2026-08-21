export interface Product {
  _id:            string;
  name:           string;
  localName?:     string;
  barcode?:       string;
  price:          number;
  costPrice:      number;
  stock:          number;         // ← stock caisse (point de vente)
  stockMagazin?:       number;         // ← stock entrepôt magasinier (indépendant)
  stockMagazinAjuste?: boolean;        // ← true si dernière modif vient de l'admin
  alertThreshold: number;
  initialStock?:  number;
  category?:      string;
  subCategory?:   string;
  fournisseur?:   string;
  unit:           string;
  valeur?:        string;
  discount?:      number;
  expiryDate?:           string | null;
  magazinierThreshold?:  number;
  divers?:        boolean;   // article « divers » synthétique (non référencé)
  prixVerrouille?: boolean;  // prix fixé par le magasinier → non modifiable par le gestionnaire
  prixModifiePar?: string;
  prixModifieParRole?: string;
  prixModifieLe?: string | null;
}

export function effectivePrice(p: Product): number {
  if (!p.discount || p.discount <= 0) return p.price;
  return Math.round(p.price * (1 - p.discount / 100));
}

import { authHeaders } from './http';
import { t } from '../i18n';

export async function getProductByBarcode(barcode: string): Promise<Product> {
  const res = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) throw new Error(t('Produit introuvable pour ce code-barres', 'Product not found for this barcode'));
  if (res.status === 401) throw new Error(t('Non authentifié — veuillez vous connecter', 'Not authenticated — please sign in'));
  if (!res.ok) throw new Error(t('Erreur serveur', 'Server error'));
  return res.json();
}

export async function getAllProducts(): Promise<Product[]> {
  const res = await fetch('/api/products', { headers: authHeaders() });
  if (res.status === 401) throw new Error(t('Non authentifié', 'Not authenticated'));
  if (!res.ok) throw new Error(t('Erreur chargement produits', 'Failed to load products'));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export interface SalePayload {
  items: Array<{ product?: string; name: string; quantity: number; unitPrice: number; divers?: boolean }>;
  total:         number;
  subtotal?:     number; // avant réduction facture
  offrePct?:     number; // % réduction facture (offre fidélité)
  offreAmt?:     number; // montant déduit
  dateVente?:    string; // date réelle (ISO) — synchro hors-ligne
  paymentMethod: string;
  amountPaid:    number;
  sessionId?:    string;
  forceVente?:   boolean;
  ecarts?:       Array<{ produit: string; nomProduit: string; stockSysteme: number; quantiteVendue: number; ecart: number }>;
  idempotencyKey?: string;
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
      throw new SaleError(t('Connexion lente — délai dépassé', 'Slow connection — request timed out'), 'timeout');
    }
    throw new SaleError(t('Erreur réseau — vérifiez votre connexion', 'Network error — check your connection'), 'network');
  }
  clearTimeout(timerId);

  if (res.status === 401) throw new SaleError(t('Non authentifié — veuillez vous connecter', 'Not authenticated — please sign in'), 'auth');
  if (res.status === 400 || res.status === 422) {
    const body = await res.json().catch(() => ({}));
    const msg  = (body?.message as string) ?? t('Stock insuffisant pour ce produit', 'Insufficient stock for this product');
    throw new SaleError(msg.includes('stock') || msg.includes('Stock') ? msg : t('Stock insuffisant pour ce produit', 'Insufficient stock for this product'), 'stock');
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new SaleError(t('Serveur en démarrage — patienter 30s puis réessayer', 'Server starting up — wait 30s and try again'), 'server_sleep');
  }
  if (!res.ok) throw new SaleError(t('Erreur serveur lors de l\'enregistrement', 'Server error while saving'), 'unknown');
  return res.json();
}

export interface ProductPayload {
  name:           string;
  localName?:     string;
  barcode?:       string;
  price:          number;
  costPrice:      number;
  stock:          number;
  category?:      string;
  subCategory?:   string;
  fournisseur?:   string;
  unit:           string;
  valeur?:        string;
  discount?:      number;
  expiryDate?:    string | null;
  magazinierThreshold?:  number;
  prixVerrouille?: boolean;
}

export async function createProduct(data: ProductPayload): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 401) throw new Error(t('Non authentifié', 'Not authenticated'));
  if (res.status === 403) throw new Error(t('Accès non autorisé pour ce rôle', 'Access not allowed for this role'));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body?.message) ? body.message.join(' · ') : body?.message;
    throw new Error(msg || t('Erreur création produit', 'Failed to create product'));
  }
  return res.json();
}

export async function updateProduct(id: string, data: Partial<ProductPayload>): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 401) throw new Error(t('Non authentifié', 'Not authenticated'));
  if (res.status === 403) throw new Error(t('Accès réservé au patron', 'Owner access only'));
  if (!res.ok) throw new Error(t('Erreur modification produit', 'Failed to update product'));
  return res.json();
}

// Fixe les prix d'un produit (magasinier/gestionnaire/patron) et les verrouille.
export async function setProductPrix(id: string, price: number, costPrice: number): Promise<Product> {
  const res = await fetch(`/api/products/${id}/prix`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ price, costPrice }),
  });
  if (res.status === 403) throw new Error(t('Accès non autorisé pour ce rôle', 'Access not allowed for this role'));
  if (!res.ok) throw new Error(t('Erreur mise à jour du prix', 'Failed to update price'));
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 401) throw new Error(t('Non authentifié', 'Not authenticated'));
  if (res.status === 403) throw new Error(t('Accès non autorisé pour ce rôle', 'Access not allowed for this role'));
  if (!res.ok) throw new Error(t('Erreur suppression produit', 'Failed to delete product'));
}

export async function addStock(id: string, quantity: number): Promise<Product> {
  const res = await fetch(`/api/products/${id}/stock/add`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ quantity }),
  });
  if (res.status === 401) throw new Error(t('Non authentifié — veuillez vous connecter', 'Not authenticated — please sign in'));
  if (!res.ok) throw new Error(t('Erreur lors de l\'ajout de stock', 'Failed to add stock'));
  return res.json();
}
