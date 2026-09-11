/**
 * Gouvernance des profils — `api/profils.ts` est le MIROIR de
 * `backend/src/settings/profils.ts` : mêmes modules et même accueil caissier
 * par type. Le backend pose les modules à la création d'une boutique ; le
 * frontend redirige le caissier. S'ils divergent, un caissier atterrit sur un
 * écran dont le module est désactivé.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PROFILS, accueilCaissier } from './profils';
import { TYPES_ETABLISSEMENT, MODULES_DISPONIBLES } from './settings';

const BACK = path.resolve(__dirname, '..', '..', '..', 'backend', 'src', 'settings', 'profils.ts');

/** Lit, par type, les modules et l'accueil déclarés côté backend. */
function profilsBackend(): Record<string, { modules: string[] | 'tous'; accueilCaissier: string }> {
  const src = fs.readFileSync(BACK, 'utf8');
  const bloc = src.match(/export const PROFILS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!bloc) throw new Error('PROFILS introuvable dans backend profils.ts');
  const out: Record<string, { modules: string[] | 'tous'; accueilCaissier: string }> = {};
  for (const m of bloc[1].matchAll(/^\s*([a-z]+):\s*\{\s*modules:\s*('tous'|\[[^\]]*\]).*?accueilCaissier:\s*'([^']+)'/gm)) {
    const modules = m[2] === "'tous'" ? 'tous' as const : [...m[2].matchAll(/'([a-z-]+)'/g)].map(x => x[1]);
    out[m[1]] = { modules, accueilCaissier: m[3] };
  }
  return out;
}

describe('profils — miroir frontend / backend', () => {
  const back = profilsBackend();

  it('le backend déclare un profil par type (sinon ce test ne prouve rien)', () => {
    expect(Object.keys(back).sort()).toEqual(TYPES_ETABLISSEMENT.map(x => x.id).slice().sort());
  });

  it('mêmes modules et même accueil, type par type', () => {
    for (const type of TYPES_ETABLISSEMENT.map(x => x.id)) {
      expect(PROFILS[type].modules, `${type} : modules`).toEqual(back[type].modules);
      expect(PROFILS[type].accueilCaissier, `${type} : accueil`).toBe(back[type].accueilCaissier);
    }
  });

  it('les modules cités existent, commerce reste « tous »', () => {
    expect(PROFILS.commerce.modules).toBe('tous');
    const ids = MODULES_DISPONIBLES.map(m => m.id) as readonly string[];
    for (const p of Object.values(PROFILS)) if (p.modules !== 'tous') for (const m of p.modules) expect(ids).toContain(m);
  });

  it('l’accueil retombe sur la caisse commerce tant que la route du profil n’existe pas', () => {
    const seulement = new Set(['/caisse-pin']);
    expect(accueilCaissier('snack', seulement)).toBe('/caisse-pin');
    expect(accueilCaissier('snack', new Set(['/caisse-pin', '/comptoir']))).toBe('/comptoir');
    expect(accueilCaissier('commerce', seulement)).toBe('/caisse-pin');
  });
});
