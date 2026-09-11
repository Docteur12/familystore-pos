/**
 * Vocabulaire par profil métier — le mot juste pour chaque type d'établissement.
 *
 * Un restaurant ne vend pas des « articles » mais des plats, il n'a pas une
 * « caisse » mais une salle, et son client est une table. Les écrans COMMUNS
 * aux profils (rapports, exports, consolidé) emploient `v()` là où le mot
 * change ; les écrans commerce existants ne sont pas réécrits pour ça
 * (CAMELEON-GAMME.md §2.4).
 *
 * Chaque valeur passe par `t()` : FR et EN, comme toute chaîne visible.
 */
import { t } from './index';
import type { TypeEtablissement } from '../api/settings';

export const TERMES = ['article', 'articles', 'stock', 'vente', 'ventes', 'caisse', 'client', 'ticket'] as const;
export type Terme = typeof TERMES[number];

type Lexique = Record<Terme, [fr: string, en: string]>;

const LEXIQUES: Record<TypeEtablissement, Lexique> = {
  commerce: {
    article: ['article', 'item'], articles: ['articles', 'items'], stock: ['stock', 'stock'],
    vente: ['vente', 'sale'], ventes: ['ventes', 'sales'], caisse: ['caisse', 'checkout'],
    client: ['client', 'customer'], ticket: ['ticket', 'receipt'],
  },
  snack: {
    article: ['article', 'item'], articles: ['articles', 'items'], stock: ['réserve', 'stockroom'],
    vente: ['vente', 'sale'], ventes: ['ventes', 'sales'], caisse: ['comptoir', 'counter'],
    client: ['client', 'customer'], ticket: ['ticket', 'receipt'],
  },
  restaurant: {
    article: ['plat', 'dish'], articles: ['plats', 'dishes'], stock: ['réserve', 'stockroom'],
    vente: ['addition', 'bill'], ventes: ['additions', 'bills'], caisse: ['salle', 'dining room'],
    client: ['table', 'table'], ticket: ['addition', 'bill'],
  },
  hotel: {
    article: ['prestation', 'service'], articles: ['prestations', 'services'], stock: ['inventaire', 'inventory'],
    vente: ['séjour', 'stay'], ventes: ['séjours', 'stays'], caisse: ['réception', 'front desk'],
    client: ['client', 'guest'], ticket: ['facture', 'invoice'],
  },
};

/** Le mot d'un profil pour un terme, traduit dans la langue de l'appareil. */
export function v(terme: Terme, type: TypeEtablissement = 'commerce'): string {
  const lexique = LEXIQUES[type] ?? LEXIQUES.commerce;
  const [fr, en] = lexique[terme];
  return t(fr, en);
}

/** Même mot, première lettre en majuscule — pour un titre. */
export function V(terme: Terme, type: TypeEtablissement = 'commerce'): string {
  const mot = v(terme, type);
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}

/** Exposé pour le test de complétude : chaque type, chaque terme, deux langues. */
export function lexiqueBrut(type: TypeEtablissement): Lexique {
  return LEXIQUES[type];
}
