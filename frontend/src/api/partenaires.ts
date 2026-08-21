import { authHeaders } from './http';
import { t } from '../i18n';

export interface Partenaire {
  _id: string;
  name: string;
  phone: string;
  lieu: string;
  ville?: string;
  quartier?: string;
  responsable?: string;
  email?: string;
  note: string;
  type?: 'structure' | 'particulier';
  archivee?: boolean;
  ancienneDette?: number; // créance existante avant l'enregistrement (report de solde)
  createdAt?: string;
}

// ── Agences (sous-entités d'un partenaire) ─────────────────────────────────────
export interface Agence {
  _id: string;
  partenaire: string;
  nom: string;
  ville: string;
  quartier?: string;
  telephone?: string;
  responsable?: string;
  independante: boolean;
  archivee: boolean;
  createdAt?: string;
}

export async function getAgences(partenaireId?: string): Promise<Agence[]> {
  const res = await fetch(`/api/partenaires/agences${partenaireId ? `?partenaireId=${partenaireId}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement agences', 'Failed to load branches'));
  return res.json();
}

export async function createAgence(data: { partenaireId: string; nom: string; ville?: string; quartier?: string; telephone?: string; responsable?: string; independante?: boolean }): Promise<Agence> {
  const res = await fetch('/api/partenaires/agences', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(t('Erreur création agence', 'Failed to create branch'));
  return res.json();
}

export async function updateAgence(id: string, dto: Partial<{ nom: string; ville: string; quartier: string; telephone: string; responsable: string; independante: boolean; archivee: boolean }>): Promise<Agence> {
  const res = await fetch(`/api/partenaires/agences/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(dto) });
  if (!res.ok) throw new Error(t('Erreur modification agence', 'Failed to update branch'));
  return res.json();
}

export async function deleteAgence(id: string): Promise<{ archived: boolean; deleted: boolean }> {
  const res = await fetch(`/api/partenaires/agences/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur suppression agence', 'Failed to delete branch'));
  return res.json();
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
  comptant: t('Comptant', 'Cash'), credit: t('Crédit', 'Credit'), depot_vente: t('Dépôt-vente', 'Consignment'),
};

export interface LivraisonPartenaire {
  _id: string;
  numeroBL: string;
  partenaire: { _id: string; name: string; phone?: string; lieu?: string } | string;
  agence?: string | null;
  commande?: string | null;
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
  agenceId?: string | null;
  commandeId?: string | null;
  lignes: { productId: string; quantite: number; prixUnitaire: number }[];
  idempotencyKey?: string;
}

// ── Commandes (demande du grossiste) ──────────────────────────────────────────
export interface CommandePartenaire {
  _id: string;
  numero: string;
  partenaire: { _id: string; name: string; lieu?: string } | string;
  agence?: string | null;
  lignes: { productId: string; productName: string; unit: string; quantite: number; quantiteLivree?: number; prixUnitaire: number }[];
  modePaiement: ModePaiement;
  delai: number;
  statut: 'recue' | 'preparee' | 'partielle' | 'livree';
  note: string;
  livraison: string | null;
  createdAt: string;
}

// Préparation/livraison par le magasinier : quantités réellement servies
export async function preparerCommande(commandeId: string, data: { lignes: { productId: string; quantite: number; prixUnitaire?: number }[]; montantPaye?: number; date?: string; numeroBL?: string; idempotencyKey?: string }): Promise<{ livraison: LivraisonPartenaire; commande: CommandePartenaire }> {
  const res = await fetch(`/api/partenaires/commandes/${commandeId}/preparer`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t('Erreur préparation de la commande', 'Failed to prepare the order'));
  return res.json();
}

export async function getCommandes(statut?: string): Promise<CommandePartenaire[]> {
  const res = await fetch(`/api/partenaires/commandes${statut ? `?statut=${statut}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement commandes', 'Failed to load orders'));
  return res.json();
}

export async function createCommande(data: { partenaireId: string; agenceId?: string | null; modePaiement?: ModePaiement; delai?: number; note?: string; lignes: { productId: string; quantite: number; prixUnitaire: number }[] }): Promise<CommandePartenaire> {
  const res = await fetch('/api/partenaires/commandes', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(t('Erreur création commande', 'Failed to create order'));
  return res.json();
}

export async function updateCommande(id: string, dto: Partial<{ statut: string; note: string; delai: number; modePaiement: ModePaiement; agenceId: string | null; lignes: { productId: string; quantite: number; prixUnitaire: number }[] }>): Promise<CommandePartenaire> {
  const res = await fetch(`/api/partenaires/commandes/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(dto) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t('Erreur modification commande', 'Failed to update order'));
  return res.json();
}

export async function deleteCommande(id: string): Promise<{ ok: boolean; livraisonsAnnulees: number; produitsRestitues: number }> {
  const res = await fetch(`/api/partenaires/commandes/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur suppression commande', 'Failed to delete order'));
  return res.json();
}

export async function livrerCommande(id: string, montantPaye = 0): Promise<LivraisonPartenaire> {
  const res = await fetch(`/api/partenaires/commandes/${id}/livrer`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ montantPaye }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t('Erreur génération du bon de livraison', 'Failed to generate the delivery note'));
  return res.json();
}

// ── Retours d'invendus (dépôt-vente) ──────────────────────────────────────────
export async function createRetour(partenaireId: string, data: { note?: string; lignes: { productId: string; quantite: number; prixUnitaire: number }[] }): Promise<unknown> {
  const res = await fetch(`/api/partenaires/${partenaireId}/retours`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(t('Erreur enregistrement du retour', 'Failed to save the return'));
  return res.json();
}

// ── Partenaires ───────────────────────────────────────────────────────────────
export async function getPartenaires(): Promise<Partenaire[]> {
  const res = await fetch('/api/partenaires', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement partenaires', 'Failed to load partners'));
  return res.json();
}

export async function createPartenaire(data: { name: string; phone?: string; lieu?: string; ville?: string; quartier?: string; responsable?: string; email?: string; note?: string; type?: 'structure' | 'particulier'; ancienneDette?: number }): Promise<Partenaire> {
  const res = await fetch('/api/partenaires', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(t('Erreur création partenaire', 'Failed to create partner'));
  return res.json();
}

export async function updatePartenaire(id: string, data: Partial<Pick<Partenaire, 'name' | 'phone' | 'lieu' | 'ville' | 'quartier' | 'responsable' | 'email' | 'note' | 'type' | 'archivee' | 'ancienneDette'>>): Promise<Partenaire> {
  const res = await fetch(`/api/partenaires/${id}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(t('Erreur modification partenaire', 'Failed to update partner'));
  return res.json();
}

export async function deletePartenaire(id: string): Promise<void> {
  const res = await fetch(`/api/partenaires/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur suppression partenaire', 'Failed to delete partner'));
}

// ── Livraisons ──────────────────────────────────────────────────────────────
export async function getLivraisons(partenaireId?: string): Promise<LivraisonPartenaire[]> {
  const url = `/api/partenaires/livraisons${partenaireId ? `?partenaireId=${partenaireId}` : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement livraisons', 'Failed to load deliveries'));
  return res.json();
}

export async function createLivraison(partenaireId: string, data: LivraisonInput): Promise<LivraisonPartenaire> {
  const res = await fetch(`/api/partenaires/${partenaireId}/livraisons`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t('Erreur création livraison', 'Failed to create delivery'));
  return res.json();
}

// Modification d'un bon de livraison : le stock entrepôt est ajusté par différence.
export async function updateLivraison(id: string, dto: Partial<{ lignes: { productId: string; quantite: number; prixUnitaire: number }[]; montantPaye: number; date: string; numeroBL: string }>): Promise<LivraisonPartenaire> {
  const res = await fetch(`/api/partenaires/livraisons/${id}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t('Erreur modification de la livraison', 'Failed to update the delivery'));
  return res.json();
}

// Suppression d'un bon de livraison : stock restitué, commande liée réouverte.
export async function deleteLivraison(id: string): Promise<{ ok: boolean; produitsRestitues: number }> {
  const res = await fetch(`/api/partenaires/livraisons/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t('Erreur suppression de la livraison', 'Failed to delete the delivery'));
  return res.json();
}

// ── Paiements & relevé de compte ──────────────────────────────────────────────
export interface PaiementPartenaire {
  _id: string;
  partenaire: string;
  agence?: string | null;
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
  if (!res.ok) throw new Error(t('Erreur chargement du compte', 'Failed to load the account'));
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
  if (!res.ok) throw new Error(t('Erreur chargement statistiques', 'Failed to load statistics'));
  return res.json();
}

export async function createPaiement(partenaireId: string, data: { montant: number; note?: string; date?: string; agenceId?: string | null }): Promise<PaiementPartenaire> {
  const res = await fetch(`/api/partenaires/${partenaireId}/paiements`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(t('Erreur enregistrement du paiement', 'Failed to save the payment'));
  return res.json();
}

// ── Compte ventilé par agence (dette par agence / commune / globale) ───────────
export interface AgenceCompte {
  _id: string; nom: string; ville: string; telephone?: string; responsable?: string;
  independante: boolean; archivee: boolean;
  livre: number; paye: number; verse: number; qteCommandee: number; qteLivree: number; solde: number;
}
export interface CompteAgences {
  partenaire: Partenaire;
  agences: AgenceCompte[];
  livraisons: LivraisonPartenaire[];
  paiements: PaiementPartenaire[];
  retours: RetourPartenaire[];
  commandes: CommandePartenaire[];
  detteCommune: number;
  detteAgences: number;
  soldeGlobal: number;
  ancienneDette: number;
  totalLivre: number;
  payeLivraison: number;
  totalPaiements: number;
  totalRetours: number;
}
export async function getCompteAgences(partenaireId: string): Promise<CompteAgences> {
  const res = await fetch(`/api/partenaires/${partenaireId}/compte-agences`, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement du compte par agence', 'Failed to load the account by branch'));
  return res.json();
}

export interface StatsAgences {
  nbPartenaires: number;
  nbAgences: number;
  totalLivre: number;
  totalCreances: number;
  debiteurs: { partenaireId: string; name: string; agenceId: string | null; agenceNom: string; sub: string; solde: number }[];
}
export async function getStatsAgences(): Promise<StatsAgences> {
  const res = await fetch('/api/partenaires/stats-agences', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement statistiques par agence', 'Failed to load statistics by branch'));
  return res.json();
}

// ── Historique global (livraisons + versements + retours) ──────────────────────
export interface Operation {
  type: 'livraison' | 'versement' | 'retour';
  id?: string;           // _id du bon de livraison (type 'livraison' uniquement)
  date: string;
  partenaire: string;
  agence: string;
  montant: number;
  ref?: string;
  note?: string;
  lignes?: { productName: string; quantite: number }[];
}
export async function getOperations(): Promise<Operation[]> {
  const res = await fetch('/api/partenaires/historique', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement historique', 'Failed to load history'));
  return res.json();
}

// Dernier prix pratiqué par produit pour ce partenaire (map productId -> prix)
export async function getDernierPrix(partenaireId: string): Promise<Record<string, number>> {
  const res = await fetch(`/api/partenaires/${partenaireId}/dernier-prix`, { headers: authHeaders() });
  if (!res.ok) return {};
  return res.json();
}
