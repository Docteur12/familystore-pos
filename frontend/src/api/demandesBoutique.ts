import { authHeaders } from './http';
import { t } from '../i18n';
import type { DemandeBoutique } from './plateforme';
import type { TypeEtablissement } from './settings';

/**
 * Demandes d'ouverture de boutique — côté patron, mode manuel.
 *
 * Sans paiement en ligne, le patron ne « paie » pas une nouvelle boutique
 * dans l'application : il la demande. Le revendeur l'appelle, encaisse, et
 * accepte depuis son back-office — c'est là que la boutique est créée.
 */
export interface NouvelleDemande {
  nom: string;
  ville?: string;
  patron: { nom: string; email: string; motDePasse: string };
  telephone?: string;
  message?: string;
  typeEtablissement?: TypeEtablissement;
}

async function lire(res: Response): Promise<never> {
  const corps = await res.json().catch(() => ({}));
  throw new Error(corps?.message || t('Erreur', 'Error'));
}

export async function demanderOuverture(demande: NouvelleDemande): Promise<DemandeBoutique> {
  const res = await fetch('/api/demandes-boutique', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(demande),
  });
  if (!res.ok) return lire(res);
  return res.json();
}

export async function mesDemandes(): Promise<DemandeBoutique[]> {
  const res = await fetch('/api/demandes-boutique/mes', { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}
