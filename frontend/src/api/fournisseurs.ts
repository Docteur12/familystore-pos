import { authHeaders } from './http';

export interface FournisseurRecord {
  _id:                string;
  name:               string;
  contact:            string;
  phone:              string;
  email:              string;
  adresse:            string;
  conditionsPaiement: 'comptant' | '30j' | '60j' | '';
  remise:             string;
  note:               number;
  categories:         string[];
}

export type FournisseurInput = Omit<FournisseurRecord, '_id'>;

export async function getFournisseurs(): Promise<FournisseurRecord[]> {
  const res = await fetch('/api/fournisseurs', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement fournisseurs');
  return res.json();
}

export async function createFournisseur(data: FournisseurInput): Promise<FournisseurRecord> {
  const res = await fetch('/api/fournisseurs', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur création fournisseur');
  return res.json();
}

export async function updateFournisseur(id: string, data: Partial<FournisseurInput>): Promise<FournisseurRecord> {
  const res = await fetch(`/api/fournisseurs/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur modification fournisseur');
  return res.json();
}

export async function deleteFournisseur(id: string): Promise<void> {
  const res = await fetch(`/api/fournisseurs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Erreur suppression fournisseur');
}

// ── Évaluation des fournisseurs (vendu / à verser / versé / dette) ─────────────

export type PeriodeEval = 'semaine' | 'mois' | 'trimestre' | 'annee' | 'tout';

export interface EvalFournisseurRow {
  fournisseur: string;
  phone: string;
  contact: string;
  caVendu: number;         // chiffre d'affaires (prix de vente) sur la période
  coutVendu: number;       // valeur au prix d'achat = à verser pour la période
  qteVendue: number;
  versements: number;      // versés sur la période
  retours: number;         // valeur des retours sur la période (info)
  coutVenduTotal: number;
  versementsTotal: number;
  dette: number;           // cumul : coût vendu total − versé total (négatif = avance)
}

export interface EvaluationFournisseurs {
  periode: string;
  rows: EvalFournisseurRow[];
  sansFournisseur: { caVendu: number; coutVendu: number; qteVendue: number } | null;
  totaux: { caVendu: number; coutVendu: number; versements: number; dette: number };
}

export async function getEvaluationFournisseurs(periode: PeriodeEval): Promise<EvaluationFournisseurs> {
  const res = await fetch(`/api/fournisseurs/evaluation?periode=${periode}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement évaluation');
  return res.json();
}

// ── Séries temporelles de ventes ───────────────────────────────────────────────

export type Granularite = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee';

export interface PointSerie { key: string; label: string; ca: number; qte: number }

export async function getSerieVentes(opts: { fournisseur?: string; productId?: string; granularite: Granularite }): Promise<PointSerie[]> {
  const p = new URLSearchParams();
  if (opts.fournisseur) p.set('fournisseur', opts.fournisseur);
  if (opts.productId) p.set('productId', opts.productId);
  p.set('granularite', opts.granularite);
  const res = await fetch(`/api/fournisseurs/serie-ventes?${p}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement série de ventes');
  return res.json();
}

// ── Évolution de la valeur du stock ────────────────────────────────────────────

export interface SnapshotStock {
  dateKey: string;
  achatBoutique: number; achatEntrepot: number;
  venteBoutique: number; venteEntrepot: number;
  qteBoutique: number; qteEntrepot: number;
}

export async function getStockEvolution(jours = 90): Promise<SnapshotStock[]> {
  const res = await fetch(`/api/fournisseurs/stock-evolution?jours=${jours}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement évolution du stock');
  return res.json();
}

// ── Versements ─────────────────────────────────────────────────────────────────

export interface VersementFournisseur {
  _id: string;
  fournisseur: string;
  montant: number;
  note: string;
  date: string;
  creePar?: { name: string; role: string } | string;
  createdAt: string;
}

export async function getVersementsFournisseur(fournisseur?: string): Promise<VersementFournisseur[]> {
  const res = await fetch(`/api/fournisseurs/versements${fournisseur ? `?fournisseur=${encodeURIComponent(fournisseur)}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement versements');
  return res.json();
}

export async function createVersementFournisseur(data: { fournisseur: string; montant: number; note?: string; date?: string }): Promise<VersementFournisseur> {
  const res = await fetch('/api/fournisseurs/versements', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Erreur enregistrement du versement');
  return res.json();
}

export async function deleteVersementFournisseur(id: string): Promise<void> {
  const res = await fetch(`/api/fournisseurs/versements/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Erreur suppression du versement');
}

// ── Retours aux fournisseurs ───────────────────────────────────────────────────

export interface RetourFournisseur {
  _id: string;
  fournisseur: string;
  lignes: { productId: string; productName: string; quantite: number; prixAchat: number; origine: 'boutique' | 'entrepot' }[];
  total: number;
  note: string;
  creePar?: { name: string; role: string } | string;
  createdAt: string;
}

export async function getRetoursFournisseur(fournisseur?: string): Promise<RetourFournisseur[]> {
  const res = await fetch(`/api/fournisseurs/retours${fournisseur ? `?fournisseur=${encodeURIComponent(fournisseur)}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement retours');
  return res.json();
}

export async function createRetourFournisseur(data: { fournisseur: string; note?: string; lignes: { productId: string; quantite: number; origine: 'boutique' | 'entrepot' }[] }): Promise<RetourFournisseur> {
  const res = await fetch('/api/fournisseurs/retours', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Erreur enregistrement du retour');
  return res.json();
}

export async function deleteRetourFournisseur(id: string): Promise<void> {
  const res = await fetch(`/api/fournisseurs/retours/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Erreur annulation du retour');
}
