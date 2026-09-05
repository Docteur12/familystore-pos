/**
 * SKU des produits — LA source unique du numéro qui figure sur les étiquettes.
 *
 * Un produit avec un code-barres fabricant garde ce code. Sans code-barres,
 * l'étiquette porte un numéro INTERNE dérivé de l'identifiant (9 derniers
 * caractères hexadécimaux, en majuscules, tirets d'affichage tous les 3).
 *
 * La page Étiquettes imprimait ce numéro interne… que la caisse ne
 * connaissait pas : elle ne comparait que le champ `barcode`. Scanner une
 * étiquette d'un produit sans code fabricant répondait « produit introuvable ».
 * `trouverParCode` réunit les deux règles — c'est LUI que la caisse appelle.
 */

export interface ProduitScannable {
  _id: string;
  barcode?: string;
}

// Douchette « QWERTY » sur un Windows en AZERTY : les chiffres arrivent en
// à&é"'(-è_ç (vécu : « àééààààà(&'' » scanné pour 022000005144). Si la chaîne
// contient un caractère typique d'AZERTY, on retraduit tout — y compris
// « - » → 6, sans risque puisque le déclencheur est un caractère accentué
// qu'aucun code-barres légitime ne contient.
const AZERTY_VERS_CHIFFRE: Record<string, string> =
  { 'à': '0', '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5', '-': '6', 'è': '7', '_': '8', 'ç': '9' };

/** Ce que le scanner restitue : sans tirets ni espaces, en majuscules. */
export const normaliserCode = (code: string): string => {
  let brut = code.trim();
  if (/[à&é"'(è_ç]/.test(brut)) {
    brut = brut.replace(/[à&é"'(\-è_ç]/g, c => AZERTY_VERS_CHIFFRE[c] ?? c);
  }
  return brut.replace(/[-\s]/g, '').toUpperCase();
};

/** Numéro interne d'un produit sans code-barres — la partie ENCODÉE (9 car.). */
export const codeInterne = (p: ProduitScannable): string =>
  p._id.slice(-9).toUpperCase();

/** SKU affiché sur l'étiquette : code-barres du produit, sinon interne tiretté. */
export function skuProduit(p: ProduitScannable): string {
  if (p.barcode) return p.barcode;
  return codeInterne(p).replace(/(.{3})/g, '$1-').slice(0, 11);
}

/**
 * Retrouve le produit d'un code scanné.
 *  1. code-barres du produit (exact, puis normalisé — un EAN reste un EAN) ;
 *  2. numéro interne (produits sans code-barres uniquement : un code
 *     fabricant renseigné fait toujours foi).
 * Renvoie null si rien ne correspond — l'appelant décide du repli (backend).
 */
export function trouverParCode<T extends ProduitScannable>(produits: T[], code: string): T | null {
  const brut = code.trim();
  if (!brut) return null;
  const norme = normaliserCode(brut);

  return (
    produits.find(p => p.barcode && p.barcode.toLowerCase() === brut.toLowerCase()) ??
    produits.find(p => p.barcode && normaliserCode(p.barcode) === norme) ??
    produits.find(p => !p.barcode && codeInterne(p) === norme) ??
    null
  );
}
