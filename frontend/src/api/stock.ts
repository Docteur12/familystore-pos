// API du module Stock (POST /api/stock/add — avec traçabilité mouvement)

import { authHeaders } from './http';

export interface StockAddResult {
  product: {
    _id: string; name: string; stock: number;
    alertThreshold: number; unit: string;
  };
  newStock: number;
}

/**
 * Ajoute `quantity` unités au stock du produit.
 * Crée automatiquement un mouvement IN/restock en base.
 */
export interface StockMovement {
  _id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  reason: 'restock' | 'sale' | 'adjustment';
  note?: string;
  createdAt: string;
}

export async function getMovements(productId: string): Promise<StockMovement[]> {
  const res = await fetch(`/api/stock/movements?productId=${productId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function addStockWithMovement(
  productId: string,
  quantity: number,
  note?: string,
  idempotencyKey?: string, // rejeu sans doublon (synchronisation hors-ligne)
): Promise<StockAddResult> {
  const res = await fetch('/api/stock/add', {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ productId, quantity, note, idempotencyKey }),
  });
  if (res.status === 401) throw new Error('Non authentifié');
  if (res.status === 403) throw new Error('Accès refusé');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Erreur ajout stock');
  }
  return res.json();
}
