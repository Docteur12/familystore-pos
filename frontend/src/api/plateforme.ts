import { authHeaders } from './http';
import { t } from '../i18n';
import type { TypeEtablissement } from './settings';

/**
 * Back-office plateforme — réservé au superadmin (le revendeur).
 *
 * Mode LICENCE MANUELLE : le commerçant règle de la main à la main, et c'est
 * ici que le revendeur enregistre le règlement et prolonge la licence. Chaque
 * prolongation laisse un paiement confirmé, source « manuel » — la trace
 * comptable que consultera un litige.
 */

/**
 * Moyens de règlement acceptés. MIROIR de `MOYENS_REGLEMENT` dans
 * `backend/src/platform/paiement/paiement.schema.ts` — un test de gouvernance
 * compare les deux listes.
 */
export const MOYENS_REGLEMENT = [
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'especes',      label: 'Espèces' },
  { id: 'virement',     label: 'Virement' },
  { id: 'autre',        label: 'Autre' },
] as const;
export type MoyenReglement = typeof MOYENS_REGLEMENT[number]['id'];

export interface LicenceBoutique {
  montant: number;
  devise: string;
  dateEcheance: string;
  expiree: boolean;
  joursRestants: number;
}

export interface BoutiquePlateforme {
  id: string;
  nom: string;
  ville: string;
  tenantId: string;
  statut: 'active' | 'suspendue';
  /** Absent sur un serveur antérieur au socle : commerce. */
  typeEtablissement?: TypeEtablissement;
  proprietaire: { nom: string; email: string } | null;
  licence: LicenceBoutique | null;
}

export interface PaiementPlateforme {
  reference: string;
  objet: 'creation_boutique' | 'renouvellement_licence';
  statut: string;
  montant: number;
  devise: string;
  fournisseur: string;
  moyenReglement: MoyenReglement | null;
  note: string;
  enregistrePar: string;
  cree: string | null;
}

export interface Reglement {
  montant: number;
  moyen: MoyenReglement;
  note?: string;
}

export interface DemandeNouvelleBoutique {
  nom: string;
  ville?: string;
  typeEtablissement?: TypeEtablissement;
  proprietaire: { email: string; nom?: string; telephone?: string };
  patron: { nom: string; email: string; motDePasse: string };
}

async function lire(res: Response): Promise<never> {
  const corps = await res.json().catch(() => ({}));
  throw new Error(corps?.message || t('Erreur plateforme', 'Platform error'));
}

export async function listerBoutiques(): Promise<BoutiquePlateforme[]> {
  const res = await fetch('/api/platform/boutiques', { headers: authHeaders() });
  if (!res.ok) return lire(res);
  return res.json();
}

export async function creerBoutique(demande: DemandeNouvelleBoutique) {
  const res = await fetch('/api/platform/boutiques', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(demande),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

/** Enregistre le règlement reçu et prolonge la licence d'un an. */
export async function prolongerLicence(boutiqueId: string, reglement: Reglement) {
  const res = await fetch(`/api/platform/boutiques/${encodeURIComponent(boutiqueId)}/prolonger`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(reglement),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

/**
 * Change le type d'une boutique (superadmin, journalisé). Avec
 * `appliquerPrereglage`, modules et règles métier suivent le nouveau type.
 */
export async function changerTypeBoutique(boutiqueId: string, type: TypeEtablissement, appliquerPrereglage: boolean) {
  const res = await fetch(`/api/platform/boutiques/${encodeURIComponent(boutiqueId)}/type`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ type, appliquerPrereglage }),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

export async function changerStatutBoutique(boutiqueId: string, statut: 'active' | 'suspendue') {
  const res = await fetch(`/api/platform/boutiques/${encodeURIComponent(boutiqueId)}/statut`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ statut }),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

export async function paiementsBoutique(boutiqueId: string): Promise<PaiementPlateforme[]> {
  const res = await fetch(`/api/platform/boutiques/${encodeURIComponent(boutiqueId)}/paiements`, { headers: authHeaders() });
  if (!res.ok) return lire(res);
  return res.json();
}

// ── Demandes d'ouverture (mode manuel) ─────────────────────────────────────

export type StatutDemande = 'en_attente' | 'acceptee' | 'refusee';

export interface DemandeBoutique {
  id: string;
  nom: string;
  ville: string;
  proprietaire: { email: string; nom: string };
  patron: { nom: string; email: string };
  telephone: string;
  message: string;
  /** Absent sur un serveur antérieur au socle : commerce. */
  typeEtablissement?: TypeEtablissement;
  statut: StatutDemande;
  traiteeLe: string | null;
  traiteePar: string;
  motifRefus: string;
  boutiqueId: string | null;
  referencePaiement: string;
  cree: string | null;
}

/** Back-office : toutes les demandes, en attente d'abord. */
export async function listerDemandes(statut?: StatutDemande): Promise<DemandeBoutique[]> {
  const q = statut ? `?statut=${encodeURIComponent(statut)}` : '';
  const res = await fetch(`/api/platform/demandes${q}`, { headers: authHeaders() });
  if (!res.ok) return lire(res);
  return res.json();
}

/** Accepte : crée la boutique et enregistre le règlement reçu. */
export async function accepterDemande(id: string, reglement: Reglement) {
  const res = await fetch(`/api/platform/demandes/${encodeURIComponent(id)}/accepter`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(reglement),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

export async function refuserDemande(id: string, motif: string): Promise<DemandeBoutique> {
  const res = await fetch(`/api/platform/demandes/${encodeURIComponent(id)}/refuser`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ motif }),
  });
  if (!res.ok) return lire(res);
  return res.json();
}
