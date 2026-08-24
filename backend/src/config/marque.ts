/**
 * Marque du PRODUIT — un seul endroit.
 *
 * Le nom « Family Store » était répété une vingtaine de fois comme valeur de
 * repli, dans des fichiers qui n'ont rien à voir entre eux : la santé du
 * service, l'e-mail de mot de passe oublié, l'en-tête des rapports PDF. Un
 * client sur deux n'est pas Family Store, et chacune de ces occurrences était
 * un endroit à ne pas oublier le jour où on le découvrirait.
 *
 * ⚠️ MIROIR de `frontend/src/config/marque.ts` : modifier l'un impose de
 * modifier l'autre. Un test de gouvernance de chaque côté refuse la
 * réapparition du littéral.
 *
 * ═══ LA DISTINCTION QUI COMPTE ═══
 *
 * **Interface et documents INTERNES** (santé du service, journaux, rapports
 * du patron, e-mails de l'application) : on retombe sur « Caméléon ». C'est
 * notre produit, le dire est exact.
 *
 * **Documents remis au CLIENT** (tickets, factures) : on ne retombe sur RIEN.
 * Le nom du magasin y est obligatoire — un reçu sans en-tête est un défaut
 * visible qu'on corrige, un reçu portant l'enseigne d'un autre commerçant est
 * une erreur que personne ne remarque. Voir `Settings.nomMagasin`, obligatoire
 * à la création d'une boutique.
 */

export const MARQUE_PRODUIT = 'Caméléon';

/** Vert Caméléon — repli quand une boutique n'a pas choisi sa couleur. */
export const COULEUR_MARQUE = '#3F8F6B';

/**
 * Nom d'enseigne pour un usage INTERNE.
 *
 * Ne jamais employer pour un ticket ou une facture : voir la note ci-dessus.
 */
export function nomEnseigne(nomMagasin?: string | null): string {
  return String(nomMagasin ?? '').trim() || MARQUE_PRODUIT;
}

/**
 * Nom de l'application tel qu'il s'affiche à un utilisateur — expéditeur d'un
 * e-mail, en-tête d'un rapport.
 *
 * « Bependa POS » quand la boutique est connue ; « Caméléon » sinon, et non
 * « Caméléon POS » : le produit porte déjà son nom.
 */
export function nomApplication(nomMagasin?: string | null): string {
  const nom = String(nomMagasin ?? '').trim();
  return nom ? `${nom} POS` : MARQUE_PRODUIT;
}
