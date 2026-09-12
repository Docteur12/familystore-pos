/**
 * API du profil Snack-bar (module `comptoir`) — conditionnements (casier,
 * consigne), réserve, retours de vide, rapport des consignes.
 *
 * Préfixe serveur : `/api/comptoir` (`backend/src/comptoir/`). Les règles
 * pures du panier vivent dans `utils/comptoir-panier.ts`.
 */
import { authHeaders } from './http';
import { t } from '../i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConditionnementSnack {
  _id?:                string;
  product:             string;
  bouteillesParCasier: number;
  consigne:            number;   // F par bouteille, 0 = pas de consigne
  videsEnReserve:      number;
}

export interface LigneReserve {
  productId:           string;
  nomProduit:          string;
  unit:                string;
  category:            string;
  stock:               number;
  bouteillesParCasier: number;
  casiersPleins:       number;
  bouteillesSeules:    number;
  consigne:            number;
  videsEnReserve:      number;
  casiersVidesARendre: number;
  videsSeuls:          number;
  alertThreshold:      number;
}

export interface ReceptionCasier {
  _id:                 string;
  product:             string;
  nomProduit:          string;
  casiers:             number;
  bouteillesParCasier: number;
  bouteilles:          number;
  videsRendus:         number;
  note:                string;
  auteurNom:           string;
  createdAt:           string;
}

export interface RapportConsignes {
  date:       string;
  encaissees: { quantite: number; montant: number };
  rendues:    { quantite: number; montant: number };
  solde:      number;
  parProduit: { productId: string; nomProduit: string; encaissees: number; rendues: number; montantEncaisse: number; montantRendu: number }[];
}

// ── Appels HTTP ───────────────────────────────────────────────────────────────

async function lireErreur(res: Response, defaut: string): Promise<never> {
  const corps = await res.json().catch(() => null);
  const m = corps?.message;
  throw new Error((Array.isArray(m) ? m[0] : m) || defaut);
}

export async function getConditionnements(): Promise<ConditionnementSnack[]> {
  const res = await fetch('/api/comptoir/conditionnements', { headers: authHeaders() });
  if (!res.ok) return lireErreur(res, t('Erreur chargement des conditionnements', 'Failed to load packagings'));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function definirConditionnement(
  productId: string, corps: { bouteillesParCasier: number; consigne: number },
): Promise<ConditionnementSnack> {
  const res = await fetch(`/api/comptoir/conditionnements/${productId}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(corps),
  });
  if (!res.ok) return lireErreur(res, t('Erreur enregistrement du conditionnement', 'Failed to save packaging'));
  return res.json();
}

export async function getReserve(): Promise<LigneReserve[]> {
  const res = await fetch('/api/comptoir/reserve', { headers: authHeaders() });
  if (!res.ok) return lireErreur(res, t('Erreur chargement de la réserve', 'Failed to load stockroom'));
  return res.json();
}

export async function getReceptionsCasiers(limit = 50): Promise<ReceptionCasier[]> {
  const res = await fetch(`/api/comptoir/reserve/receptions?limit=${limit}`, { headers: authHeaders() });
  if (!res.ok) return lireErreur(res, t('Erreur chargement des réceptions', 'Failed to load deliveries'));
  return res.json();
}

export async function receptionnerCasiers(corps: {
  productId: string; casiers: number; videsRendus?: number; note?: string; idempotencyKey?: string;
}): Promise<{ rejeu: boolean; stock?: number; videsEnReserve?: number }> {
  const res = await fetch('/api/comptoir/reserve/receptions', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(corps),
  });
  if (!res.ok) return lireErreur(res, t('Erreur enregistrement de la réception', 'Failed to record delivery'));
  return res.json();
}

export async function declarerCasse(corps: {
  productId: string; bouteilles: number; note?: string; idempotencyKey?: string;
}): Promise<{ rejeu: boolean; stock?: number }> {
  const res = await fetch('/api/comptoir/reserve/casse', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(corps),
  });
  if (!res.ok) return lireErreur(res, t('Erreur enregistrement de la casse', 'Failed to record breakage'));
  return res.json();
}

export async function retournerVides(corps: {
  productId: string; quantite: number; idempotencyKey?: string;
}): Promise<{ montant: number; rejeu: boolean; videsEnReserve?: number }> {
  const res = await fetch('/api/comptoir/consignes/retours', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(corps),
  });
  if (res.status === 403) throw new Error(t('Retour de vide réservé au comptoir', 'Empties return is reserved to counter staff'));
  if (!res.ok) return lireErreur(res, t('Erreur enregistrement du retour de vide', 'Failed to record empties return'));
  return res.json();
}

export async function getConsignesDuJour(date?: string): Promise<RapportConsignes> {
  const res = await fetch(`/api/comptoir/consignes/jour${date ? `?date=${date}` : ''}`, { headers: authHeaders() });
  if (!res.ok) return lireErreur(res, t('Erreur chargement des consignes', 'Failed to load deposits'));
  return res.json();
}
