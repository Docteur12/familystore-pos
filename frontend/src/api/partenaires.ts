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

export type ModePaiement = 'comptant' | 'credit' | 'depot_vente';
export const MODE_LABELS: Record<string, string> = {
  comptant: 'Comptant', credit: 'Crédit', depot_vente: 'Dépôt-vente',
};

export interface LivraisonPartenaire {
  _id: string;
  numeroBL: string;
  partenaire: { _id: string; name: string; phone?: string; lieu?: string } | string;
  lignes: LivraisonLigne[];
  total: number;
  montantPaye: number;
  modePaiement: ModePaiement;
  date: string;
  creePar?: { name: string; role: string } | string;
  createdAt: string;
}

export interface LivraisonInput {
  numeroBL?: string;
  date?: string;
  montantPaye?: number;
  modePaiement?: ModePaiement;
  lignes: { productId: string; quantite: number; prixUnitaire: number }[];
}

// ── Commandes (demande du grossiste) ──────────────────────────────────────────
export interface CommandePartenaire {
  _id: string;
  numero: string;
  partenaire: { _id: string; name: string; lieu?: string } | string;
  lignes: { productId: string; productName: string; unit: string; quantite: number; prixUnitaire: number }[];
  modePaiement: ModePaiement;
  delai: number;
  statut: 'recue' | 'preparee' | 'livree';
  note: string;
  livraison: string | null;
  createdAt: string;
}

export async function getCommandes(statut?: string): Promise<CommandePartenaire[]> {
  const res = await fetch(`/api/partenaires/commandes${statut ? `?statut=${statut}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement commandes');
  return res.json();
}

export async function createCommande(data: { partenaireId: string; modePaiement?: ModePaiement; delai?: number; note?: string; lignes: { productId: string; quantite: number; prixUnitaire: number }[] }): Promise<CommandePartenaire> {
  const res = await fetch('/api/partenaires/commandes', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Erreur création commande');
  return res.json();
}

export async function updateCommande(id: string, dto: Partial<{ statut: string; note: string; delai: number }>): Promise<CommandePartenaire> {
  const res = await fetch(`/api/partenaires/commandes/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(dto) });
  if (!res.ok) throw new Error('Erreur modification commande');
  return res.json();
}

export async function deleteCommande(id: string): Promise<void> {
  const res = await fetch(`/api/partenaires/commandes/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur suppression commande');
}

export async function livrerCommande(id: string, montantPaye = 0): Promise<LivraisonPartenaire> {
  const res = await fetch(`/api/partenaires/commandes/${id}/livrer`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ montantPaye }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Erreur génération du bon de livraison');
  return res.json();
}

// ── Retours d'invendus (dépôt-vente) ──────────────────────────────────────────
export async function createRetour(partenaireId: string, data: { note?: string; lignes: { productId: string; quantite: number; prixUnitaire: number }[] }): Promise<unknown> {
  const res = await fetch(`/api/partenaires/${partenaireId}/retours`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Erreur enregistrement du retour');
  return res.json();
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

// ── Paiements & relevé de compte ──────────────────────────────────────────────
export interface PaiementPartenaire {
  _id: string;
  partenaire: string;
  montant: number;
  note: string;
  date: string;
  creePar?: { name: string; role: string } | string;
  createdAt: string;
}

export interface RetourPartenaire {
  _id: string;
  partenaire: string;
  lignes: { productId: string; productName: string; quantite: number; prixUnitaire: number }[];
  total: number;
  note: string;
  createdAt: string;
}

export interface ComptePartenaire {
  partenaire: Partenaire;
  livraisons: LivraisonPartenaire[];
  paiements: PaiementPartenaire[];
  retours: RetourPartenaire[];
  totalLivre: number;
  payeLivraison: number;
  totalPaiements: number;
  totalRetours: number;
  solde: number;
}

export async function getCompte(partenaireId: string): Promise<ComptePartenaire> {
  const res = await fetch(`/api/partenaires/${partenaireId}/compte`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement du compte');
  return res.json();
}

export interface PartenairesStats {
  nbPartenaires: number;
  totalLivre: number;
  totalEncaisse: number;
  totalCreances: number;
  topDebiteurs: { partenaireId: string; name: string; livre: number; paye: number; solde: number }[];
  evolution: { mois: string; livre: number; encaisse: number }[];
}

export async function getPartenairesStats(): Promise<PartenairesStats> {
  const res = await fetch('/api/partenaires/stats', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement statistiques');
  return res.json();
}

export async function createPaiement(partenaireId: string, data: { montant: number; note?: string }): Promise<PaiementPartenaire> {
  const res = await fetch(`/api/partenaires/${partenaireId}/paiements`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur enregistrement du paiement');
  return res.json();
}

// Dernier prix pratiqué par produit pour ce partenaire (map productId -> prix)
export async function getDernierPrix(partenaireId: string): Promise<Record<string, number>> {
  const res = await fetch(`/api/partenaires/${partenaireId}/dernier-prix`, { headers: authHeaders() });
  if (!res.ok) return {};
  return res.json();
}
