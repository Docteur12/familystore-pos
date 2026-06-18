// Couleur de la boutique résolue depuis la variable CSS (--fs-wine-700).
// Utile pour les graphiques (recharts) où var() ne fonctionne pas dans le SVG.
export function getBrandColor(fallback = '#FF0000'): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fs-wine-700').trim();
  return v || fallback;
}

// Petits mots (articles, prépositions, conjonctions) laissés en minuscule,
// SAUF s'ils sont le 1ᵉʳ mot du nom.
const NAME_STOPWORDS = new Set([
  'le', 'la', 'les', "l", 'un', 'une', 'des', 'de', 'du', "d",
  'et', 'ou', 'à', 'au', 'aux', 'en', 'dans', 'par', 'pour', 'sur', 'sous', 'avec', 'sans',
]);

// Met en forme un nom de produit (convention) :
//  - chaque mot : 1ʳᵉ lettre en MAJUSCULE, reste en minuscule (BALEA → Balea, deo → Deo)
//  - sauf les petits mots (le, la, les, de, du, un, une, à, pour…) → minuscule
//  - mais le 1ᵉʳ mot est toujours capitalisé
//  - élisions gérées : « d'aloe » → « d'Aloe », « l'urée » → « l'Urée »
export function formatProductName(s: string): string {
  const cap = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w);
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      // Élision : article court + apostrophe + mot (d'Aloe, l'Urée, qu'…)
      const el = w.match(/^([A-Za-zÀ-ÿ]{1,2})['’](.+)$/);
      if (el) {
        const art = i === 0 ? cap(el[1]) : el[1].toLowerCase();
        return `${art}'${cap(el[2])}`;
      }
      if (i > 0 && NAME_STOPWORDS.has(w.toLowerCase())) return w.toLowerCase();
      return cap(w);
    })
    .join(' ');
}

// Title Case « complet » : tout en minuscule puis 1ʳᵉ lettre de chaque mot
// en majuscule. Sert à normaliser des noms existants (ex. tout en MAJUSCULES).
// « BALEA HAARSPRAY GLOSSY » → « Balea Haarspray Glossy ».
export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Met en majuscule la première lettre de CHAQUE mot (Title Case),
// en laissant le reste tel que saisi (acronymes, unités « 500ml », etc.).
export function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
