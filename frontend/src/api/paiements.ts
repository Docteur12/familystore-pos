import { authHeaders } from './http';
import { t } from '../i18n';

/**
 * Paiements de la plateforme — création de boutique et renouvellement.
 *
 * Deux choses à garder en tête en lisant ce fichier :
 *
 *  - **ouvrir un paiement ne crée pas de boutique.** La réponse porte une
 *    référence à interroger ; la boutique n'apparaîtra qu'une fois le
 *    paiement confirmé côté serveur ;
 *  - **l'interface interroge, elle n'attend pas un webhook.** Les
 *    notifications Mobile Money se perdent ; le serveur va lui-même chercher
 *    l'état auprès du prestataire, et cette page lit ce que le serveur sait.
 */

export type StatutPaiement = 'en_attente' | 'confirme' | 'echoue' | 'expire' | 'rembourse';

export interface Paiement {
  reference: string;
  objet: 'creation_boutique' | 'renouvellement_licence';
  statut: StatutPaiement;
  montant: number;
  devise: string;
  urlPaiement: string | null;
  boutiqueId: string | null;
  nomBoutique: string | null;
  /** Rang de la tentative : 1 pour la première. */
  tentative: number;
  depasse: boolean;
  cree: string | null;
}

export interface DemandeBoutique {
  nom: string;
  ville?: string;
  patron: { nom: string; email: string; motDePasse: string };
  /**
   * Numéro Mobile Money à débiter.
   *
   * Demandé à chaque paiement, pré-rempli avec celui du propriétaire mais
   * modifiable : le patron peut régler depuis un autre compte MoMo, et c'est
   * le numéro DÉBITÉ qui doit être saisi.
   */
  telephonePayeur: string;
}

async function lire(res: Response): Promise<never> {
  const corps = await res.json().catch(() => ({}));
  throw new Error(corps?.message || t('Erreur de paiement', 'Payment error'));
}

/** Ouvre un paiement pour créer une boutique. Ne crée rien d'autre. */
export async function demanderBoutique(demande: DemandeBoutique): Promise<Paiement> {
  const res = await fetch('/api/paiements/boutique', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(demande),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

/** Ouvre un paiement pour renouveler la licence d'une boutique. */
export async function demanderRenouvellement(boutiqueId: string, telephonePayeur: string): Promise<Paiement> {
  const res = await fetch('/api/paiements/renouvellement', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ boutiqueId, telephonePayeur }),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

/**
 * Nouvelle tentative de paiement.
 *
 * Le serveur ouvre une transaction avec une référence NEUVE : le prestataire
 * refuse une référence déjà employée. Le lien avec la tentative précédente
 * est conservé côté serveur, et une seule boutique naîtra de la série même
 * si deux tentatives finissent par être confirmées.
 */
export async function reessayerPaiement(reference: string, telephonePayeur: string): Promise<Paiement> {
  const res = await fetch(`/api/paiements/${encodeURIComponent(reference)}/reessayer`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ telephonePayeur }),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

/** État d'un paiement — interrogé pendant l'attente. */
export async function etatPaiement(reference: string): Promise<Paiement> {
  const res = await fetch(`/api/paiements/${encodeURIComponent(reference)}`, { headers: authHeaders() });
  if (!res.ok) return lire(res);
  return res.json();
}

export async function mesPaiements(): Promise<Paiement[]> {
  const res = await fetch('/api/paiements', { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Numéro enregistré du propriétaire, pour pré-remplir le champ.
 *
 * Une suggestion, pas une contrainte : renvoie une chaîne vide si aucun
 * numéro exploitable n'est connu.
 */
export async function telephonePayeurParDefaut(): Promise<string> {
  const res = await fetch('/api/paiements/payeur', { headers: authHeaders() });
  if (!res.ok) return '';
  const corps = await res.json().catch(() => ({}));
  return typeof corps?.telephone === 'string' ? corps.telephone : '';
}
