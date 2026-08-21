import { Product } from '../api/products';
import { contientTexte } from './text';

/** Statut de stock d'un produit : rupture, stock bas (≤ seuil d'alerte) ou OK. */
export type StockStatus = 'out' | 'low' | 'ok';

export function stockStatus(p: Pick<Product, 'stock' | 'alertThreshold'>): StockStatus {
  if (p.stock <= 0) return 'out';
  if (p.stock <= p.alertThreshold) return 'low';
  return 'ok';
}

/**
 * Termes par lesquels un utilisateur peut chercher un statut dans une zone de
 * recherche (« rupture », « stock bas », « en stock »…). FR et EN sont acceptés
 * quelle que soit la langue affichée, avec quelques synonymes courants.
 */
const STATUS_TERMS: Record<StockStatus, string[]> = {
  out: ['rupture', 'en rupture', 'épuisé', 'epuise', 'out of stock'],
  low: ['stock bas', 'bas', 'alerte', 'low stock'],
  // « ok » est volontairement absent : trop court, et le mot apparaît dans des
  // noms de produits — la recherche renvoyait des résultats parasites.
  ok:  ['en stock', 'disponible', 'in stock', 'available'],
};

/**
 * Vrai si la recherche `q` désigne le statut de stock du produit.
 * On exige que la recherche soit contenue dans un terme de statut (et non
 * l'inverse) pour qu'une saisie courte ne fasse pas remonter tout le catalogue :
 * « rup », « ruptu » ou « rupture » trouvent les ruptures. Minimum 3 caractères,
 * pour que des fragments fréquents dans les noms de produits (« en », « ok »)
 * ne déclenchent pas un filtrage par statut.
 */
export function matchesStockStatus(p: Pick<Product, 'stock' | 'alertThreshold'>, q: string): boolean {
  const s = q.trim();
  if (s.length < 3) return false;
  return STATUS_TERMS[stockStatus(p)].some(term => contientTexte(term, s));
}
