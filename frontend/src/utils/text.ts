// Couleur de la boutique résolue depuis la variable CSS (--fs-wine-700).
// Utile pour les graphiques (recharts) où var() ne fonctionne pas dans le SVG.
export function getBrandColor(fallback = '#FF0000'): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fs-wine-700').trim();
  return v || fallback;
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
