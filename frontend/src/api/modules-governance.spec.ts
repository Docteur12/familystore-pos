/**
 * Gouvernance des modules optionnels — le frontend et le backend doivent
 * connaître exactement la MÊME liste d'identifiants.
 *
 * Un module optionnel se déclare deux fois : côté backend (validation des
 * Paramètres) et côté frontend (menus, routes, libellé dans l'écran des
 * paramètres). Écrit à la main des deux côtés, l'un finit par oublier l'autre :
 * un module activable que le frontend n'affiche jamais, ou l'inverse — sans
 * qu'aucun test ne bronche, puisque rien ne plante.
 *
 * Même approche que motifs-stock-governance : on lit les SOURCES.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FRONT = path.resolve(__dirname, 'settings.ts');
const BACK  = path.resolve(__dirname, '..', '..', '..', 'backend', 'src', 'settings', 'settings.schema.ts');

function idsBackend(): string[] {
  const src = fs.readFileSync(BACK, 'utf8');
  const bloc = src.match(/MODULES_DISPONIBLES\s*=\s*\[([^\]]*)\]\s*as const/);
  if (!bloc) throw new Error('MODULES_DISPONIBLES introuvable dans settings.schema.ts');
  return [...bloc[1].matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
}

function idsFrontend(): { id: string; label: string }[] {
  const src = fs.readFileSync(FRONT, 'utf8');
  const bloc = src.match(/MODULES_DISPONIBLES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!bloc) throw new Error('MODULES_DISPONIBLES introuvable dans api/settings.ts');
  return [...bloc[1].matchAll(/id:\s*'([a-z-]+)',\s*label:\s*'([^']*)'/g)].map(m => ({ id: m[1], label: m[2] }));
}

describe('modules optionnels — miroir frontend / backend', () => {
  const back = idsBackend();
  const front = idsFrontend();

  it('les deux listes existent (sinon ce test ne prouve rien)', () => {
    expect(back.length).toBeGreaterThanOrEqual(2);
    expect(front.length).toBeGreaterThanOrEqual(2);
  });

  it('mêmes identifiants, exactement', () => {
    expect(front.map(m => m.id).sort()).toEqual([...back].sort());
  });

  it('chaque module a un libellé lisible côté frontend', () => {
    for (const m of front) {
      expect(m.label.trim(), `${m.id} : libellé vide`).not.toBe('');
      expect(m.label).not.toBe(m.id);
    }
  });

  it('« aucun » reste une sentinelle, jamais un module', () => {
    expect(back).not.toContain('aucun');
    expect(front.map(m => m.id)).not.toContain('aucun');
  });
});
