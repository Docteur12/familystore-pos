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
