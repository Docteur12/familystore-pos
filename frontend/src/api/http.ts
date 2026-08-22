import { jeton, jetonDeBoutique } from '../services/storage';

/**
 * En-têtes d'appel API pour la boutique ACTIVE.
 *
 * Le jeton est cloisonné par boutique : chacune a le sien, et c'est celui de
 * la boutique consultée qui part. Pour synchroniser la file d'une AUTRE
 * boutique, voir `authHeadersPourBoutique` — jamais le jeton courant.
 */
export function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${jeton() ?? ''}`, 'Content-Type': 'application/json' };
}

/**
 * En-têtes portant le jeton d'une boutique DÉSIGNÉE — utilisé pour vider la
 * file hors-ligne d'une boutique qu'on ne consulte pas. Renvoie `null` si
 * cette boutique n'a pas (ou plus) de jeton : l'appelant doit alors prévenir
 * l'utilisateur plutôt que d'envoyer avec le jeton courant, ce qui écrirait
 * dans la mauvaise boutique.
 */
export function authHeadersPourBoutique(boutiqueId: string): HeadersInit | null {
  const j = jetonDeBoutique(boutiqueId);
  return j ? { Authorization: `Bearer ${j}`, 'Content-Type': 'application/json' } : null;
}
