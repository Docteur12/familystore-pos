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

/** Unités de CONDITIONNEMENT : elles ne disent rien de la taille d'un article. */
const UNITES_GENERIQUES = new Set(['', 'unité', 'unite', 'pièce', 'piece', 'pce', 'boîte', 'boite', 'sachet', 'paquet', 'carton', 'bouteille', 'flacon', 'pot', 'tube', 'lot', 'paire', 'rouleau', 'plaquette', 'pack']);

/** Unités de taille proposées à la création d'un produit (vêtements, chaussures). */
export const UNITES_TAILLE = ['ans', 'mois', 'taille', 'pointure'] as const;

/**
 * La DÉCLINAISON d'un article, telle qu'on l'imprime en gros sur une étiquette
 * de vêtement : « 4 ans », « 6 mois », « T. 110 », « P. 28 » — ou une
 * contenance (« 250 mL »). Vide quand le couple unité/valeur ne dit rien de
 * la taille (pièce, boîte…) ou qu'aucune valeur n'est saisie.
 *
 * HERVAN Élite (19/09/2026) : vêtements pour enfants, une fiche par taille —
 * c'est la taille que le client cherche en premier sur un portant.
 */
export function declinaison(unit?: string, valeur?: string): string {
  const u = (unit ?? '').trim();
  const v = (valeur ?? '').trim();
  if (!v) return '';
  const ul = u.toLowerCase();
  if (ul === 'ans')      return t(`${v} ${v === '1' ? 'an' : 'ans'}`, `${v} ${v === '1' ? 'yr' : 'yrs'}`);
  if (ul === 'mois')     return t(`${v} mois`, `${v} mo`);
  if (ul === 'taille')   return t(`T. ${v}`, `Size ${v}`);
  if (ul === 'pointure') return t(`P. ${v}`, `Size ${v}`);
  if (UNITES_GENERIQUES.has(ul)) return '';
  return `${v} ${u}`;
}

/** L'unité à afficher dans la langue courante du magasin. */
export function uniteAffichee(unit?: string): string {
  const u = (unit ?? '').trim();
  if (!u) return '';
  return t(u, uniteEn(u));
}
