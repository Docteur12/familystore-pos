/**
 * Gouvernance des types d'établissement — frontend et backend connaissent la
 * MÊME liste, et chaque type a un libellé lisible.
 *
 * Un type ajouté d'un seul côté donnerait soit un choix refusé au clic (front
 * en avance), soit un profil que personne ne peut choisir (back en avance).
 * Même approche que modules-governance : on lit les SOURCES.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TYPES_ETABLISSEMENT } from './settings';

const BACK = path.resolve(__dirname, '..', '..', '..', 'backend', 'src', 'settings', 'settings.schema.ts');

function idsBackend(): string[] {
  const src = fs.readFileSync(BACK, 'utf8');
  const bloc = src.match(/TYPES_ETABLISSEMENT\s*=\s*\[([^\]]*)\]\s*as const/);
  if (!bloc) throw new Error('TYPES_ETABLISSEMENT introuvable dans settings.schema.ts');
  return [...bloc[1].matchAll(/'([a-z]+)'/g)].map(m => m[1]);
}

describe('types d’établissement — miroir frontend / backend', () => {
  const back = idsBackend();

  it('les deux listes existent (sinon ce test ne prouve rien)', () => {
    expect(back.length).toBeGreaterThanOrEqual(4);
    expect(TYPES_ETABLISSEMENT.length).toBeGreaterThanOrEqual(4);
  });

  it('mêmes identifiants, exactement, et commerce en tête (le défaut)', () => {
    expect(TYPES_ETABLISSEMENT.map(x => x.id).slice().sort()).toEqual([...back].sort());
    expect(back[0]).toBe('commerce');
    expect(TYPES_ETABLISSEMENT[0].id).toBe('commerce');
  });

  it('chaque type a un libellé lisible', () => {
    for (const x of TYPES_ETABLISSEMENT) {
      expect(x.label.trim(), `${x.id} : libellé vide`).not.toBe('');
      expect(x.label).not.toBe(x.id);
    }
  });
});
