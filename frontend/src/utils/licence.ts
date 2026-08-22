/**
 * Règles d'alerte de licence — logique pure, testable.
 *
 * Séparée du composant à dessein : les seuils décident quand un commerçant
 * est prévenu qu'il va perdre la saisie. Une erreur ici ne se voit pas à
 * l'œil (il faut attendre le bon nombre de jours), donc elle doit être
 * couverte par des tests plutôt que par une relecture.
 *
 * Les mêmes seuils servent aux relances par e-mail côté serveur
 * (`RelanceLicenceService`) : si l'un change, l'autre doit suivre.
 */

/** Jours avant échéance déclenchant un rappel. Du plus lointain au plus proche. */
export const SEUILS_ALERTE = [14, 7, 3, 1] as const;

export type NiveauAlerte = 'aucun' | 'info' | 'proche' | 'urgent' | 'expire';

/**
 * Niveau d'alerte à afficher.
 *
 * `expiree` l'emporte sur tout : une licence dépassée n'a plus de « jours
 * restants » significatifs (ils sont négatifs), et le message change de
 * nature — il ne prévient plus, il explique ce qui reste possible.
 */
export function niveauAlerte(joursRestants: number | undefined, expiree = false): NiveauAlerte {
  if (expiree) return 'expire';
  const jours = joursRestants ?? Number.POSITIVE_INFINITY;
  if (jours <= 3) return 'urgent';
  if (jours <= 7) return 'proche';
  if (jours <= 14) return 'info';
  return 'aucun';   // trop tôt pour déranger
}

/** Faut-il afficher quelque chose ? */
export function doitAlerter(joursRestants: number | undefined, expiree = false): boolean {
  return niveauAlerte(joursRestants, expiree) !== 'aucun';
}

/**
 * Seuil de relance atteint, ou `null`.
 *
 * Rend le seuil FRANCHI le plus proche : à 5 jours, c'est celui de 7 — la
 * relance des 7 jours n'a pas encore été envoyée si le patron ne s'est pas
 * connecté entre-temps, et on ne veut pas sauter un cran.
 */
export function seuilAtteint(joursRestants: number): number | null {
  for (const seuil of SEUILS_ALERTE) {
    if (joursRestants <= seuil) {
      // On continue pour trouver le plus petit seuil encore ≥ joursRestants…
      const plusProche = SEUILS_ALERTE.filter(s => joursRestants <= s).pop();
      return plusProche ?? seuil;
    }
  }
  return null;
}
