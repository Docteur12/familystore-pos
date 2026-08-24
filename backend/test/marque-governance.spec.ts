/**
 * Gouvernance de la marque, côté serveur — miroir de
 * `frontend/src/config/marque-governance.spec.ts`.
 *
 * Le nom d'un client servait de repli dans la santé du service, l'e-mail de
 * mot de passe oublié et l'en-tête des rapports PDF. Aucun ne cassait quoi
 * que ce soit : un autre commerçant recevait simplement des documents au nom
 * de Family Store. Ce genre de défaut se lit un jour sur un rapport, pas dans
 * un journal d'erreurs.
 *
 * ⚠️ Détection SENSIBLE À LA CASSE, délibérément : « Family Store » est une
 * marque, « familystore » en minuscules est un nom de base ou d'hôte
 * (`mongodb://…/familystore`, `familystore-pos.onrender.com`). Ce sont des
 * ADRESSES — les renommer casserait la production, et les scripts de
 * migration comme la détection de production en dépendent.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '..', 'src');

function fichiersSources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersSources(p));
    else if (/\.ts$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Portion CODE d'une ligne : une mention en commentaire n'est pas un usage. */
function portionCode(ligne: string): string {
  const t = ligne.trim();
  if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return '';
  const i = ligne.indexOf('//');
  return i >= 0 ? ligne.slice(0, i) : ligne;
}

const estMarqueEnDur = (ligne: string) => /Family\s?Store/.test(portionCode(ligne));
const estJustifie = (ligne: string) => /\/\/\s*MARQUE-EN-DUR:\s*\S/.test(ligne);

interface Occurrence { fichier: string; ligne: number; contenu: string }

function occurrences(): Occurrence[] {
  const trouvees: Occurrence[] = [];
  for (const fichier of fichiersSources(SRC)) {
    const relatif = path.relative(SRC, fichier).replace(/\\/g, '/');
    fs.readFileSync(fichier, 'utf8').split('\n').forEach((contenu, i) => {
      if (estMarqueEnDur(contenu) && !estJustifie(contenu)) {
        trouvees.push({ fichier: relatif, ligne: i + 1, contenu: contenu.trim() });
      }
    });
  }
  return trouvees;
}

describe('gouvernance de la marque (serveur)', () => {
  it("aucune enseigne de client écrite en dur dans src/", () => {
    const o = occurrences();
    if (o.length) {
      throw new Error(
        'Nom d’un client écrit en dur. Passez par `nomEnseigne()` / ' +
          '`nomApplication()` de src/config/marque.ts, ou laissez VIDE pour un ' +
          'document remis au client. Dérogation assumée : `// MARQUE-EN-DUR: <raison>` :\n' +
          o.map(x => `  ${x.fichier}:${x.ligne} → ${x.contenu.slice(0, 100)}`).join('\n'),
      );
    }
    expect(o).toHaveLength(0);
  });

  // Témoin : sans lui, une expression régulière cassée passerait au vert en
  // ne détectant plus rien.
  it('le détecteur distingue marque, adresse technique et commentaire', () => {
    expect(estMarqueEnDur(`const app = 'Family Store POS';`)).toBe(true);
    expect(estMarqueEnDur(`nomMagasin || 'FamilyStore'`)).toBe(true);
    expect(estMarqueEnDur(`/(familystore|radiance)/i.test(uri)`)).toBe(false);   // détection de production
    expect(estMarqueEnDur(`'https://familystore-pos.netlify.app'`)).toBe(false); // CORS
    expect(estMarqueEnDur(` * les données de Family Store et Radiance`)).toBe(false);
    expect(estJustifie(`const x = 'Family Store'; // MARQUE-EN-DUR: migration historique`)).toBe(true);
  });

  it('balaie réellement les sources', () => {
    expect(fichiersSources(SRC).length).toBeGreaterThan(30);
  });

  it('les deux constantes de marque restent des miroirs', () => {
    const serveur = fs.readFileSync(path.join(SRC, 'config', 'marque.ts'), 'utf8');
    const client = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'frontend', 'src', 'config', 'marque.ts'), 'utf8',
    );
    const valeur = (s: string, cle: string) => s.match(new RegExp(`${cle} = '([^']+)'`))?.[1];
    expect(valeur(serveur, 'MARQUE_PRODUIT')).toBe('Caméléon');
    expect(valeur(client, 'MARQUE_PRODUIT')).toBe(valeur(serveur, 'MARQUE_PRODUIT'));
    expect(valeur(client, 'COULEUR_MARQUE')).toBe(valeur(serveur, 'COULEUR_MARQUE'));
  });
});
