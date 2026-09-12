/**
 * Règles pures du panier du comptoir (profil Snack-bar).
 *
 * Contrats :
 *  - la consigne d'une bouteille est une ligne À PART de la vente, `divers`
 *    (pas de stock), portant `product`, nommée par le préfixe reconnu du
 *    rapport backend — jamais un prix négatif, jamais fondue dans le prix ;
 *  - le total encaissé = articles + consignes ; la part « articles » reste
 *    lisible (c'est elle, le chiffre d'affaires) ;
 *  - le panier ne dépasse jamais le stock (le serveur refuserait la vente) ;
 *  - les trois modes de paiement sont ceux de la caisse, pas un de plus.
 */
import { describe, it, expect } from 'vitest';
import type { Product } from '../api/products';
import {
  PREFIXE_LIGNE_CONSIGNE, MODES_PAIEMENT_COMPTOIR, carteConsignes, ajouterAuPanier, changerQuantite, casiersEtBouteilles,
  basculerConsigne, totauxPanier, lignesDeVente, chargeDeVente, categoriesDuCatalogue,
} from './comptoir-panier';

const produit = (p: Partial<Product> & { _id: string; name: string; price: number }): Product => ({
  costPrice: 0, stock: 10, alertThreshold: 2, unit: 'bouteille', ...p,
});

const biere = produit({ _id: 'b1', name: 'beaufort 65cl', price: 700, stock: 5, category: 'bières' });
const eau   = produit({ _id: 'e1', name: 'supermont 1L', price: 500, stock: 20, category: 'eaux' });
const rhum  = produit({ _id: 'r1', name: 'rhum', price: 1000, stock: 0, category: 'spiritueux' });
const CONSIGNES = carteConsignes([
  { product: 'b1', bouteillesParCasier: 24, consigne: 200, videsEnReserve: 0 },
  { product: 'e1', bouteillesParCasier: 12, consigne: 0,   videsEnReserve: 0 },
]);

describe('panier du comptoir', () => {
  it('carteConsignes ne garde que les consignes strictement positives', () => {
    expect(CONSIGNES).toEqual({ b1: 200 });
  });

  it('ajouter : crée la ligne avec consigne si le produit en porte une, incrémente ensuite, plafonne au stock, ignore les ruptures', () => {
    let p = ajouterAuPanier([], biere, CONSIGNES);
    expect(p).toEqual([{ product: biere, quantity: 1, consigne: true }]);
    p = ajouterAuPanier(p, eau, CONSIGNES);
    expect(p[1]).toEqual({ product: eau, quantity: 1, consigne: false });
    for (let i = 0; i < 10; i++) p = ajouterAuPanier(p, biere, CONSIGNES);
    expect(p[0].quantity).toBe(5);                       // stock = 5
    expect(ajouterAuPanier(p, rhum, CONSIGNES)).toHaveLength(2);  // rupture : rien
  });

  it('changerQuantite : borne au stock, zéro retire la ligne', () => {
    let p = ajouterAuPanier([], biere, CONSIGNES);
    p = changerQuantite(p, 'b1', +10);
    expect(p[0].quantity).toBe(5);
    p = changerQuantite(p, 'b1', -5);
    expect(p).toHaveLength(0);
  });

  it('totaux : articles + consignes, la consigne désactivable ligne par ligne', () => {
    let p = ajouterAuPanier(ajouterAuPanier([], biere, CONSIGNES), biere, CONSIGNES);   // 2 bières
    p = ajouterAuPanier(p, eau, CONSIGNES);                                             // 1 eau
    expect(totauxPanier(p, CONSIGNES)).toEqual({ articles: 1900, consignes: 400, total: 2300, nbConsignes: 2 });

    p = basculerConsigne(p, 'b1');   // client venu avec ses vides
    expect(totauxPanier(p, CONSIGNES)).toEqual({ articles: 1900, consignes: 0, total: 1900, nbConsignes: 0 });
  });

  it('lignesDeVente : une ligne référencée par article, une ligne divers « Consigne … » par bouteille consignée', () => {
    const p = ajouterAuPanier(ajouterAuPanier(ajouterAuPanier([], biere, CONSIGNES), biere, CONSIGNES), eau, CONSIGNES);
    const lignes = lignesDeVente(p, CONSIGNES);
    expect(lignes).toEqual([
      { product: 'b1', name: 'beaufort 65cl', quantity: 2, unitPrice: 700 },
      { product: 'b1', divers: true, name: `${PREFIXE_LIGNE_CONSIGNE}Beaufort 65cl`, quantity: 2, unitPrice: 200 },
      { product: 'e1', name: 'supermont 1L', quantity: 1, unitPrice: 500 },
    ]);
    // Aucun prix négatif, jamais : Sale.unitPrice a min 0.
    expect(lignes.every(l => l.unitPrice >= 0)).toBe(true);
    // Le préfixe est celui que le rapport backend reconnaît.
    expect(PREFIXE_LIGNE_CONSIGNE).toBe('Consigne ');
  });

  it('chargeDeVente : total juste, montant remis ≥ total, mode et clé transmis, session facultative', () => {
    const p = ajouterAuPanier([], biere, CONSIGNES);
    const c = chargeDeVente(p, CONSIGNES, { mode: 'cash', montantRemis: 1000 }, 'cle-1', 'sess-1');
    expect(c).toMatchObject({ total: 900, subtotal: 900, amountPaid: 1000, paymentMethod: 'cash', idempotencyKey: 'cle-1', sessionId: 'sess-1' });
    expect(c.items).toHaveLength(2);

    // Mobile Money : le montant remis est le total, quoi qu'on ait tapé.
    const m = chargeDeVente(p, CONSIGNES, { mode: 'mobile_money', montantRemis: 5000 }, 'cle-2');
    expect(m.amountPaid).toBe(900);
    expect(m).not.toHaveProperty('sessionId');

    // Espèces sans montant saisi : compte exact.
    expect(chargeDeVente(p, CONSIGNES, { mode: 'cash' }, 'cle-3').amountPaid).toBe(900);
    // Montant remis inférieur au total : jamais envoyé tel quel (le serveur exige amountPaid ≥ 0, la caisse ≥ total).
    expect(chargeDeVente(p, CONSIGNES, { mode: 'cash', montantRemis: 100 }, 'cle-4').amountPaid).toBe(900);
  });

  it('modes de paiement : les trois de la caisse commerce, dans cet ordre', () => {
    expect(MODES_PAIEMENT_COMPTOIR.map(m => m.value)).toEqual(['cash', 'mobile_money', 'card']);
  });

  it('categoriesDuCatalogue : ordre d’apparition, sans doublon ni vide', () => {
    expect(categoriesDuCatalogue([biere, eau, rhum, produit({ _id: 'x', name: 'x', price: 1, category: '' }), biere]))
      .toEqual(['bières', 'eaux', 'spiritueux']);
  });
});
