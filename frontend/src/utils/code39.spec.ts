/**
 * Code39 — l'encodage que lisent les douchettes.
 *
 * Les étiquettes imprimées portaient des barres décoratives : personne ne
 * pouvait les scanner, et aucun test ne le voyait puisque rien ne plantait.
 * Ce test verrouille les propriétés STRUCTURELLES du vrai Code39 — c'est en
 * les respectant qu'un code devient lisible :
 *  - chaque caractère = 9 éléments alternés barre/espace, dont exactement
 *    3 larges (c'est la définition du « code 3 de 9 ») ;
 *  - un espace étroit entre deux caractères ;
 *  - « * » en ouverture et en fermeture ;
 *  - à l'impression, des largeurs en % qui préservent les rapports.
 */
import { describe, it, expect } from 'vitest';
import { CODE39_MAP, RAPPORT_LARGE, elementsCode39, totalUnites, barresHtml } from './code39';

describe('elementsCode39 — structure du code', () => {
  it('encode *TEXTE* : 9 éléments par caractère + 1 espace inter-caractère', () => {
    // 'A' → *A* = 3 caractères × 9 éléments + 2 espaces inter-caractères
    expect(elementsCode39('A')).toHaveLength(3 * 9 + 2);
  });

  it('alterne barre / espace à l’intérieur de chaque caractère', () => {
    const premierCar = elementsCode39('A').slice(0, 9);   // l'étoile ouvrante
    premierCar.forEach((e, i) => expect(e.barre).toBe(i % 2 === 0));
  });

  it('l’étoile ouvrante suit exactement son motif normalisé nwnnwnwnn', () => {
    const etoile = elementsCode39('A').slice(0, 9).map(e => e.unites);
    const attendu = 'nwnnwnwnn'.split('').map(c => (c === 'w' ? RAPPORT_LARGE : 1));
    expect(etoile).toEqual(attendu);
  });

  it('chaque caractère de la table contient exactement 3 éléments larges (« 3 de 9 »)', () => {
    for (const [car, motif] of Object.entries(CODE39_MAP)) {
      const larges = motif.split('').filter(c => c === 'w').length;
      expect(larges, `caractère « ${car} »`).toBe(3);
    }
  });

  it('les minuscules sont encodées comme les majuscules', () => {
    expect(elementsCode39('abc9')).toEqual(elementsCode39('ABC9'));
  });

  it('un caractère hors table est ignoré, le code reste encadré par les étoiles', () => {
    // 'É' n'existe pas en Code39 : il ne reste que *…* = 2×9 éléments + 1 espace
    expect(elementsCode39('É')).toHaveLength(2 * 9 + 1);
  });
});

describe('barresHtml — rendu imprimable', () => {
  const html = barresHtml('AB12');
  const elements = elementsCode39('AB12');

  it('produit un div par élément, barres noires et espaces transparents', () => {
    const divs = html.match(/<div /g) ?? [];
    expect(divs).toHaveLength(elements.length);
    const noirs = html.match(/background:#000/g) ?? [];
    expect(noirs).toHaveLength(elements.filter(e => e.barre).length);
  });

  it('les largeurs en % somment à 100 (rapports préservés à toute taille)', () => {
    const largeurs = [...html.matchAll(/width:([\d.]+)%/g)].map(m => parseFloat(m[1]));
    expect(largeurs).toHaveLength(elements.length);
    const somme = largeurs.reduce((s, l) => s + l, 0);
    expect(Math.abs(somme - 100)).toBeLessThan(0.1);
  });

  it('la largeur d’un élément large vaut RAPPORT_LARGE fois celle d’un étroit', () => {
    const largeurs = [...html.matchAll(/width:([\d.]+)%/g)].map(m => parseFloat(m[1]));
    const etroit = Math.min(...largeurs);
    const large  = Math.max(...largeurs);
    expect(large / etroit).toBeCloseTo(RAPPORT_LARGE, 2);
  });

  it('un texte sans aucun caractère encodable garde les étoiles (jamais un code vide silencieux)', () => {
    expect(totalUnites(elementsCode39(''))).toBeGreaterThan(0);
  });
});
