import { LigneExtraite } from './extracteur';

/**
 * Appariement des lignes lues aux produits du catalogue — PROPOSITION, jamais
 * décision : l'écran de contrôle montre la suggestion, l'utilisateur confirme
 * ou change. Trois clés, dans l'ordre de confiance :
 *   1. la référence/code-barres imprimée sur la facture = code-barres produit ;
 *   2. le libellé normalisé identique au nom d'un produit ;
 *   3. sinon « nouveau » — le produit sera créé à la validation.
 */

export interface ProduitCandidat { _id: unknown; name: string; barcode?: string | null }

export interface LigneAppariee extends LigneExtraite {
  produitId: string | null;
  produitNom: string | null;
  appariement: 'existant' | 'nouveau';
}

/** Minuscules, sans accents, ponctuation et espaces multiples réduits. */
export const normaliserLibelle = (s: string): string =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function apparierLignes(lignes: LigneExtraite[], produits: ProduitCandidat[]): LigneAppariee[] {
  const parCode = new Map<string, ProduitCandidat>();
  const parNom  = new Map<string, ProduitCandidat>();
  for (const p of produits) {
    if (p.barcode) parCode.set(String(p.barcode).replace(/[\s-]/g, ''), p);
    parNom.set(normaliserLibelle(p.name), p);
  }
  return lignes.map(l => {
    const ref = (l.reference ?? '').replace(/[\s-]/g, '');
    const trouve = (ref && parCode.get(ref)) || parNom.get(normaliserLibelle(l.designation)) || null;
    return {
      ...l,
      produitId:   trouve ? String(trouve._id) : null,
      produitNom:  trouve ? trouve.name : null,
      appariement: trouve ? 'existant' : 'nouveau',
    };
  });
}
