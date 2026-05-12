import { authHeaders } from './http';

export interface JourData      { jour: number; ca: number; nbVentes: number; label?: string; }
export interface CategorieData { categorie: string; ca: number; pct: number; quantite: number; }
export interface CaissierData  { nom: string; nbVentes: number; ca: number; panierMoyen: number; }
export interface ProduitData   { nom: string; ca: number; quantite: number; }

export interface AnalyseMonth {
  year:         number;
  month:        number;
  label:        string;
  ca:           number;
  coutAchats:   number;
  margesBrute:  number;
  beneficeNet:  number;
  depenses:     number;
  nbVentes:     number;
  panierMoyen:  number;
  minTicket:    number;
  maxTicket:    number;
  prevCA:       number;
  parJour:      JourData[];
  parCategorie: CategorieData[];
  parCaissier:  CaissierData[];
  topProduits:  ProduitData[];
  heatmap:      number[][];
}

export interface ProductStat {
  name:           string;
  qtySold:        number;
  caGenere:       number;
  nbTransactions: number;
  prixMoyenVente: number;
}

export async function getByProduct(params?: { dateFrom?: string; dateTo?: string }): Promise<ProductStat[]> {
  const qs = new URLSearchParams();
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo)   qs.set('dateTo',   params.dateTo);
  const res = await fetch(`/api/sales/stats/by-product?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement journal produits');
  return res.json();
}

export interface AnalyseWeek extends AnalyseMonth {
  week:      number;
  dateDebut: string;
  dateFin:   string;
}

export async function getAnalyseWeek(year: number, week: number): Promise<AnalyseWeek> {
  const res = await fetch(`/api/reports/analyse-week?year=${year}&week=${week}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement analyse semaine');
  return res.json();
}

export async function getAnalyseMonth(year: number, month: number): Promise<AnalyseMonth> {
  const res = await fetch(`/api/reports/analyse?year=${year}&month=${month}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Erreur chargement analyse');
  return res.json();
}

export async function downloadReport(
  type: 'pdf' | 'excel',
  year: number,
  month: number,
): Promise<void> {
  const url = type === 'pdf'
    ? `/api/reports/monthly/pdf?year=${year}&month=${month}`
    : `/api/reports/monthly/excel?year=${year}&month=${month}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erreur export ${type}`);
  const blob    = await res.blob();
  const objUrl  = URL.createObjectURL(blob);
  const slug    = `${year}-${String(month).padStart(2, '0')}`;
  const a       = document.createElement('a');
  a.href        = objUrl;
  a.download    = `rapport-${slug}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
  a.click();
  URL.revokeObjectURL(objUrl);
}
