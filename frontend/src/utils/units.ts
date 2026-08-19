import { t } from '../i18n';

// Unités de MESURE (contenance d'un produit : ex. « 500 mL »).
// Elles décrivent le conditionnement du produit, PAS un nombre d'articles.
// On ne doit donc jamais les accoler à une quantité de stock (un compte).
const MEASURE_UNITS = new Set([
  'ml', 'mL', 'cl', 'cL', 'l', 'L', 'litre', 'litres',
  'g', 'mg', 'kg', 'gr', 'gramme', 'grammes',
]);

export function isMeasureUnit(unit?: string | null): boolean {
  if (!unit) return false;
  return MEASURE_UNITS.has(unit.trim());
}

// Libellés anglais des unités dénombrables (valeur stockée en base → affichage).
// Les valeurs techniques stockées en base restent en français ; seul l'affichage change.
const UNIT_LABELS_EN: Record<string, string> = {
  'unité': 'unit', 'pièce': 'pc', 'pce': 'pc',
  'boîte': 'box', 'boite': 'box', 'bouteille': 'bottle',
};

// Libellé d'unité à afficher À CÔTÉ D'UNE QUANTITÉ (un compte d'articles).
// - Unité de mesure (mL, g, …)  → on n'affiche rien : la quantité reste un simple nombre.
// - Unité dénombrable (pièce, boîte, sachet…) → on garde le mot tel quel (traduit si langue = en).
// `fallback` est utilisé quand aucune unité dénombrable n'est définie.
export function qtyUnitLabel(unit?: string | null, fallback = ''): string {
  if (!unit) return fallback;
  const u = unit.trim();
  if (!u || isMeasureUnit(u)) return fallback;
  return t(u, UNIT_LABELS_EN[u.toLowerCase()] ?? u);
}
