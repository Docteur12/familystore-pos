import { authHeaders } from './http';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  if (res.status === 401) throw new Error('Non authentifié');
  if (res.status === 403) throw new Error('Accès réservé au patron');
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}

export interface StatsToday {
  date:      string;
  totalCA:   number;
  prevCA:    number;
  nbVentes:  number;
  benefice:  number;
  marge:     number;
  minTicket: number;
  maxTicket: number;
  avgTicket: number;
}

export interface PeriodDay {
  date:      string;
  label:     string;
  totalCA:   number;
  nbVentes:  number;
  minTicket: number;
  maxTicket: number;
  avgTicket: number;
}

export interface ComparisonPeriod {
  ca: number; nb: number; min: number; max: number; avg: number;
}
export interface Comparisons {
  week:     ComparisonPeriod;
  prevWeek: ComparisonPeriod;
  month:    ComparisonPeriod;
  prevMonth: ComparisonPeriod;
  year:     ComparisonPeriod;
  prevYear: ComparisonPeriod;
}

export interface TopProduct {
  _id:          string;
  name:         string;
  category?:    string;
  unit:         string;
  totalQty:     number;
  totalRevenue: number;
}

export interface PaymentSlice {
  mode:  string;
  label: string;
  total: number;
  count: number;
  pct:   number;
}

export interface RecentSale {
  _id:           string;
  total:         number;
  paymentMethod: string;
  amountPaid:    number;
  change:        number;
  createdAt:     string;
  items:         Array<{ name: string; quantity: number; unitPrice: number }>;
}

// ── API functions ─────────────────────────────────────────────────────────────

type DateRange = { days?: number; dateFrom?: string; dateTo?: string };

function rangeQS(r: DateRange): string {
  if (r.dateFrom) {
    const qs = `dateFrom=${r.dateFrom}`;
    return r.dateTo ? `${qs}&dateTo=${r.dateTo}` : qs;
  }
  return `days=${r.days ?? 7}`;
}

export const getStatsToday       = () => get<StatsToday>('/api/sales/stats/today');
export const getStatsPeriod      = (days: number, range?: DateRange) => get<PeriodDay[]>(`/api/sales/stats/period?${rangeQS(range ?? { days })}`);
export const getTopProducts      = (range?: DateRange) => get<TopProduct[]>(`/api/sales/stats/top-products?${rangeQS(range ?? { days: 7 })}`);
export const getRecentSales      = () => get<RecentSale[]>('/api/sales/stats/recent');
export const getPaymentBreakdown = (range?: DateRange) => get<PaymentSlice[]>(`/api/sales/stats/payment?${rangeQS(range ?? { days: 7 })}`);
export const getComparisons      = () => get<Comparisons>('/api/sales/stats/comparisons');

// kept for backward compat
export const getStatsWeek = () => getStatsPeriod(7);

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
export interface CaissePayload {
  _id:   string;
  nom:   string;
  code:  string;
  pin:   string;
  ville: string;
}

export function getTokenPayload(): { sub: string; email: string; name: string; role: string; caisse?: CaissePayload | null } | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}
