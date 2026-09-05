/**
 * Unités de produit — affichage selon la langue du magasin.
 *
 * L'unité est une DONNÉE saisie sur le produit, historiquement en français
 * (« pièce », « boîte ») — y compris chez Radiance, qui travaille en anglais :
 * ses étiquettes sortaient « pièce · 15 ». On ne réécrit pas la base ; on
 * traduit à l'affichage, comme les motifs de mouvement de stock.
 *
 * En français : la valeur saisie, telle quelle. En anglais : la traduction
 * des unités françaises connues, sinon la valeur telle quelle (ml, g, kg…
 * sont déjà internationaux).
 */
import { t } from '../i18n';

const UNITES_EN: Record<string, string> = {
  'pièce': 'piece', 'piece': 'piece', 'pce': 'pc',
  'boîte': 'box', 'boite': 'box',
  'sachet': 'sachet', 'paquet': 'pack', 'carton': 'carton',
  'bouteille': 'bottle', 'flacon': 'bottle',
  'pot': 'jar', 'tube': 'tube', 'lot': 'set', 'paire': 'pair',
  'rouleau': 'roll', 'plaquette': 'blister',
};

/** Traduction anglaise d'une unité — exportée seule pour être testable. */
export function uniteEn(unit?: string): string {
  const u = (unit ?? '').trim();
  if (!u) return '';
  return UNITES_EN[u.toLowerCase()] ?? u;
}

/** L'unité à afficher dans la langue courante du magasin. */
export function uniteAffichee(unit?: string): string {
  const u = (unit ?? '').trim();
  if (!u) return '';
  return t(u, uniteEn(u));
}
