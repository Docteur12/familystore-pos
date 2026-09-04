/**
 * SKU et reconnaissance au scan — la boucle étiquette → douchette → caisse.
 *
 * Un produit sans code-barres fabricant reçoit un numéro interne sur son
 * étiquette ; la caisse doit le reconnaître, sinon « produit introuvable »
 * sur une étiquette que le magasin vient lui-même d'imprimer. Ce test
 * verrouille la boucle complète : ce que `skuProduit` fait imprimer,
 * `trouverParCode` doit le retrouver.
 */
import { describe, it, expect } from 'vitest';
import { skuProduit, trouverParCode, codeInterne, normaliserCode } from './sku';

const ID = '66f1a2b3c4d5e6f7a8b9c0d1';   // hex, comme un ObjectId Mongo

const avecCode  = { _id: ID, barcode: '6151234567890' };
const sansCode  = { _id: ID };
const autre     = { _id: '000000000000000000000000', barcode: '4005900123456' };

describe('skuProduit — ce que porte l’étiquette', () => {
  it('un produit avec code-barres garde son code fabricant', () => {
    expect(skuProduit(avecCode)).toBe('6151234567890');
  });

  it('sans code-barres : numéro interne = 9 derniers caractères de l’identifiant, tiretés', () => {
    // …c4d5e6f7a8b9c0d1 → 9 derniers : 7A8B9C0D1 → affiché 7A8-B9C-0D1
    expect(skuProduit(sansCode)).toBe('7A8-B9C-0D1');
  });
});

describe('trouverParCode — la douchette retrouve le produit', () => {
  const produits = [autre, sansCode, avecCode];

  it('retrouve par code-barres fabricant', () => {
    expect(trouverParCode(produits, '6151234567890')).toBe(avecCode);
  });

  it('boucle complète : le numéro interne imprimé (sans tirets, tel que scanné) retrouve le produit', () => {
    // L'étiquette encode le SKU débarrassé des tirets — c'est ce que lit la douchette.
    const scanne = normaliserCode(skuProduit(sansCode));
    expect(scanne).toBe('7A8B9C0D1');
    expect(trouverParCode(produits, scanne)).toBe(sansCode);
  });

  it('tolère tirets, espaces et casse dans le code scanné', () => {
    expect(trouverParCode(produits, '7a8-b9c-0d1')).toBe(sansCode);
    expect(trouverParCode(produits, ' 615 1234 567890 ')).toBe(avecCode);
  });

  it('un code fabricant renseigné fait foi : le numéro interne ne matche JAMAIS un produit à code-barres', () => {
    // `avecCode` partage l'_id de `sansCode` : son code interne serait identique.
    // Seul le produit SANS code-barres doit répondre au numéro interne.
    expect(trouverParCode([avecCode], codeInterne(avecCode))).toBeNull();
  });

  it('code inconnu ou vide → null (l’appelant tente alors le backend)', () => {
    expect(trouverParCode(produits, 'ZZZZZZZZZ')).toBeNull();
    expect(trouverParCode(produits, '   ')).toBeNull();
  });
});
