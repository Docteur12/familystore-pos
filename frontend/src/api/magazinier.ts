import { authHeaders } from './http';
import { t } from '../i18n';

export interface DemandeStock {
  _id: string;
  produit: { _id: string; name: string; unit: string; stock: number; stockMagazin?: number };
  quantiteDemandee: number;
  demandePar: { _id: string; name: string };
  statut: 'en_attente' | 'envoyé' | 'reçu' | 'annulé';
  type?: 'demande' | 'envoi' | 'retour';
  createdAt: string;
  dateEnvoi?: string;
}

export interface ReceptionItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface ReceptionRecord {
  _id: string;
  fournisseur: string;
  items: ReceptionItem[];
  note: string;
  createdAt: string;
}

export async function createReception(data: {
  fournisseur: string;
  items: { productId: string; quantity: number }[];
  note?: string;
  idempotencyKey?: string; // rejeu sans doublon (synchronisation hors-ligne)
}): Promise<ReceptionRecord> {
  const res = await fetch('/api/magazinier/receptions', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur réception', 'Failed to record delivery'));
  return res.json();
}

export async function getDemandes(statut?: string): Promise<DemandeStock[]> {
  const url = statut ? `/api/magazinier/demandes?statut=${encodeURIComponent(statut)}` : '/api/magazinier/demandes';
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement demandes', 'Failed to load requests'));
  return res.json();
}

export async function marquerRecu(demandeId: string): Promise<DemandeStock> {
  const res = await fetch(`/api/magazinier/demandes/${demandeId}/recevoir`, {
    method: 'PATCH', headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur', 'Error'));
  return res.json();
}

// Annule un envoi en transit — les quantités retournent dans le stock entrepôt
export async function annulerEnvoi(demandeId: string): Promise<DemandeStock> {
  const res = await fetch(`/api/magazinier/demandes/${demandeId}/annuler`, {
    method: 'PATCH', headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur', 'Error'));
  return res.json();
}

// Retour boutique → entrepôt (gestionnaire) : stock caisse −N, stock entrepôt +N
export async function retourEntrepot(data: { produitId: string; quantite: number }): Promise<{ ok: boolean; stock: number; stockMagazin: number }> {
  const res = await fetch('/api/magazinier/retour-entrepot', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur retour entrepôt', 'Failed to return to warehouse'));
  return res.json();
}

export async function createDemande(data: {
  produitId: string;
  quantiteDemandee: number;
}): Promise<DemandeStock> {
  const res = await fetch('/api/magazinier/demandes', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur création demande', 'Failed to create request'));
  return res.json();
}

export async function marquerEnvoye(demandeId: string): Promise<DemandeStock> {
  const res = await fetch(`/api/magazinier/demandes/${demandeId}/envoyer`, {
    method: 'PATCH', headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur', 'Error'));
  return res.json();
}

export interface ReceptionFull extends ReceptionRecord {
  creePar: { _id: string; name: string; role: string } | null;
  createdAt: string;
}

export async function getAllReceptions(userId?: string): Promise<ReceptionFull[]> {
  const url = userId ? `/api/magazinier/receptions?userId=${userId}` : '/api/magazinier/receptions';
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement réceptions', 'Failed to load deliveries'));
  return res.json();
}

export async function getHistorique(): Promise<{
  receptions: ReceptionRecord[];
  envois: DemandeStock[];
}> {
  const res = await fetch('/api/magazinier/historique', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement historique', 'Failed to load history'));
  return res.json();
}

export async function ajusterStockEntrepot(productId: string, stockMagazin: number): Promise<void> {
  const res = await fetch(`/api/magazinier/produits/${productId}/stock-entrepot`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stockMagazin }),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur ajustement stock', 'Failed to adjust stock'));
}

export async function resetEntrepot(): Promise<void> {
  const res = await fetch('/api/magazinier/reset-entrepot', {
    method: 'POST', headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur réinitialisation', 'Failed to reset'));
}

export async function createEnvoi(
  items: { produitId: string; quantite: number }[],
): Promise<DemandeStock[]> {
  const res = await fetch('/api/magazinier/envois', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? t('Erreur envoi', 'Failed to send'));
  return res.json();
}
