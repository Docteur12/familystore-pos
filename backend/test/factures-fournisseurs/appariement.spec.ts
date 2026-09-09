/**
 * Appariement des lignes de facture aux produits — une PROPOSITION fiable.
 *
 * Code-barres imprimé d'abord (la clé la plus sûre), libellé normalisé
 * ensuite, « nouveau » sinon. Un faux appariement ferait entrer du stock sur
 * le mauvais produit : mieux vaut proposer « nouveau » que se tromper.
 */
import { apparierLignes, normaliserLibelle } from '../../src/factures-fournisseurs/appariement';

const produits = [
  { _id: 'p1', name: 'Savon Dove Original 90g', barcode: '8720181240751' },
  { _id: 'p2', name: 'Robe Enfant Coton Bleu 4 Ans', barcode: null },
  { _id: 'p3', name: 'Shampoing Elseve', barcode: '3600523000000' },
];
const ligne = (designation: string, reference: string | null = null) =>
  ({ designation, quantite: 1, prixUnitaire: 100, prixTotal: 100, reference });

describe('normaliserLibelle', () => {
  it('ignore casse, accents, ponctuation et espaces multiples', () => {
    expect(normaliserLibelle('  Robe   Enfant, Coton-Bleu (4 ans) ')).toBe('robe enfant coton bleu 4 ans');
    expect(normaliserLibelle('Élève')).toBe('eleve');
  });
});

describe('apparierLignes', () => {
  it('apparie par code-barres imprimé, même avec des espaces ou tirets', () => {
    const [l] = apparierLignes([ligne('SAVON DOVE (libellé différent)', '8720 1812 40751')], produits);
    expect(l).toMatchObject({ produitId: 'p1', produitNom: 'Savon Dove Original 90g', appariement: 'existant' });
  });

  it('sinon apparie par libellé normalisé', () => {
    const [l] = apparierLignes([ligne('robe enfant coton bleu 4 ans')], produits);
    expect(l).toMatchObject({ produitId: 'p2', appariement: 'existant' });
  });

  it('le code-barres prime sur le libellé quand les deux existent', () => {
    // Libellé = Robe, code = Shampoing → c'est le code qui fait foi.
    const [l] = apparierLignes([ligne('Robe Enfant Coton Bleu 4 ans', '3600523000000')], produits);
    expect(l.produitId).toBe('p3');
  });

  it('propose « nouveau » quand rien ne correspond — jamais un rapprochement approximatif', () => {
    const [l] = apparierLignes([ligne('Savon Dove Original 100g')], produits);   // 100g ≠ 90g
    expect(l).toMatchObject({ produitId: null, produitNom: null, appariement: 'nouveau' });
  });

  it('conserve les données lues de chaque ligne', () => {
    const [l] = apparierLignes([{ designation: 'X', quantite: 3, prixUnitaire: 250, prixTotal: 750, reference: null }], []);
    expect(l).toMatchObject({ designation: 'X', quantite: 3, prixUnitaire: 250, prixTotal: 750, appariement: 'nouveau' });
  });
});
