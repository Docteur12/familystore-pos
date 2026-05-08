import { authHeaders } from './http';

export interface SessionRecord {
  _id:          string;
  cashierName:  string;
  cashierEmail: string;
  caisseName:   string;
  caisseCode:   string;
  dateDebut:    string;
  dateFin:      string | null;
  nbVentes:     number;
  totalEncaisse: number;
  closed:       boolean;
  createdAt:    string;
}

export async function openSession(): Promise<SessionRecord> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Impossible de créer la session');
  return res.json();
}

export async function closeSession(id: string): Promise<void> {
  await fetch(`/api/sessions/${id}/close`, {
    method: 'PATCH',
    headers: authHeaders(),
  }).catch(() => { /* silently ignore on logout */ });
}

export async function getSessions(params: {
  dateFrom?: string;
  dateTo?:   string;
  cashier?:  string;
  page?:     number;
  limit?:    number;
} = {}): Promise<{ data: SessionRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo)   qs.set('dateTo',   params.dateTo);
  if (params.cashier)  qs.set('cashier',  params.cashier);
  if (params.page !== undefined) qs.set('page',  String(params.page));
  if (params.limit)    qs.set('limit', String(params.limit));

  const res = await fetch(`/api/sessions?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement des sessions');
  return res.json();
}
