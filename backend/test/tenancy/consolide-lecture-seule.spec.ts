/**
 * Le chemin consolidé est en LECTURE SEULE — vérifié sur les sources.
 *
 * C'est le seul endroit du produit qui parcourt plusieurs boutiques. Une
 * écriture qui s'y glisserait s'appliquerait au contexte tenant courant de la
 * boucle : un rapport pourrait alors modifier une boutique que l'utilisateur
 * ne consulte même pas. La promesse « lecture seule » doit donc être
 * mécaniquement vérifiable, pas seulement écrite dans un commentaire.
 *
 * Même principe que `skip-tenant-governance.spec.ts` : le test lit le code et
 * échoue si une méthode d'écriture apparaît dans le module `consolide/`.
 */
import * as fs from 'fs';
import * as path from 'path';

const DOSSIER = path.resolve(__dirname, '../../src/consolide');

/** Méthodes Mongoose (ou étapes d'agrégation) capables d'écrire. */
const ECRITURES = [
  'create', 'save', 'insertMany', 'insertOne', 'bulkWrite',
  'updateOne', 'updateMany', 'update', 'replaceOne',
  'findOneAndUpdate', 'findOneAndReplace', 'findByIdAndUpdate',
  'deleteOne', 'deleteMany', 'remove', 'findOneAndDelete', 'findByIdAndDelete',
  '$out', '$merge',
];

function fichiers(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? fichiers(p) : e.name.endsWith('.ts') ? [p] : [];
  });
}

/** Portion CODE d'une ligne : une mention en commentaire n'écrit rien. */
function portionCode(ligne: string): string {
  const t = ligne.trim();
  if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return '';
  const i = ligne.indexOf('//');
  return i >= 0 ? ligne.slice(0, i) : ligne;
}

function ecrituresTrouvees(): string[] {
  const trouvees: string[] = [];
  for (const fichier of fichiers(DOSSIER)) {
    fs.readFileSync(fichier, 'utf8').split('\n').forEach((ligne, i) => {
      const code = portionCode(ligne);
      for (const methode of ECRITURES) {
        const motif = methode.startsWith('$')
          ? new RegExp(`\\${methode}\\b`)
          : new RegExp(`\\.\\s*${methode}\\s*\\(`);
        if (motif.test(code)) {
          trouvees.push(`${path.basename(fichier)}:${i + 1} → ${methode} — ${ligne.trim().slice(0, 80)}`);
        }
      }
    });
  }
  return trouvees;
}

describe('rapports consolidés — lecture seule', () => {
  it("le module consolide/ n'appelle aucune méthode d'écriture", () => {
    const ecritures = ecrituresTrouvees();
    if (ecritures.length) {
      throw new Error(
        'Écriture détectée sur le chemin consolidé, qui doit rester en lecture ' +
          'seule (il parcourt plusieurs boutiques) :\n  ' + ecritures.join('\n  '),
      );
    }
    expect(ecritures).toHaveLength(0);
  });

  it("n'utilise aucun skipTenant : la traversée se fait par contextes, pas en retirant la barrière", () => {
    const sources = fichiers(DOSSIER).map(f => fs.readFileSync(f, 'utf8')).join('\n');
    const activations = sources
      .split('\n')
      .filter(l => /skipTenant\s*:\s*true/.test(portionCode(l)));
    expect(activations).toHaveLength(0);
    // …et chaque boutique EST bien lue dans son contexte.
    expect(sources).toContain('runWithTenant');
  });

  // Garde-fou sur le garde-fou : sans lui, un dossier renommé ou une regex
  // cassée rendrait ce test silencieusement vert.
  it('lit réellement les sources et sait reconnaître une écriture', () => {
    expect(fichiers(DOSSIER).length).toBeGreaterThanOrEqual(3);

    const faux = [
      'await this.saleModel.create({ total: 1 });',
      'await this.saleModel.updateOne({}, { $set: { total: 0 } });',
      '{ $out: "collection" }',
    ];
    for (const ligne of faux) {
      const detecte = ECRITURES.some(m =>
        (m.startsWith('$') ? new RegExp(`\\${m}\\b`) : new RegExp(`\\.\\s*${m}\\s*\\(`)).test(portionCode(ligne)),
      );
      expect(detecte).toBe(true);
    }
    // Une lecture, elle, ne doit pas être prise pour une écriture.
    expect(
      ECRITURES.some(m =>
        (m.startsWith('$') ? new RegExp(`\\${m}\\b`) : new RegExp(`\\.\\s*${m}\\s*\\(`)).test(
          portionCode('const [agr] = await this.saleModel.aggregate([{ $match: {} }]);'),
        ),
      ),
    ).toBe(false);
  });
});
