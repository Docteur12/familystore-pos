import { authHeaders } from './http';

export interface SaleItem {
  product:   string | { _id: string; name: string; barcode?: string; unit?: string; costPrice?: number };
  name:      string;
  quantity:  number;
  unitPrice: number;
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
}

export const PM_LABELS: Record<string, string> = {
  cash:         'Espèces',
  mtn_momo:     'MTN MoMo',
  orange_money:  'Orange Money',
  card:          'Carte bancaire',
  mobile_money:  'Mobile Money',
  credit:        'Crédit',
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
  if (!res.ok) throw new Error('Erreur chargement des ventes');
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
  if (!res.ok) throw new Error('Erreur chargement des articles divers');
  return res.json();
}

export async function deleteSale(id: string): Promise<void> {
  const res = await fetch(`/api/sales/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (res.status === 403) throw new Error('Suppression réservée à l\'administrateur');
  if (!res.ok) throw new Error('Erreur suppression de la vente');
}
