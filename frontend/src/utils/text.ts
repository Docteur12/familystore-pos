// Met en majuscule la première lettre de CHAQUE mot (Title Case),
// en laissant le reste tel que saisi (acronymes, unités « 500ml », etc.).
export function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
