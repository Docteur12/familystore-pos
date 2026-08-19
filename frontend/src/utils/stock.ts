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
  out: ['rupture', 'en rupture', 'épuisé', 'epuise', 'out of stock', 'out'],
  low: ['stock bas', 'bas', 'alerte', 'low stock', 'low'],
  ok:  ['ok', 'en stock', 'disponible', 'in stock', 'available'],
};

/**
 * Vrai si la recherche `q` désigne le statut de stock du produit.
 * On exige que la recherche soit contenue dans un terme de statut (et non
 * l'inverse) pour qu'une lettre isolée ne fasse pas remonter tout le catalogue :
 * « rup », « ruptu » ou « rupture » trouvent les ruptures ; « r » seul ne compte
 * pas (moins de 2 caractères).
 */
export function matchesStockStatus(p: Pick<Product, 'stock' | 'alertThreshold'>, q: string): boolean {
  const s = q.trim();
  if (s.length < 2) return false;
  return STATUS_TERMS[stockStatus(p)].some(term => contientTexte(term, s));
}
