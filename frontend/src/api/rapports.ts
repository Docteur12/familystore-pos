import { authHeaders } from './http';

export interface JourData      { jour: number; ca: number; nbVentes: number; }
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
  prevCA:       number;
  parJour:      JourData[];
  parCategorie: CategorieData[];
  parCaissier:  CaissierData[];
  topProduits:  ProduitData[];
  heatmap:      number[][];   // [7 jours][24 heures] — valeurs normalisées 0-1
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
