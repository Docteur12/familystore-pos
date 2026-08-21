import { authHeaders } from './http';
import { t } from '../i18n';

export interface EcartRecord {
  _id:            string;
  nomProduit:     string;
  stockSysteme:   number;
  quantiteVendue: number;
  ecart:          number;
  caissiereName:  string;
  caissiereEmail: string;
  justification:  string;
  statut:         'en_attente' | 'resolu';
  dateResolu:     string | null;
  createdAt:      string;
}

export async function getEcarts(params?: { statut?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.statut) qs.set('statut', params.statut);
  if (params?.page)   qs.set('page',   String(params.page));
  if (params?.limit)  qs.set('limit',  String(params.limit));
  const res = await fetch(`/api/ecarts?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement écarts', 'Failed to load discrepancies'));
  return res.json() as Promise<{ data: EcartRecord[]; total: number }>;
}

export async function getEcartsCount(): Promise<number> {
  const res = await fetch('/api/ecarts/count', { headers: authHeaders() });
  if (!res.ok) return 0;
  const { count } = await res.json();
  return count;
}

export async function getEcartsStats() {
  const res = await fetch('/api/ecarts/stats', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur stats écarts', 'Failed to load discrepancy stats'));
  return res.json();
}

export async function resoudreEcart(id: string): Promise<EcartRecord> {
  const res = await fetch(`/api/ecarts/${id}/resoudre`, {
    method: 'PATCH', headers: authHeaders(),
  });
  if (!res.ok) throw new Error(t('Erreur résolution écart', 'Failed to resolve discrepancy'));
  return res.json();
}
