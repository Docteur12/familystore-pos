/**
 * Gouvernance de la marque — « Family Store » ne doit pas revenir en dur.
 *
 * Le nom était répété une vingtaine de fois comme valeur de repli, dans des
 * fichiers sans rapport entre eux. Aucun ne cassait quoi que ce soit : une
 * boutique neuve affichait simplement l'enseigne d'un autre commerçant, sur
 * son ticket, dans son menu, dans son manuel. Ce genre de défaut ne se
 * signale pas tout seul — il se lit, un jour, sur un reçu.
 *
 * On ne recense donc plus à la main : le test échoue si le littéral
 * réapparaît dans le code livré.
 *
 * ⚠️ La détection est SENSIBLE À LA CASSE, et c'est délibéré : « Family Store »
 * est un nom de marque, tandis que « familystore » en minuscules désigne une
 * base de données ou un nom d'hôte (`familystore-pos.netlify.app`,
 * `mongodb://…/familystore`). Ceux-là sont des ADRESSES, pas de la marque :
 * les renommer casserait la production.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '..');

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

/**
 * Portion CODE d'une ligne : une mention en commentaire n'est pas un usage.
 *
 * Les commentaires JSX `{/* … *\/}` comptent aussi — sans eux, le test
 * signalait deux commentaires périmés comme s'ils imprimaient une enseigne,
 * ce qui aurait fini par apprendre à ignorer ses alertes.
 */
function portionCode(ligne: string): string {
  const t = ligne.trim();
  if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('{/*')) return '';
  const i = ligne.indexOf('//');
  return i >= 0 ? ligne.slice(0, i) : ligne;
}

/** Marque d'un client écrite en dur — pas une adresse technique. */
const estMarqueEnDur = (ligne: string) =>
  /Family\s?Store/.test(portionCode(ligne));

const estJustifie = (ligne: string) => /\/\/\s*MARQUE-EN-DUR:\s*\S/.test(ligne);

interface Occurrence { fichier: string; ligne: number; contenu: string }

function occurrences(): Occurrence[] {
  const trouvees: Occurrence[] = [];
  for (const fichier of fichiersSources(SRC)) {
    const relatif = path.relative(SRC, fichier).replace(/\\/g, '/');
    if (estFichierDeTest(relatif)) continue;
    fs.readFileSync(fichier, 'utf8').split('\n').forEach((contenu, i) => {
      if (estMarqueEnDur(contenu) && !estJustifie(contenu)) {
        trouvees.push({ fichier: relatif, ligne: i + 1, contenu: contenu.trim() });
      }
    });
  }
  return trouvees;
}

describe('gouvernance de la marque', () => {
  it("aucune enseigne de client écrite en dur dans le code livré", () => {
    const o = occurrences();
    if (o.length) {
      throw new Error(
        'Nom d’un client écrit en dur. Le produit sert plusieurs commerçants : ' +
          'un repli doit passer par `nomEnseigne()` (interface) ou rester VIDE ' +
          '(tickets et factures) — voir config/marque.ts. Si l’usage est ' +
          'délibéré, justifiez-le sur la ligne avec `// MARQUE-EN-DUR: <raison>` :\n' +
          o.map(x => `  ${x.fichier}:${x.ligne} → ${x.contenu.slice(0, 100)}`).join('\n'),
      );
    }
    expect(o).toHaveLength(0);
  });

  // Témoin : sans lui, une expression régulière cassée rendrait la
  // gouvernance silencieusement inopérante — au vert en ne lisant plus rien.
  it('le détecteur distingue marque, adresse technique et commentaire', () => {
    expect(estMarqueEnDur(`const nom = 'Family Store';`)).toBe(true);
    expect(estMarqueEnDur(`nomMagasin || 'FamilyStore'`)).toBe(true);
    // Adresses : à NE PAS signaler, les renommer casserait la production.
    expect(estMarqueEnDur(`'https://familystore-pos.netlify.app'`)).toBe(false);
    expect(estMarqueEnDur(`'mongodb://127.0.0.1/familystore'`)).toBe(false);
    expect(estMarqueEnDur(` * héritée de Family Store à l'origine`)).toBe(false); // commentaire
    expect(estMarqueEnDur(`      {/* logo Family Store par défaut */}`)).toBe(false); // commentaire JSX
    expect(estMarqueEnDur(`const nom = nomEnseigne(settings.nomMagasin);`)).toBe(false);
    expect(estJustifie(`const x = 'Family Store'; // MARQUE-EN-DUR: migration historique`)).toBe(true);
    expect(estJustifie(`const x = 'Family Store';`)).toBe(false);
  });

  it('balaie réellement les sources (sinon le test ne prouve rien)', () => {
    expect(fichiersSources(SRC).length).toBeGreaterThan(40);
  });

  it('les replis passent bien par la constante unique', () => {
    const marque = fs.readFileSync(path.join(SRC, 'config', 'marque.ts'), 'utf8');
    expect(marque).toMatch(/MARQUE_PRODUIT = 'Caméléon'/);
  });
});
