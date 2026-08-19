import { authHeaders } from './http';
import { t } from '../i18n';

export interface SessionRecord {
  _id:           string;
  cashierName:   string;
  cashierEmail:  string;
  caisseName:    string;
  caisseCode:    string;
  dateDebut:     string;
  dateFin:       string | null;
  nbVentes:      number;
  totalEncaisse: number;
  closed:        boolean;
  createdAt:     string;
  liveCount?:    number;
}

export async function getActiveSession(): Promise<SessionRecord | null> {
  const res = await fetch('/api/sessions/active', { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(t('Erreur chargement session active', 'Failed to load active session'));
  return res.json();
}

export async function openSession(): Promise<SessionRecord> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(t('Impossible de créer la session', 'Unable to create session'));
  return res.json();
}

export async function closeSession(id: string): Promise<void> {
  await fetch(`/api/sessions/${id}/close`, {
    method: 'PATCH',
    headers: authHeaders(),
  }).catch(() => { /* silently ignore on logout */ });
}

// Correction unique de l'historique (patron) : recale les durées gonflées.
export async function corrigerDureesSessions(): Promise<{ corrected: number }> {
  const res = await fetch('/api/sessions/corriger-durees', {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(t('Erreur lors de la correction des durées', 'Failed to fix session durations'));
  return res.json();
}

export async function forceCloseSession(id: string): Promise<SessionRecord | null> {
  const res = await fetch(`/api/sessions/${id}/close`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(t('Erreur lors de la fermeture de la session', 'Failed to close session'));
  return res.json();
}

export async function getSessions(params: {
  dateFrom?: string;
  dateTo?:   string;
  cashier?:  string;
  page?:     number;
  limit?:    number;
  activeOnly?: boolean;
} = {}): Promise<{ data: SessionRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.dateFrom)  qs.set('dateFrom', params.dateFrom);
  if (params.dateTo)    qs.set('dateTo',   params.dateTo);
  if (params.cashier)   qs.set('cashier',  params.cashier);
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.limit)     qs.set('limit', String(params.limit));
  if (params.activeOnly) qs.set('active', 'true');

  const res = await fetch(`/api/sessions?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement des sessions', 'Failed to load sessions'));
  return res.json();
}
