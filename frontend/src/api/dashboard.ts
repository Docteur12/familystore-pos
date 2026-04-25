import { authHeaders } from './http';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  if (res.status === 401) throw new Error('Non authentifié');
  if (res.status === 403) throw new Error('Accès réservé au patron');
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}

export interface StatsToday {
  date:     string;
  totalCA:  number;
  nbVentes: number;
  benefice: number;
  marge:    number;
}

export interface WeekDay {
  date:     string;
  label:    string;
  totalCA:  number;
  nbVentes: number;
}

export interface TopProduct {
  _id:          string;
  name:         string;
  category?:    string;
  unit:         string;
  totalQty:     number;
  totalRevenue: number;
}

export const getStatsToday   = () => get<StatsToday>('/api/sales/stats/today');
export const getStatsWeek    = () => get<WeekDay[]>('/api/sales/stats/week');
export const getTopProducts  = () => get<TopProduct[]>('/api/sales/stats/top-products');

export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) throw new Error('Non authentifié');
  if (res.status === 403) throw new Error('Accès réservé au patron');
  if (!res.ok) throw new Error(`Erreur génération rapport (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

// Decode JWT payload (base64) — no verification, frontend only
export function getTokenPayload(): { sub: string; email: string; name: string; role: string } | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}
