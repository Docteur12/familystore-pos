/**
 * Constantes du module Snack-bar — motifs de stock, libellés partagés.
 *
 * PHASE 1 (socle profil métier non mergé) : le miroir des motifs de stock
 * (`schemas/stock-movement.schema.ts` + `Stocks.tsx › REASON_LABELS`) est un
 * fichier PARTAGÉ, interdit avant le signal. Les mouvements du snack sont donc
 * écrits avec des motifs EXISTANTS et une note explicite (« Réception 3
 * casier(s) × 24 », « Casse — … »).
 *
 * PHASE 2 : ajouter `reception_casier` et `casse` des deux côtés du miroir,
 * puis basculer ces deux constantes. Les tests du module lisent les
 * constantes, pas les littéraux : la bascule ne les casse pas.
 */
import type { MovementReason } from '../schemas/stock-movement.schema';

export const MOTIF_RECEPTION_CASIER: MovementReason = 'reception';
export const MOTIF_CASSE: MovementReason = 'adjustment';

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
