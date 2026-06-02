import { authHeaders } from './http';

export interface AuditLogEntry {
  _id:       string;
  type:      string;  // vente | connexion | creation | modification | suppression
  module:    string;  // auth | produits | ventes | stock | caisses | paramètres | utilisateurs
  actorName: string;
  actorRole: string;
  detail:    string;
  meta:      Record<string, any>;
  createdAt: string;
}

export interface AuditStats {
  vente:        number;
  connexion:    number;
  creation:     number;
  modification: number;
  suppression:  number;
  total:        number;
}

export async function getAuditLogs(params?: {
  type?:   string;
  module?: string;
  search?: string;
  limit?:  number;
}): Promise<AuditLogEntry[]> {
  const q = new URLSearchParams();
  if (params?.type)   q.set('type',   params.type);
  if (params?.module) q.set('module', params.module);
  if (params?.search) q.set('search', params.search);
  if (params?.limit)  q.set('limit',  String(params.limit));
  const url = `/api/audit${q.toString() ? `?${q}` : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement audit');
  return res.json();
}

export async function getAuditStats(): Promise<AuditStats> {
  const res = await fetch('/api/audit/stats', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur stats audit');
  return res.json();
}

// Actions admin sur la caisse (ex. suppression de vente) — accessible au caissier.
export async function getCaisseAudit(): Promise<AuditLogEntry[]> {
  const res = await fetch('/api/audit/caisse', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement audit caisse');
  return res.json();
}

// Trace le passage du patron dans un autre espace (fire-and-forget).
export function logAccesEspace(espace: string): void {
  try {
    fetch('/api/audit/acces', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ espace }),
    }).catch(() => {});
  } catch { /* ne bloque jamais la navigation */ }
}
