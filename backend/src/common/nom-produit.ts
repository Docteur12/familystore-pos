/**
 * Nomenclature des noms de produits — côté serveur.
 *
 * MIROIR de `formatProductName` / `displayName` dans
 * `frontend/src/utils/text.ts` : les deux doivent donner le même résultat, sans
 * quoi un même produit s'affiche différemment à l'écran et dans les PDF/Excel.
 * Toute modification de la règle doit être reportée des deux côtés.
 *
 * Règle : 1ʳᵉ lettre de chaque mot en majuscule, reste en minuscule ; petits
 * mots en minuscule sauf en tête ; tokens contenant un chiffre et unités
 * laissés intacts ; élisions gérées.
 *
 *   « isana paris deospray »  → « Isana Paris Deospray »
 *   « bain de bouche »        → « Bain de Bouche »
 *   « balea serum 30 ml »     → « Balea Serum 30 ml »
 */

const STOPWORDS = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd',
  'et', 'ou', 'à', 'au', 'aux', 'en', 'dans', 'par', 'pour', 'sur', 'sous', 'avec', 'sans',
]);

const UNITS = new Set(['ml', 'cl', 'l', 'g', 'kg', 'mg', 'pcs', 'pc', 'x']);

export function nomProduit(s: string | undefined | null): string {
  const cap = (w: string) => (w ? w.toLowerCase().replace(/[a-zà-ÿ]/i, (c) => c.toUpperCase()) : w);
  return (s ?? '')
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (/\d/.test(w)) return w;
      if (UNITS.has(w.toLowerCase())) return w;
      const el = w.match(/^([A-Za-zÀ-ÿ]{1,2})['’](.+)$/);
      if (el) {
        const art = i === 0 ? cap(el[1]) : el[1].toLowerCase();
        return `${art}'${cap(el[2])}`;
      }
      if (i > 0 && STOPWORDS.has(w.toLowerCase())) return w.toLowerCase();
      return cap(w);
    })
    .join(' ');
}
