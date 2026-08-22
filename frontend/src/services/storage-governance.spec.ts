/**
 * Gouvernance du stockage — une porte dérobée ne doit jamais passer inaperçue.
 *
 * Le cloisonnement par boutique ne vaut que si TOUT passe par
 * `services/storage.ts`. Un seul `localStorage.setItem('pending_sales', …)`
 * oublié quelque part, et une vente de Bonamoussadi repart à Bependa — sans
 * que rien ne le signale.
 *
 * Ce test lit les sources de `src/` et échoue si un accès direct à
 * `localStorage`, `sessionStorage` ou `idb-keyval` subsiste hors de la couche.
 * Même principe que `skip-tenant-governance.spec.ts` côté serveur, qui a
 * prouvé son utilité : toute dérogation future devra être assumée dans un
 * commit, justifiée sur sa ligne par `// STORAGE-DIRECT: <raison>`.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '..');

/**
 * Seuls exemptés : la couche elle-même et les fichiers de test.
 *
 * Les tests arrangent délibérément un état brut — un stockage hérité
 * d'avant le cloisonnement, un jeton expiré, une IndexedDB en panne — qu'on
 * ne peut pas fabriquer en passant par la couche. Ils ne partent pas dans le
 * bundle : aucune caisse n'exécute ce code. La règle reste donc entière là
 * où elle protège quelque chose, c'est-à-dire dans le code livré.
 */
const EXEMPTS = ['services/storage.ts', 'test/setup.ts'];
const estFichierDeTest = (relatif: string) => /\.spec\.(ts|tsx)$/.test(relatif);

function fichiersSources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersSources(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Portion CODE d'une ligne : une mention en commentaire n'est pas un accès. */
function portionCode(ligne: string): string {
  const t = ligne.trim();
  if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return '';
  const i = ligne.indexOf('//');
  return i >= 0 ? ligne.slice(0, i) : ligne;
}

const estAcces = (ligne: string) =>
  /\blocalStorage\s*\.|\bsessionStorage\s*\.|from\s+['"]idb-keyval['"]/.test(portionCode(ligne));

const estJustifie = (ligne: string) => /\/\/\s*STORAGE-DIRECT:\s*\S/.test(ligne);

interface Acces { fichier: string; ligne: number; contenu: string }

function accesDirects(): Acces[] {
  const trouves: Acces[] = [];
  for (const fichier of fichiersSources(SRC)) {
    const relatif = path.relative(SRC, fichier).replace(/\\/g, '/');
    if (EXEMPTS.includes(relatif) || estFichierDeTest(relatif)) continue;
    fs.readFileSync(fichier, 'utf8').split('\n').forEach((contenu, i) => {
      if (estAcces(contenu) && !estJustifie(contenu)) {
        trouves.push({ fichier: relatif, ligne: i + 1, contenu: contenu.trim() });
      }
    });
  }
  return trouves;
}

describe('gouvernance du stockage local', () => {
  it('aucun accès direct à localStorage / sessionStorage / idb-keyval hors de la couche', () => {
    const directs = accesDirects();
    if (directs.length) {
      throw new Error(
        'Accès direct au stockage hors de services/storage.ts — le cloisonnement ' +
          'par boutique serait contourné. Passez par la couche, ou justifiez sur ' +
          'la ligne avec `// STORAGE-DIRECT: <raison>` :\n' +
          directs.map(a => `  ${a.fichier}:${a.ligne} → ${a.contenu.slice(0, 100)}`).join('\n'),
      );
    }
    expect(directs).toHaveLength(0);
  });

  // Garde-fou sur le garde-fou : sans lui, une expression régulière cassée
  // rendrait la gouvernance silencieusement inopérante — elle passerait au
  // vert en ne lisant plus rien.
  it('les détecteurs distinguent accès, justification et simple mention', () => {
    expect(estAcces(`localStorage.setItem('x', '1')`)).toBe(true);
    expect(estAcces(`sessionStorage.getItem('x')`)).toBe(true);
    expect(estAcces(`import { get } from 'idb-keyval';`)).toBe(true);
    expect(estAcces(` * on n'utilise plus localStorage.getItem ici`)).toBe(false); // commentaire
    expect(estAcces(`const j = jeton();`)).toBe(false);
    expect(estJustifie(`localStorage.clear(); // STORAGE-DIRECT: purge de secours`)).toBe(true);
    expect(estJustifie(`localStorage.clear();`)).toBe(false);
  });

  it('balaie réellement les sources (sinon le test ne prouve rien)', () => {
    expect(fichiersSources(SRC).length).toBeGreaterThan(40);
  });
});
