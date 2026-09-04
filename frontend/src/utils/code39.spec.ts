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

describe('barresHtml — rendu imprimable (SVG)', () => {
  const html = barresHtml('AB12');
  const elements = elementsCode39('AB12');

  it('les barres sont des <rect> SVG — du CONTENU, pas des fonds : les fonds ne', () => {
    // s'impriment que si « Graphiques d'arrière-plan » est coché, et personne
    // ne le coche — l'étiquette sortait sans son code-barres.
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).not.toContain('background');
    const rects = html.match(/<rect /g) ?? [];
    expect(rects).toHaveLength(elements.filter(e => e.barre).length);
  });

  it('le viewBox couvre exactement le total des unités (rapports préservés à toute taille)', () => {
    expect(html).toContain(`viewBox="0 0 ${totalUnites(elements)} 10"`);
    expect(html).toContain('preserveAspectRatio="none"');
    // Sans crispEdges, l'anticrénelage grise les barres fines — flou au
    // thermique, illisible à la douchette.
    expect(html).toContain('shape-rendering="crispEdges"');
  });

  it('les rects se suivent sans se chevaucher, aux largeurs 1 ou RAPPORT_LARGE', () => {
    const rects = [...html.matchAll(/x="([\d.]+)" y="0" width="([\d.]+)"/g)]
      .map(m => ({ x: parseFloat(m[1]), w: parseFloat(m[2]) }));
    let precedent = -1;
    for (const r of rects) {
      expect(r.x).toBeGreaterThan(precedent);
      expect([1, RAPPORT_LARGE]).toContain(r.w);
      precedent = r.x;
    }
  });

  it('un texte sans aucun caractère encodable garde les étoiles (jamais un code vide silencieux)', () => {
    expect(totalUnites(elementsCode39(''))).toBeGreaterThan(0);
  });
});
