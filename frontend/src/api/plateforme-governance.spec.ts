/**
 * Gouvernance des moyens de règlement — le frontend et le backend doivent
 * connaître exactement la MÊME liste.
 *
 * Le backend valide le moyen reçu (`MOYENS_REGLEMENT` dans paiement.schema.ts),
 * le frontend le propose dans une liste déroulante. Un identifiant ajouté d'un
 * seul côté donnerait soit un choix refusé au clic, soit un moyen accepté que
 * personne ne peut choisir. Même approche que modules-governance : on lit les
 * SOURCES.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MOYENS_REGLEMENT } from './plateforme';

const BACK = path.resolve(__dirname, '..', '..', '..', 'backend', 'src', 'platform', 'paiement', 'paiement.schema.ts');

function idsBackend(): string[] {
  const src = fs.readFileSync(BACK, 'utf8');
  const bloc = src.match(/MOYENS_REGLEMENT\s*=\s*\[([^\]]*)\]\s*as const/);
  if (!bloc) throw new Error('MOYENS_REGLEMENT introuvable dans paiement.schema.ts');
  return [...bloc[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
}

describe('moyens de règlement — miroir frontend / backend', () => {
  const back = idsBackend();

  it('les deux listes existent (sinon ce test ne prouve rien)', () => {
    expect(back.length).toBeGreaterThanOrEqual(3);
    expect(MOYENS_REGLEMENT.length).toBeGreaterThanOrEqual(3);
  });

  it('mêmes identifiants, exactement', () => {
    expect(MOYENS_REGLEMENT.map(m => m.id).slice().sort()).toEqual([...back].sort());
  });

  it('chaque moyen a un libellé lisible', () => {
    for (const m of MOYENS_REGLEMENT) {
      expect(m.label.trim(), `${m.id} : libellé vide`).not.toBe('');
      expect(m.label).not.toBe(m.id);
    }
  });
});
