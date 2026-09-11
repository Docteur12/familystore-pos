/**
 * Consolidé à types mélangés — sous-totaux justes, et rien de plus pour un
 * propriétaire mono-type.
 */
import { describe, it, expect } from 'vitest';
import { typesPresents, sousTotauxParType, pictoType } from './consolide';

const ligne = (nom: string, type: string | undefined, ca: number, ventes: number) =>
  ({ boutiqueId: nom, nom, typeEtablissement: type as never, ca, ventes, panierMoyen: ventes ? Math.round(ca / ventes) : 0 });

describe('consolidé à types mélangés', () => {
  it('regroupe par type, dans l’ordre d’apparition, avec panier moyen recalculé', () => {
    const rapport = { boutiques: [ligne('Akwa', 'commerce', 100_000, 10), ligne('Deido', 'snack', 30_000, 20), ligne('Bonapriso', 'commerce', 50_000, 5)] };
    expect(typesPresents(rapport)).toEqual(['commerce', 'snack']);
    expect(sousTotauxParType(rapport)).toEqual([
      { type: 'commerce', ca: 150_000, ventes: 15, boutiques: 2, panierMoyen: 10_000 },
      { type: 'snack',    ca: 30_000,  ventes: 20, boutiques: 1, panierMoyen: 1_500 },
    ]);
  });

  it('un type absent (serveur ancien) compte comme commerce', () => {
    const rapport = { boutiques: [ligne('Akwa', undefined, 1000, 1), ligne('Deido', 'commerce', 1000, 1)] };
    expect(typesPresents(rapport)).toEqual(['commerce']);
    expect(sousTotauxParType(rapport)).toHaveLength(1);
  });

  it('le pictogramme n’apparaît que si les métiers sont mélangés', () => {
    const monoType = [ligne('A', 'commerce', 0, 0), ligne('B', 'commerce', 0, 0)];
    expect(pictoType('commerce', monoType)).toBe('');
    const mixte = [ligne('A', 'commerce', 0, 0), ligne('B', 'hotel', 0, 0)];
    expect(pictoType('hotel', mixte)).toBe('🛏 ');
    expect(pictoType(undefined, mixte)).toBe('🛍 ');
  });
});
