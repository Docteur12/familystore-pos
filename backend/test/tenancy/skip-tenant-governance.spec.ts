/**
 * Gouvernance de skipTenant — une porte dérobée ne doit jamais passer inaperçue.
 *
 * `{ skipTenant: true }` retire le cloisonnement d'un schéma : c'est légitime
 * pour les collections plateforme (Tenant, Plan…), les scripts et les seeds,
 * mais c'est aussi exactement ce qui, posé par erreur sur un schéma métier,
 * exposerait les données de tous les magasins.
 *
 * Ce test lit les sources et impose que CHAQUE activation de skipTenant soit :
 *  1. justifiée sur sa ligne par un commentaire `// SKIP-TENANT: <raison>` ;
 *  2. absente des contrôleurs et services métier (réservée scripts/seeds/
 *     futur module platform).
 *
 * Toute nouvelle dérogation devra donc être assumée explicitement dans un
 * commit — impossible d'en glisser une en silence.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../../src');

/** Liste récursive des fichiers .ts sous src/. */
function fichiersTs(dir: string): string[] {
  const out: string[] = [];
  for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entree.name);
    if (entree.isDirectory()) out.push(...fichiersTs(p));
    else if (entree.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

interface Usage {
  fichier: string;
  ligne: number;
  contenu: string;
}

/**
 * Portion CODE d'une ligne : rien pour une ligne entièrement en commentaire
 * (prose de doc mentionnant skipTenant), sinon ce qui précède un `//` en fin
 * de ligne (pour ne pas confondre le code avec sa justification). Ainsi une
 * mention dans un commentaire n'est jamais prise pour une activation.
 */
function portionCode(ligne: string): string {
  const t = ligne.trim();
  if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return '';
  const i = ligne.indexOf('//');
  return i >= 0 ? ligne.slice(0, i) : ligne;
}

/** Une ligne ACTIVE skipTenant si sa portion code contient `skipTenant: true`. */
function estActivation(ligne: string): boolean {
  return /skipTenant\s*:\s*true/.test(portionCode(ligne));
}

/** Une ligne est justifiée si elle porte un `// SKIP-TENANT: <raison>`. */
function estJustifiee(ligne: string): boolean {
  return /\/\/\s*SKIP-TENANT:\s*\S/.test(ligne);
}

/** Repère chaque activation réelle `skipTenant: true` dans les sources. */
function usagesSkipTenant(): Usage[] {
  const usages: Usage[] = [];
  for (const fichier of fichiersTs(SRC)) {
    const lignes = fs.readFileSync(fichier, 'utf8').split('\n');
    lignes.forEach((contenu, i) => {
      if (estActivation(contenu)) {
        usages.push({ fichier: path.relative(SRC, fichier), ligne: i + 1, contenu });
      }
    });
  }
  return usages;
}

describe('gouvernance skipTenant', () => {
  const usages = usagesSkipTenant();

  it('chaque activation de skipTenant porte un commentaire // SKIP-TENANT: <raison>', () => {
    const sansJustification = usages.filter(u => !estJustifiee(u.contenu));
    if (sansJustification.length) {
      const details = sansJustification
        .map(u => `  ${u.fichier}:${u.ligne} → ${u.contenu.trim()}`)
        .join('\n');
      throw new Error(
        'skipTenant activé sans justification. Ajoutez `// SKIP-TENANT: <raison>` sur la ligne :\n' +
          details,
      );
    }
    expect(sansJustification).toHaveLength(0);
  });

  /**
   * Dérogations nommées, décidées explicitement. Toute AUTRE activation dans
   * un contrôleur ou un service reste interdite.
   *
   * `auth/auth.service.ts` : au login en mode multi, la boutique n'est pas
   * encore connue — l'e-mail (unique seulement par tenant) doit être cherché
   * dans tous les magasins avant que le mot de passe ne désigne le ou les
   * comptes valides. Décision produit du 21/08/2026 : pas de code boutique
   * saisi par l'utilisateur.
   */
  const DEROGATIONS = ['auth/auth.service.ts'].map(f => f.replace(/\//g, path.sep));

  it('skipTenant est interdit dans les contrôleurs et services métier, hors dérogations nommées', () => {
    const interdits = usages.filter(
      u =>
        (u.fichier.endsWith('.controller.ts') || u.fichier.endsWith('.service.ts')) &&
        !DEROGATIONS.includes(u.fichier),
    );
    if (interdits.length) {
      const details = interdits.map(u => `  ${u.fichier}:${u.ligne}`).join('\n');
      throw new Error(
        'skipTenant interdit dans les contrôleurs/services métier ' +
          '(réservé scripts, seeds, module platform) :\n' +
          details,
      );
    }
    expect(interdits).toHaveLength(0);
  });

  // Garde-fou sur le garde-fou : prouve que la détection n'est pas un no-op qui
  // passerait quoi qu'il arrive. Sans ça, une regex cassée rendrait la
  // gouvernance silencieusement inopérante.
  it('les détecteurs reconnaissent activation nue, activation justifiée, prose et lecture', () => {
    const nue = 'const s = new Schema({}, { skipTenant: true });';
    const ok = '  { skipTenant: true }, // SKIP-TENANT: collection plateforme, hors magasin';
    const prose = '   * cloisonné se déclare avec { skipTenant: true } ; le plugin…'; // commentaire
    const lecture = 'if ((schema as any).options?.skipTenant) return;'; // le plugin LIT l'option

    expect(estActivation(nue)).toBe(true);
    expect(estJustifiee(nue)).toBe(false); // → serait rejetée
    expect(estActivation(ok)).toBe(true);
    expect(estJustifiee(ok)).toBe(true); // → acceptée
    expect(estActivation(prose)).toBe(false); // une mention en commentaire n'active rien
    expect(estActivation(lecture)).toBe(false); // lire l'option n'est pas l'activer
  });
});
