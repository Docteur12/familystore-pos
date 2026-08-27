/**
 * Gouvernance des motifs de mouvement de stock — le frontend doit connaître
 * TOUS les motifs que le backend peut émettre, en français ET en anglais.
 *
 * Le gestionnaire de stock voyait « modification_vente » en clair dans sa
 * fiche produit : un code fait pour la base, pas pour lui. La table
 * `REASON_LABELS` de `Stocks.tsx` le traduit. Mais une table écrite à la main
 * diverge de sa source : le jour où le backend ajoute un motif, personne ne
 * pense à l'étiqueter, et le code brut réapparaît — sans qu'aucun test ne
 * bronche, puisque rien ne plante.
 *
 * Ce test lit les DEUX sources et exige qu'elles coïncident exactement :
 *  - `backend/src/schemas/stock-movement.schema.ts` fait foi (c'est lui qui
 *    valide ce qui entre en base) ;
 *  - chaque motif doit avoir un libellé FR et un libellé EN, non vides et
 *    différents l'un de l'autre.
 *
 * Même approche que `storage-governance` et `marque-governance` : on lit les
 * sources plutôt que d'importer le module — `t()` dépend de la langue courante
 * au chargement, et l'on veut vérifier les deux libellés à la fois.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FRONT = path.resolve(__dirname, 'Stocks.tsx');
const BACK  = path.resolve(__dirname, '..', '..', '..', 'backend', 'src', 'schemas', 'stock-movement.schema.ts');

/** Motifs autorisés par le schéma : le tableau `MOVEMENT_REASONS = [...]`. */
function motifsDuBackend(): string[] {
  const src = fs.readFileSync(BACK, 'utf8');
  const bloc = src.match(/MOVEMENT_REASONS\s*:\s*MovementReason\[\]\s*=\s*\[([\s\S]*?)\]/);
  if (!bloc) throw new Error('MOVEMENT_REASONS introuvable dans stock-movement.schema.ts');
  return [...bloc[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
}

/** Libellés du frontend : les entrées `code: t('fr', 'en')` de REASON_LABELS. */
function libellesDuFrontend(): Map<string, { fr: string; en: string }> {
  const src = fs.readFileSync(FRONT, 'utf8');
  const bloc = src.match(/const REASON_LABELS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!bloc) throw new Error('REASON_LABELS introuvable dans Stocks.tsx');
  const table = new Map<string, { fr: string; en: string }>();
  for (const m of bloc[1].matchAll(/([a-z_]+)\s*:\s*t\('([^']*)',\s*'([^']*)'\)/g)) {
    table.set(m[1], { fr: m[2], en: m[3] });
  }
  return table;
}

describe('motifs de mouvement de stock — libellés FR/EN', () => {
  const backend = motifsDuBackend();
  const frontend = libellesDuFrontend();

  it('le backend expose bien une liste de motifs (sinon ce test ne prouve rien)', () => {
    expect(backend.length).toBeGreaterThanOrEqual(10);
  });

  it('chaque motif du backend a un libellé côté frontend', () => {
    const manquants = backend.filter(code => !frontend.has(code));
    expect(manquants, `motifs sans libellé : ${manquants.join(', ')}`).toEqual([]);
  });

  it('le frontend ne traduit aucun motif que le backend ne connaît pas', () => {
    // Un libellé orphelin trahit un motif renommé ou supprimé côté serveur.
    const orphelins = [...frontend.keys()].filter(code => !backend.includes(code));
    expect(orphelins, `libellés orphelins : ${orphelins.join(', ')}`).toEqual([]);
  });

  it('chaque libellé existe en français ET en anglais, et les deux diffèrent', () => {
    for (const [code, { fr, en }] of frontend) {
      expect(fr.trim(), `${code} : FR vide`).not.toBe('');
      expect(en.trim(), `${code} : EN vide`).not.toBe('');
      // Un même texte des deux côtés = une traduction oubliée.
      expect(fr, `${code} : FR et EN identiques`).not.toBe(en);
      // Le code brut ne doit jamais servir de libellé.
      expect(fr).not.toBe(code);
      expect(en).not.toBe(code);
    }
  });

  it('les deux listes coïncident exactement', () => {
    expect([...frontend.keys()].sort()).toEqual([...backend].sort());
  });
});
