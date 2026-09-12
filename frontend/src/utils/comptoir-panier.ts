/**
 * Règles PURES du panier du comptoir (profil Snack-bar) — testées seules dans
 * `comptoir-panier.spec.ts`, sans réseau ni DOM.
 *
 * L'encaissement lui-même passe par `createSale` (`api/products.ts`, route
 * `POST /api/sales`) : le comptoir ne fait que construire le bon panier.
 */
import type { Product, SalePayload } from '../api/products';
import { effectivePrice } from '../api/products';
import type { ConditionnementSnack } from '../api/comptoir';
import { displayName } from './text';
import { t } from '../i18n';

/**
 * Préfixe du nom des lignes de consigne dans une vente.
 * MIROIR de `PREFIXE_LIGNE_CONSIGNE` dans `backend/src/comptoir/motifs.ts` :
 * le rapport des consignes du jour reconnaît les lignes par ce préfixe.
 */
export const PREFIXE_LIGNE_CONSIGNE = 'Consigne ';

/** Modes de paiement du comptoir — les trois de la caisse, pas un de plus. */
export const MODES_PAIEMENT_COMPTOIR = [
  { value: 'cash',         label: t('Espèces', 'Cash') },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card',         label: t('Carte', 'Card') },
] as const;
export type ModePaiementComptoir = (typeof MODES_PAIEMENT_COMPTOIR)[number]['value'];

export interface LignePanier {
  product:  Product;
  quantity: number;
  /** La consigne est facturée pour cette ligne (défaut : oui si le produit en porte une). */
  consigne: boolean;
}

export type CartePrixConsigne = Record<string, number>;   // productId → consigne unitaire

/** Carte productId → consigne, depuis la liste des conditionnements. */
export function carteConsignes(conds: ConditionnementSnack[]): CartePrixConsigne {
  const c: CartePrixConsigne = {};
  for (const x of conds) if (x.consigne > 0) c[x.product] = x.consigne;
  return c;
}

/** Ajoute une unité au panier (ou crée la ligne), sans dépasser le stock. */
export function ajouterAuPanier(panier: LignePanier[], produit: Product, consignes: CartePrixConsigne): LignePanier[] {
  const existante = panier.find(l => l.product._id === produit._id);
  if (existante) {
    if (existante.quantity >= produit.stock) return panier;
    return panier.map(l => l.product._id === produit._id ? { ...l, quantity: l.quantity + 1 } : l);
  }
  if (produit.stock <= 0) return panier;
  return [...panier, { product: produit, quantity: 1, consigne: (consignes[produit._id] ?? 0) > 0 }];
}

/** Change la quantité d'une ligne ; 0 la retire ; borné par le stock. */
export function changerQuantite(panier: LignePanier[], productId: string, delta: number): LignePanier[] {
  return panier
    .map(l => l.product._id === productId
      ? { ...l, quantity: Math.min(l.product.stock, l.quantity + delta) }
      : l)
    .filter(l => l.quantity > 0);
}

export function basculerConsigne(panier: LignePanier[], productId: string): LignePanier[] {
  return panier.map(l => l.product._id === productId ? { ...l, consigne: !l.consigne } : l);
}

export interface TotauxPanier {
  articles:    number;   // montant des produits (chiffre d'affaires)
  consignes:   number;   // montant des consignes (pas du CA)
  total:       number;   // ce que le client paie
  nbConsignes: number;
}

export function totauxPanier(panier: LignePanier[], consignes: CartePrixConsigne): TotauxPanier {
  let articles = 0, cons = 0, nb = 0;
  for (const l of panier) {
    articles += effectivePrice(l.product) * l.quantity;
    const c = consignes[l.product._id] ?? 0;
    if (l.consigne && c > 0) { cons += c * l.quantity; nb += l.quantity; }
  }
  return { articles, consignes: cons, total: articles + cons, nbConsignes: nb };
}

/**
 * Lignes de vente envoyées au serveur : un article = une ligne référencée
 * (stock décrémenté) ; sa consigne = une ligne À PART, `divers` (aucun stock),
 * portant `product` (pour agréger par produit) et nommée par le préfixe.
 * `Sale.unitPrice` a `min: 0` : jamais de ligne négative ici — le retour de
 * vide passe par `retournerVides` (`api/comptoir.ts`).
 */
export function lignesDeVente(panier: LignePanier[], consignes: CartePrixConsigne): SalePayload['items'] {
  const items: SalePayload['items'] = [];
  for (const l of panier) {
    items.push({ product: l.product._id, name: l.product.name, quantity: l.quantity, unitPrice: effectivePrice(l.product) });
    const c = consignes[l.product._id] ?? 0;
    if (l.consigne && c > 0) {
      items.push({
        product:   l.product._id,
        divers:    true,
        name:      `${PREFIXE_LIGNE_CONSIGNE}${displayName(l.product.name)}`,
        quantity:  l.quantity,
        unitPrice: c,
      });
    }
  }
  return items;
}

/** Charge de vente complète pour `POST /api/sales`. */
export function chargeDeVente(
  panier: LignePanier[],
  consignes: CartePrixConsigne,
  paiement: { mode: ModePaiementComptoir; montantRemis?: number },
  idempotencyKey: string,
  sessionId?: string,
): SalePayload {
  const tx = totauxPanier(panier, consignes);
  const remis = paiement.mode === 'cash' && paiement.montantRemis != null && paiement.montantRemis > 0
    ? paiement.montantRemis
    : tx.total;
  return {
    items:         lignesDeVente(panier, consignes),
    total:         tx.total,
    subtotal:      tx.total,
    paymentMethod: paiement.mode,
    amountPaid:    Math.max(remis, tx.total),
    idempotencyKey,
    ...(sessionId ? { sessionId } : {}),
  };
}

/** Catégories présentes, dans l'ordre d'apparition (sans vide ni doublon). */
export function categoriesDuCatalogue(produits: Product[]): string[] {
  const vues: string[] = [];
  for (const p of produits) {
    const c = (p.category ?? '').trim();
    if (c && !vues.includes(c)) vues.push(c);
  }
  return vues;
}

/** Conversion bouteilles → casiers pleins + bouteilles seules (miroir de `casiersEtBouteilles` côté serveur). */
export function casiersEtBouteilles(bouteilles: number, parCasier: number): { casiers: number; seules: number } {
  if (parCasier <= 0) return { casiers: 0, seules: Math.max(0, bouteilles) };
  const b = Math.max(0, bouteilles);
  return { casiers: Math.floor(b / parCasier), seules: b % parCasier };
}
