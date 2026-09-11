/**
 * Préréglages par type — la table unique de la gamme (settings/profils.ts).
 *
 * Commerce doit rester le comportement historique : modules « tous » (liste
 * vide dans Settings), aucune règle métier forcée. Chaque autre type ne cite
 * que des modules qui existent, et son écran d'accueil est une route.
 */
import { PROFILS, prereglage, estTypeEtablissement } from '../../src/settings/profils';
import { MODULES_DISPONIBLES, TYPES_ETABLISSEMENT } from '../../src/settings/settings.schema';

describe('profils de la gamme', () => {
  it('chaque type a un profil, et rien d’autre', () => {
    expect(Object.keys(PROFILS).sort()).toEqual([...TYPES_ETABLISSEMENT].sort());
  });

  it('commerce = tout actif, aucune règle forcée : le comportement historique', () => {
    expect(PROFILS.commerce.modules).toBe('tous');
    expect(PROFILS.commerce.metier).toEqual({});
    expect(PROFILS.commerce.accueilCaissier).toBe('/caisse-pin');
    expect(prereglage('commerce', { inactiviteMinutes: 10 })).toEqual({ typeEtablissement: 'commerce', modules: [], metier: { inactiviteMinutes: 10 } });
  });

  it('les autres types ne citent que des modules déclarés, et un accueil qui est une route', () => {
    for (const type of TYPES_ETABLISSEMENT) {
      const p = PROFILS[type];
      if (p.modules !== 'tous') {
        for (const m of p.modules) expect(MODULES_DISPONIBLES).toContain(m);
        expect(p.modules.length).toBeGreaterThan(0);
      }
      expect(p.accueilCaissier).toMatch(/^\/[a-z-]+$/);
    }
  });

  it('le préréglage fusionne les règles métier sans perdre les défauts', () => {
    const p = prereglage('hotel', { inactiviteMinutes: 10, seedFournisseursDemo: true, suiviPeremption: true });
    expect(p).toEqual({
      typeEtablissement: 'hotel', modules: ['reception'],
      metier: { inactiviteMinutes: 10, seedFournisseursDemo: false, suiviPeremption: false },
    });
  });

  it('estTypeEtablissement ne laisse passer que la liste', () => {
    expect(estTypeEtablissement('snack')).toBe(true);
    expect(estTypeEtablissement('pharmacie')).toBe(false);
    expect(estTypeEtablissement(undefined)).toBe(false);
  });
});
