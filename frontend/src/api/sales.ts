import { authHeaders } from './http';
import { t } from '../i18n';

export interface SaleItem {
  product:   string | { _id: string; name: string; barcode?: string; unit?: string; costPrice?: number };
  name:      string;
  quantity:  number;
  unitPrice: number;
  divers?:   boolean;
}

/** Correction d'une vente par le patron : l'état d'avant est conservé. */
export interface ModificationVente {
  date:         string;
  parNom:       string;
  parEmail:     string;
  motif:        string;
  ancienTotal:  number;
  nouveauTotal: number;
  anciensItems: { name: string; quantity: number; unitPrice: number }[];
}

export interface Sale {
  _id:           string;
  items:         SaleItem[];
  total:         number;
  subtotal?:     number; // avant réduction facture
  offrePct?:     number; // % réduction facture appliquée
  offreAmt?:     number; // montant déduit
  dateVente?:    string; // date réelle de la vente (synchro hors-ligne)
  syncOffline?:  boolean;
  paymentMethod: string;
  amountPaid:    number;
  change:        number;
  createdAt:     string;
  cashierName?:  string;
  cashierEmail?: string;
  caisseName?:   string;
  sessionId?:    string;
  modifications?: ModificationVente[];
}

export const PM_LABELS: Record<string, string> = {
  cash:         t('Espèces', 'Cash'),
  mtn_momo:     'MTN MoMo',
  orange_money:  'Orange Money',
  card:          t('Carte bancaire', 'Bank card'),
  mobile_money:  'Mobile Money',
  credit:        t('Crédit', 'Credit'),
};

export async function getSales(params?: {
  dateFrom?: string;
  dateTo?:   string;
}): Promise<Sale[]> {
  const q = new URLSearchParams();
  if (params?.dateFrom) q.set('dateFrom', params.dateFrom);
  if (params?.dateTo)   q.set('dateTo',   params.dateTo);
  const url = `/api/sales${q.toString() ? `?${q}` : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement des ventes', 'Failed to load sales'));
  return res.json();
}

// Articles « divers » (non référencés) vendus en caisse, à régulariser.
export interface DiversSaleRow {
  saleId:      string;
  name:        string;
  unitPrice:   number;
  quantity:    number;
  total:       number;
  cashierName: string;
  caisseName:  string;
  createdAt:   string;
}

export async function getDiversSales(): Promise<DiversSaleRow[]> {
  const res = await fetch('/api/sales/divers', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement des articles divers', 'Failed to load miscellaneous items'));
  return res.json();
}

/** Le motif est obligatoire côté serveur : une suppression de vente doit être justifiée. */
export async function deleteSale(id: string, motif: string): Promise<void> {
  const res = await fetch(`/api/sales/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ motif }),
  });
  if (res.status === 403) throw new Error(t('Suppression réservée à l\'administrateur', 'Only the administrator can delete'));
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(
      (Array.isArray(msg?.message) ? msg.message[0] : msg?.message)
      || t('Erreur suppression de la vente', 'Failed to delete sale'),
    );
  }
}

export interface ModifierVentePayload {
  items: { product?: string; divers?: boolean; name: string; quantity: number; unitPrice: number }[];
  offrePct?:      number;
  paymentMethod?: string;
  amountPaid?:    number;
  motif:          string;
}

/**
 * Correction d'une vente déjà encaissée (le client revient avec son ticket).
 * Les totaux ne sont pas envoyés : le serveur les recalcule à partir des lignes.
 */
export async function modifierVente(
  id: string,
  payload: ModifierVentePayload,
): Promise<{ sale: Sale; ancienTotal: number; nouveauTotal: number; ref: string }> {
  const res = await fetch(`/api/sales/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (res.status === 403) throw new Error(t('Correction réservée à l\'administrateur', 'Only the administrator can correct a sale'));
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(
      (Array.isArray(msg?.message) ? msg.message[0] : msg?.message)
      || t('Erreur lors de la correction de la vente', 'Failed to correct the sale'),
    );
  }
  return res.json();
}
