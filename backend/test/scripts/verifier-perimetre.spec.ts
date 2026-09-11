/**
 * verifier-perimetre — la règle des sessions parallèles, mécanisée.
 *
 * Quatre sessions travaillent en même temps ; ce script est ce qui empêche
 * l'une d'écraser le travail de l'autre ou de toucher Commerce. Ce qu'il doit
 * garantir :
 *  - un fichier propre passe ; un fichier hors périmètre est refusé ;
 *  - un fichier partagé est refusé AVANT le signal, accepté après si l'on
 *    n'y a rien supprimé, refusé si une ligne a disparu ;
 *  - un *.spec.ts qui existait au merge-base ne se modifie jamais ;
 *  - le profil se déduit du nom de la branche ;
 *  - et, sur un vrai dépôt git jetable, la couche git lit bien ce qu'il faut.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  verifierPerimetre, globVersRegex, correspond, profilDepuisBranche, lireDiffGit, Perimetres, EtatDiff,
} from '../../scripts/verifier-perimetre';

const perimetres: Perimetres = {
  socleMerge: false,
  partages: ['frontend/src/App.tsx', 'backend/src/schemas/stock-movement.schema.ts'],
  profils: {
    snack: { branche: 'feat/cameleon-snack', propres: ['backend/src/comptoir/**', 'frontend/src/pages/Comptoir*.tsx', 'frontend/src/api/comptoir.ts'] },
    hotel: { branche: 'feat/cameleon-hotel', propres: ['backend/src/hotel/**'] },
  },
};
const diff = (fichiers: string[], extra: Partial<EtatDiff> = {}): EtatDiff =>
  ({ fichiers, suppressions: {}, specsAuBase: ['backend/test/ventes/vente.spec.ts'], ...extra });

describe('globs', () => {
  it('** traverse les dossiers, * reste dans un segment', () => {
    expect(correspond('backend/src/comptoir/comptoir.service.ts', ['backend/src/comptoir/**'])).toBe(true);
    expect(correspond('backend/src/comptoir/dto/vente.dto.ts', ['backend/src/comptoir/**'])).toBe(true);
    expect(correspond('backend/src/comptoirs/x.ts', ['backend/src/comptoir/**'])).toBe(false);
    expect(correspond('frontend/src/pages/ComptoirReserve.tsx', ['frontend/src/pages/Comptoir*.tsx'])).toBe(true);
    expect(correspond('frontend/src/pages/sous/Comptoir.tsx', ['frontend/src/pages/Comptoir*.tsx'])).toBe(false);
    expect(globVersRegex('frontend/src/api/comptoir.ts').test('frontend/src/api/comptoir.tsx')).toBe(false);
  });
});

describe('verifierPerimetre — la règle', () => {
  it('un fichier propre passe', () => {
    const v = verifierPerimetre('snack', diff(['backend/src/comptoir/comptoir.module.ts', 'frontend/src/pages/Comptoir.tsx']), perimetres);
    expect(v.ok).toBe(true);
  });

  it('un fichier hors périmètre est refusé, avec le nom du coupable', () => {
    const v = verifierPerimetre('snack', diff(['frontend/src/pages/Caisse.tsx']), perimetres);
    expect(v.ok).toBe(false);
    expect(v.violations).toEqual([expect.objectContaining({ fichier: 'frontend/src/pages/Caisse.tsx', motif: 'hors_perimetre' })]);
  });

  it('un fichier partagé est refusé AVANT le signal', () => {
    const v = verifierPerimetre('snack', diff(['frontend/src/App.tsx']), perimetres);
    expect(v.violations.map(x => x.motif)).toEqual(['partage_avant_signal']);
  });

  it('après le signal, un ajout dans un partagé passe ; une suppression est refusée', () => {
    const apres = { ...perimetres, socleMerge: true };
    expect(verifierPerimetre('snack', diff(['frontend/src/App.tsx'], { suppressions: { 'frontend/src/App.tsx': 0 } }), apres).ok).toBe(true);
    const v = verifierPerimetre('snack', diff(['frontend/src/App.tsx'], { suppressions: { 'frontend/src/App.tsx': 2 } }), apres);
    expect(v.violations.map(x => x.motif)).toEqual(['suppression_dans_partage']);
  });

  it('un test préexistant modifié est refusé, même s’il est dans les propres', () => {
    const p = { ...perimetres, profils: { ...perimetres.profils, snack: { ...perimetres.profils.snack, propres: ['backend/test/**'] } } };
    const v = verifierPerimetre('snack', diff(['backend/test/ventes/vente.spec.ts', 'backend/test/comptoir/nouveau.spec.ts']), p);
    expect(v.violations).toEqual([expect.objectContaining({ fichier: 'backend/test/ventes/vente.spec.ts', motif: 'spec_existant_modifie' })]);
  });

  it('le fichier des périmètres n’appartient qu’à la référente', () => {
    expect(verifierPerimetre('hotel', diff(['cameleon-perimetres.json']), perimetres).violations[0].motif).toBe('hors_perimetre');
  });

  it('un profil inconnu lève', () => {
    expect(() => verifierPerimetre('pharmacie', diff([]), perimetres)).toThrow(/Profil inconnu/);
  });
});

describe('profil depuis la branche', () => {
  it('lit la branche déclarée, ou le motif feat/cameleon-<profil>', () => {
    expect(profilDepuisBranche('feat/cameleon-snack', perimetres)).toBe('snack');
    expect(profilDepuisBranche('feat/cameleon-hotel', perimetres)).toBe('hotel');
    expect(profilDepuisBranche('feat/cameleon-pharmacie', perimetres)).toBeNull();
    expect(profilDepuisBranche('integration/cameleon', perimetres)).toBeNull();
    expect(profilDepuisBranche(undefined, perimetres)).toBeNull();
  });
});

describe('couche git — sur un dépôt jetable', () => {
  let depot: string;
  const g = (...args: string[]) => execFileSync('git', args, { cwd: depot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const ecrire = (rel: string, contenu: string) => {
    const abs = path.join(depot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contenu);
  };

  beforeAll(() => {
    depot = fs.mkdtempSync(path.join(os.tmpdir(), 'perimetre-'));
    g('init', '-q', '-b', 'integration/cameleon');
    g('config', 'user.email', 'test@test.cm');
    g('config', 'user.name', 'Test');
    g('config', 'commit.gpgsign', 'false');
    ecrire('frontend/src/App.tsx', 'ligne1\nligne2\nligne3\n');
    ecrire('backend/test/ventes/vente.spec.ts', 'it(x)\n');
    g('add', '.');
    g('commit', '-q', '-m', 'base');
    g('checkout', '-q', '-b', 'feat/cameleon-snack');
    ecrire('backend/src/comptoir/comptoir.module.ts', 'export {}\n');
    ecrire('frontend/src/App.tsx', 'ligne1\nligne3\nligne4\n');            // 1 suppression, 1 ajout
    ecrire('backend/test/ventes/vente.spec.ts', 'it(y)\n');                 // spec préexistante modifiée
    g('add', '.');
    g('commit', '-q', '-m', 'travail');
  });

  afterAll(() => { fs.rmSync(depot, { recursive: true, force: true }); });

  it('lit les fichiers modifiés, les suppressions et les specs du merge-base', () => {
    const d = lireDiffGit(depot, 'integration/cameleon');
    expect(d.fichiers.sort()).toEqual(['backend/src/comptoir/comptoir.module.ts', 'backend/test/ventes/vente.spec.ts', 'frontend/src/App.tsx']);
    expect(d.suppressions['frontend/src/App.tsx']).toBe(1);
    expect(d.specsAuBase).toEqual(['backend/test/ventes/vente.spec.ts']);

    const verdict = verifierPerimetre('snack', d, { ...perimetres, socleMerge: true });
    expect(verdict.violations.map(v => v.motif).sort()).toEqual(['spec_existant_modifie', 'suppression_dans_partage']);
  });
});
