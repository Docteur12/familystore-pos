export interface Product {
  _id: string;
  name: string;
  barcode?: string;
  price: number;
  costPrice: number;
  stock: number;
  alertThreshold: number;
  category?: string;
  unit: string;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token') ?? '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

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
  if (!res.ok) throw new Error('Erreur chargement produits');
  return res.json();
}

export interface SalePayload {
  items: Array<{ product: string; quantity: number; unitPrice: number }>;
  total: number;
  paymentMethod: string;
}

export interface StockAlert {
  alert: true;
  productId: string;
  productName: string;
  stock: number;
  alertThreshold: number;
}

export interface SaleResponse {
  sale: { _id: string; total: number; paymentMethod: string; createdAt: string };
  alerts: StockAlert[];
}

export async function createSale(payload: SalePayload): Promise<SaleResponse> {
  const res = await fetch('/api/sales', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error('Non authentifié — veuillez vous connecter');
  if (!res.ok) throw new Error('Erreur lors de l\'enregistrement de la vente');
  return res.json();
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
