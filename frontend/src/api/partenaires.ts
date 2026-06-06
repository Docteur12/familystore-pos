import { authHeaders } from './http';

export interface Partenaire {
  _id: string;
  name: string;
  phone: string;
  lieu: string;
  note: string;
  createdAt?: string;
}

export interface LivraisonLigne {
  productId: string;
  productName: string;
  unit: string;
  quantite: number;
  prixUnitaire: number;
}

export interface LivraisonPartenaire {
  _id: string;
  numeroBL: string;
  partenaire: { _id: string; name: string; phone?: string; lieu?: string } | string;
  lignes: LivraisonLigne[];
  total: number;
  montantPaye: number;
  date: string;
  creePar?: { name: string; role: string } | string;
  createdAt: string;
}

export interface LivraisonInput {
  numeroBL?: string;
  date?: string;
  montantPaye?: number;
  lignes: { productId: string; quantite: number; prixUnitaire: number }[];
}

// ── Partenaires ───────────────────────────────────────────────────────────────
export async function getPartenaires(): Promise<Partenaire[]> {
  const res = await fetch('/api/partenaires', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement partenaires');
  return res.json();
}

export async function createPartenaire(data: { name: string; phone?: string; lieu?: string; note?: string }): Promise<Partenaire> {
  const res = await fetch('/api/partenaires', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur création partenaire');
  return res.json();
}

export async function updatePartenaire(id: string, data: Partial<Pick<Partenaire, 'name' | 'phone' | 'lieu' | 'note'>>): Promise<Partenaire> {
  const res = await fetch(`/api/partenaires/${id}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur modification partenaire');
  return res.json();
}

export async function deletePartenaire(id: string): Promise<void> {
  const res = await fetch(`/api/partenaires/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur suppression partenaire');
}

// ── Livraisons ──────────────────────────────────────────────────────────────
export async function getLivraisons(partenaireId?: string): Promise<LivraisonPartenaire[]> {
  const url = `/api/partenaires/livraisons${partenaireId ? `?partenaireId=${partenaireId}` : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement livraisons');
  return res.json();
}

export async function createLivraison(partenaireId: string, data: LivraisonInput): Promise<LivraisonPartenaire> {
  const res = await fetch(`/api/partenaires/${partenaireId}/livraisons`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Erreur création livraison');
  return res.json();
}

// Dernier prix pratiqué par produit pour ce partenaire (map productId -> prix)
export async function getDernierPrix(partenaireId: string): Promise<Record<string, number>> {
  const res = await fetch(`/api/partenaires/${partenaireId}/dernier-prix`, { headers: authHeaders() });
  if (!res.ok) return {};
  return res.json();
}
