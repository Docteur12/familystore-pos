import { authHeaders } from './http';

export interface DemandeStock {
  _id: string;
  produit: { _id: string; name: string; unit: string; stock: number; stockMagazin?: number };
  quantiteDemandee: number;
  demandePar: { _id: string; name: string };
  statut: 'en_attente' | 'envoyé' | 'reçu';
  type?: 'demande' | 'envoi';
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

export async function getDemandes(statut?: string): Promise<DemandeStock[]> {
  const url = statut ? `/api/magazinier/demandes?statut=${encodeURIComponent(statut)}` : '/api/magazinier/demandes';
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement demandes');
  return res.json();
}

export async function marquerRecu(demandeId: string): Promise<DemandeStock> {
  const res = await fetch(`/api/magazinier/demandes/${demandeId}/recevoir`, {
    method: 'PATCH', headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
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

export interface ReceptionFull extends ReceptionRecord {
  creePar: { _id: string; name: string; role: string } | null;
  createdAt: string;
}

export async function getAllReceptions(userId?: string): Promise<ReceptionFull[]> {
  const url = userId ? `/api/magazinier/receptions?userId=${userId}` : '/api/magazinier/receptions';
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement réceptions');
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

export async function ajusterStockEntrepot(productId: string, stockMagazin: number): Promise<void> {
  const res = await fetch(`/api/magazinier/produits/${productId}/stock-entrepot`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stockMagazin }),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur ajustement stock');
}

export async function resetEntrepot(): Promise<void> {
  const res = await fetch('/api/magazinier/reset-entrepot', {
    method: 'POST', headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur réinitialisation');
}

export async function createEnvoi(
  items: { produitId: string; quantite: number }[],
): Promise<DemandeStock[]> {
  const res = await fetch('/api/magazinier/envois', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur envoi');
  return res.json();
}
