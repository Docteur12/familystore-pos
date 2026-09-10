/**
 * Suivi des péremptions — la règle lue par toute l'interface.
 *
 * Gestion de stock (colonne, indicateur, onglet) et formulaire produit
 * s'appuient sur `suiviPeremptionActif`. Le défaut doit rester « oui » pour
 * les magasins existants (documents Settings sans le champ) : Family Store
 * et Radiance ne doivent voir aucun changement.
 */
import { describe, it, expect } from 'vitest';
import { suiviPeremptionActif, METIER_DEFAULTS } from './settings';

describe('suiviPeremptionActif', () => {
  it('absent → actif (magasins existants inchangés)', () => {
    expect(suiviPeremptionActif({})).toBe(true);
    expect(suiviPeremptionActif({ metier: {} })).toBe(true);
    expect(suiviPeremptionActif({ metier: { inactiviteMinutes: 10 } })).toBe(true);
  });

  it('false → désactivé (vêtements, HERVAN)', () => {
    expect(suiviPeremptionActif({ metier: { suiviPeremption: false } })).toBe(false);
  });

  it('true explicite → actif, et c’est la valeur par défaut des réglages', () => {
    expect(suiviPeremptionActif({ metier: { suiviPeremption: true } })).toBe(true);
    expect(METIER_DEFAULTS.suiviPeremption).toBe(true);
  });
});
