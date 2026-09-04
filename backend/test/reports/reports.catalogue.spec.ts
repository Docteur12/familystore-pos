/**
 * Regroupement du catalogue produits — cas nominal.
 *
 * Le générateur PDF (`generateCataloguePdf`) rend un binaire qu'on ne peut pas
 * inspecter ligne à ligne. La logique qui compte vraiment — regrouper par
 * catégorie puis sous-catégorie, ordonner, dénombrer, appliquer la
 * nomenclature des noms — est donc isolée dans `grouperCatalogue`, et c'est
 * elle qu'on éprouve ici. Le PDF n'est plus qu'une mise en page de ce résultat.
 */
import { grouperCatalogue, SANS_CATEGORIE, SANS_SOUS_CATEGORIE } from '../../src/reports/reports.service';

describe('grouperCatalogue — catalogue par catégorie / sous-catégorie', () => {
  const produits = [
    { name: 'shampoing elseve',   category: 'Cosmétique / Hygiène',      subCategory: 'Hygiène capillaire', stock: 4,  stockMagazin: 10, price: 2500 },
    { name: 'savon dove',         category: 'Cosmétique / Hygiène',      subCategory: 'Hygiène corporelle', stock: 12, stockMagazin: 0,  price: 500  },
    { name: 'après-shampoing',    category: 'Cosmétique / Hygiène',      subCategory: 'Hygiène capillaire', stock: 2,  stockMagazin: 3,  price: 3000 },
    { name: 'riz 5 kg',           category: 'Alimentation / Boissons',   subCategory: 'Épicerie',           stock: 20, stockMagazin: 40, price: 8000 },
    { name: 'boisson gazeuse',    category: 'Alimentation / Boissons',   subCategory: '',                   stock: 6,  stockMagazin: 0,  price: 700  },
    { name: 'article divers',     category: '',                          subCategory: '',                   stock: 1,  stockMagazin: 0,  price: 100  },
  ];

  const groupes = grouperCatalogue(produits);

  it('crée une entrée par catégorie, « Sans catégorie » en dernier', () => {
    expect(groupes.map(g => g.categorie)).toEqual([
      'Alimentation / Boissons',
      'Cosmétique / Hygiène',
      SANS_CATEGORIE,
    ]);
  });

  it('compte les produits de chaque catégorie', () => {
    const parNom = Object.fromEntries(groupes.map(g => [g.categorie, g.nbProduits]));
    expect(parNom['Cosmétique / Hygiène']).toBe(3);
    expect(parNom['Alimentation / Boissons']).toBe(2);
    expect(parNom[SANS_CATEGORIE]).toBe(1);
  });

  it('trie les sous-catégories, « Sans sous-catégorie » en dernier', () => {
    const alim = groupes.find(g => g.categorie === 'Alimentation / Boissons')!;
    expect(alim.sousGroupes.map(s => s.sousCategorie)).toEqual(['Épicerie', SANS_SOUS_CATEGORIE]);

    const cosmeto = groupes.find(g => g.categorie === 'Cosmétique / Hygiène')!;
    expect(cosmeto.sousGroupes.map(s => s.sousCategorie)).toEqual(['Hygiène capillaire', 'Hygiène corporelle']);
  });

  it('trie les produits par nom dans une sous-catégorie', () => {
    const capillaire = groupes
      .find(g => g.categorie === 'Cosmétique / Hygiène')!
      .sousGroupes.find(s => s.sousCategorie === 'Hygiène capillaire')!;
    // nomProduit applique la nomenclature : « après-shampoing » → « Après-shampoing ».
    expect(capillaire.lignes.map(l => l.nom)).toEqual(['Après-shampoing', 'Shampoing Elseve']);
  });

  it('conserve stock boutique, stock entrepôt et prix, avec la nomenclature du nom', () => {
    const ligne = groupes
      .find(g => g.categorie === 'Cosmétique / Hygiène')!
      .sousGroupes.find(s => s.sousCategorie === 'Hygiène capillaire')!
      .lignes.find(l => l.nom === 'Shampoing Elseve')!;
    expect(ligne).toEqual({ nom: 'Shampoing Elseve', stock: 4, stockMagazin: 10, prix: 2500 });
  });

  it('un produit sans catégorie ET sans sous-catégorie tombe dans les deux replis', () => {
    const sans = groupes.find(g => g.categorie === SANS_CATEGORIE)!;
    expect(sans.sousGroupes).toHaveLength(1);
    expect(sans.sousGroupes[0].sousCategorie).toBe(SANS_SOUS_CATEGORIE);
    expect(sans.sousGroupes[0].lignes[0].nom).toBe('Article Divers');
  });

  it('nombres négatifs ou absents ramenés à 0 et arrondis', () => {
    const [g] = grouperCatalogue([
      { name: 'test', category: 'X', subCategory: 'Y', stock: -3, price: 12.7 },
    ]);
    expect(g.sousGroupes[0].lignes[0]).toEqual({ nom: 'Test', stock: 0, stockMagazin: 0, prix: 13 });
  });

  it('un catalogue vide donne une liste vide', () => {
    expect(grouperCatalogue([])).toEqual([]);
  });
});
