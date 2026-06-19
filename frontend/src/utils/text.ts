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

// Forme canonique des unités : L, mL, cL, g, Kg, mg.
const UNIT_MAP: Record<string, string> = { l: 'L', ml: 'mL', cl: 'cL', g: 'g', kg: 'Kg', mg: 'mg' };

// Met un volume au bon format d'unité (« 500ml » → « 500mL », « 1l » → « 1L »,
// « 2.025KG » → « 2.025Kg »). Si valeur = nombre seul, ajoute l'unité fournie.
export function formatVolume(valeur?: string, unit?: string): string {
  let v = (valeur ?? '').trim();
  if (!v) return '';
  if (!/[a-zà-ÿ]/i.test(v)) v = `${v} ${unit ?? ''}`.trim();   // nombre seul → ajoute l'unité
  // Unité de volume collée au nombre et normalisée (500 ml → 500mL, 1 l → 1L, 2kg → 2Kg)
  return v.replace(/(\d)\s*(ml|cl|kg|mg|l|g)\b/gi, (_, d, u) => d + (UNIT_MAP[u.toLowerCase()] ?? u));
}

// Extrait le volume/quantité d'un nom de produit (« …500ml », « …1L », « …400g »).
// Renvoie { valeur, cleaned } — cleaned = nom sans le volume si celui-ci est en fin.
// Renvoie null si aucun volume détecté.
export function extractVolume(name: string): { valeur: string; cleaned: string } | null {
  const re = /(\d+(?:[.,]\d+)?)\s*(ml|cl|kg|mg|l|g)\b/gi;
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((m = re.exec(name)) !== null) last = m;
  if (!last) return null;
  const u = last[2].toLowerCase();
  const valeur = `${last[1].replace(',', '.')}${UNIT_MAP[u] ?? u}`;
  // Nettoie le nom uniquement si le volume est en fin de nom (cas le plus courant).
  const endPos = last.index + last[0].length;
  let cleaned = name;
  if (name.slice(endPos).trim() === '') {
    cleaned = name.slice(0, last.index).replace(/[\s·\-–,]+$/g, '').trim();
  }
  return { valeur, cleaned: cleaned || name };
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
