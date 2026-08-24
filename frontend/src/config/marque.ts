/**
 * Marque du PRODUIT — un seul endroit.
 *
 * ⚠️ MIROIR de `backend/src/config/marque.ts` : modifier l'un impose de
 * modifier l'autre. Un test de gouvernance de chaque côté refuse la
 * réapparition du littéral.
 *
 * ═══ LA DISTINCTION QUI COMPTE ═══
 *
 * **Interface INTERNE** (menus, écrans, en-têtes d'espace) : on retombe sur
 * « Caméléon ». C'est notre produit, le dire est exact.
 *
 * **Documents remis au CLIENT** (tickets, factures) : on ne retombe sur RIEN
 * — voir `STORE_FALLBACK` dans `components/ReceiptPrint.tsx`. Un reçu sans
 * en-tête est un défaut visible qu'on corrige ; un reçu portant l'enseigne
 * d'un autre commerçant est une erreur que personne ne remarque.
 *
 * Le nom du magasin est obligatoire à la création d'une boutique : ces replis
 * ne devraient jamais être atteints.
 */

export const MARQUE_PRODUIT = 'Caméléon';

/** Vert Caméléon — écrans antérieurs au choix de la boutique, et replis. */
export const COULEUR_MARQUE = '#3F8F6B';

/**
 * Nom d'enseigne pour l'interface INTERNE.
 *
 * Ne jamais employer pour un ticket ou une facture.
 */
export function nomEnseigne(nomMagasin?: string | null): string {
  return String(nomMagasin ?? '').trim() || MARQUE_PRODUIT;
}
