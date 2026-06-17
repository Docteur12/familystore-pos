// Couleur de la boutique résolue depuis la variable CSS (--fs-wine-700).
// Utile pour les graphiques (recharts) où var() ne fonctionne pas dans le SVG.
export function getBrandColor(fallback = '#FF0000'): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fs-wine-700').trim();
  return v || fallback;
}

// Met en forme un nom de produit selon la convention :
//  - un mot en MAJUSCULES  → « Première lettre majuscule, reste minuscule » (BALEA → Balea)
//  - le 1ᵉʳ mot en minuscules → on capitalise sa 1ʳᵉ lettre (deo → Deo)
//  - les autres mots en minuscules / déjà mixtes → inchangés (balea → balea, iPhone → iPhone)
export function formatProductName(s: string): string {
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const hasLetter = /[a-zà-ÿ]/i.test(w);
      if (!hasLetter) return w;
      const isUpper = w === w.toUpperCase();
      const isLower = w === w.toLowerCase();
      if (isUpper) return cap(w);             // mot tout en majuscules
      if (i === 0 && isLower) return cap(w);  // 1ᵉʳ mot en minuscules
      return w;                                // sinon on ne touche pas
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
