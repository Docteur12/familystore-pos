/**
 * Constantes du module Snack-bar — motifs de stock, libellés partagés.
 *
 * Les deux motifs propres au profil, `reception_casier` et `casse`, sont
 * déclarés des deux côtés du miroir (`schemas/stock-movement.schema.ts` et
 * `Stocks.tsx › REASON_LABELS`), sous la gouvernance de
 * `motifs-stock-governance.spec.ts`. Les mouvements gardent en plus une note
 * explicite (« Réception 3 casier(s) × 24 », « Casse — … »).
 */
import type { MovementReason } from '../schemas/stock-movement.schema';

export const MOTIF_RECEPTION_CASIER: MovementReason = 'reception_casier';
export const MOTIF_CASSE: MovementReason = 'casse';

/**
 * Préfixe du nom des lignes de consigne dans une vente (`Sale.items`).
 *
 * La consigne encaissée est une ligne À PART de la vente, marquée `divers`
 * (aucun décrément de stock) et portant `product` (pour agréger par produit).
 * Le total encaissé est ainsi juste, et la comptabilité isole la consigne par
 * son nom. MIROIR de `PREFIXE_LIGNE_CONSIGNE` dans `frontend/src/utils/comptoir-panier.ts`.
 */
export const PREFIXE_LIGNE_CONSIGNE = 'Consigne ';

/** Catégorie de la dépense créée à chaque retour de vide (consigne rendue). */
export const CATEGORIE_DEPENSE_CONSIGNE = 'Consigne rendue';

/** Rôles autorisés au comptoir (vente, retour de vide). */
export const ROLES_COMPTOIR = ['caissier', 'patron', 'gestionnaire'] as const;
/** Rôles autorisés sur la réserve (casiers, casse, conditionnements). */
export const ROLES_RESERVE  = ['patron', 'gestionnaire', 'magazinier'] as const;
/** Rôles autorisés à lire le rapport des consignes. */
export const ROLES_RAPPORT  = ['patron', 'gestionnaire'] as const;
