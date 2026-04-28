import { authHeaders } from './http';

export interface DemandeStock {
  _id: string;
  produit: { _id: string; name: string; unit: string; stock: number };
  quantiteDemandee: number;
  demandePar: { _id: string; name: string };
  statut: 'en_attente' | 'envoyé' | 'reçu';
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
}): Promise<ReceptionRecord> {
  const res = await fetch('/api/magazinier/receptions', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur réception');
  return res.json();
}

export async function getDemandes(): Promise<DemandeStock[]> {
  const res = await fetch('/api/magazinier/demandes', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement demandes');
  return res.json();
}

export async function createDemande(data: {
  produitId: string;
  quantiteDemandee: number;
}): Promise<DemandeStock> {
  const res = await fetch('/api/magazinier/demandes', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur création demande');
  return res.json();
}

export async function marquerEnvoye(demandeId: string): Promise<DemandeStock> {
  const res = await fetch(`/api/magazinier/demandes/${demandeId}/envoyer`, {
    method: 'PATCH', headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
  return res.json();
}

export async function getHistorique(): Promise<{
  receptions: ReceptionRecord[];
  envois: DemandeStock[];
}> {
  const res = await fetch('/api/magazinier/historique', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement historique');
  return res.json();
}
