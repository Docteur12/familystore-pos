/**
 * Seuils d'alerte de licence.
 *
 * Une erreur de seuil ne se voit pas à l'œil : il faudrait attendre le bon
 * nombre de jours pour la constater, et à ce moment-là le commerçant est déjà
 * surpris. D'où des tests sur les bornes exactes.
 */
import { describe, it, expect } from 'vitest';
import { niveauAlerte, doitAlerter, seuilAtteint, SEUILS_ALERTE } from './licence';

describe('niveau d’alerte de licence', () => {
  it('ne dérange pas tant que l’échéance est lointaine', () => {
    expect(niveauAlerte(365)).toBe('aucun');
    expect(niveauAlerte(15)).toBe('aucun');
    expect(doitAlerter(15)).toBe(false);
  });

  it('monte par paliers à mesure que l’échéance approche', () => {
    expect(niveauAlerte(14)).toBe('info');    // premier avertissement
    expect(niveauAlerte(8)).toBe('info');
    expect(niveauAlerte(7)).toBe('proche');
    expect(niveauAlerte(4)).toBe('proche');
    expect(niveauAlerte(3)).toBe('urgent');
    expect(niveauAlerte(1)).toBe('urgent');
    expect(niveauAlerte(0)).toBe('urgent');   // dernier jour, encore couvert
  });

  it('les bornes appartiennent au palier le plus urgent', () => {
    // Le jour J-7 doit déjà être « proche », pas encore « info » : c'est le
    // genre de décalage d'un cran qui fait rater un rappel.
    expect(niveauAlerte(7)).not.toBe('info');
    expect(niveauAlerte(3)).not.toBe('proche');
  });

  it('expirée l’emporte sur tout — les jours restants n’ont plus de sens', () => {
    expect(niveauAlerte(-5, true)).toBe('expire');
    expect(niveauAlerte(200, true)).toBe('expire');
    expect(doitAlerter(200, true)).toBe(true);
  });

  it('sans information de durée, on ne crie pas au loup', () => {
    expect(niveauAlerte(undefined)).toBe('aucun');
    expect(doitAlerter(undefined)).toBe(false);
  });
});

describe('seuil de relance', () => {
  it('rend le seuil franchi le plus proche', () => {
    expect(seuilAtteint(14)).toBe(14);
    expect(seuilAtteint(10)).toBe(14);   // le rappel des 14 jours reste dû
    expect(seuilAtteint(7)).toBe(7);
    expect(seuilAtteint(5)).toBe(7);
    expect(seuilAtteint(3)).toBe(3);
    expect(seuilAtteint(2)).toBe(3);
    expect(seuilAtteint(1)).toBe(1);
    expect(seuilAtteint(0)).toBe(1);
  });

  it('ne relance pas trop tôt', () => {
    expect(seuilAtteint(15)).toBeNull();
    expect(seuilAtteint(365)).toBeNull();
  });

  it('les seuils sont ordonnés du plus lointain au plus proche', () => {
    expect([...SEUILS_ALERTE]).toEqual([14, 7, 3, 1]);
    const decroissant = [...SEUILS_ALERTE].every((s, i, a) => i === 0 || a[i - 1] > s);
    expect(decroissant).toBe(true);
  });
});
