/**
 * Gouvernance du tiroir-caisse — l'impasse Web Serial ne doit pas revenir.
 *
 * Une version de la caisse tentait d'ouvrir le tiroir depuis le navigateur,
 * par `navigator.serial`. Ça ne pouvait pas marcher : l'imprimante de tickets
 * est un périphérique d'IMPRESSION Windows, pas un port série — elle
 * n'apparaît jamais dans la liste proposée. En pratique, l'appel échouait en
 * silence côté caisse, et depuis le bouton du reçu il présentait au caissier
 * un sélecteur de port VIDE à chaque ticket. Retiré le 22/08/2026 après
 * constat en boutique (Radiance).
 *
 * L'ouverture se fait désormais sur le poste, par `public/outils/
 * tiroir-caisse.ps1`. Le risque n'est pas technique mais humain : quelqu'un
 * qui cherchera « comment ouvrir le tiroir » retombera sur Web Serial, dont
 * la documentation est engageante, et refera le même chemin. Ce test coûte
 * une seconde et évite de reperdre une demi-journée.
 *
 * Même idiome que `services/storage-governance.spec.ts` : une dérogation
 * assumée reste possible, justifiée sur sa ligne.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '..');

/**
 * Seule exemptée : la page qui DOCUMENTE l'impasse.
 *
 * Elle cite « navigator.serial » en toutes lettres, dans les deux langues,
 * pour que le lecteur sache exactement quelle voie a été essayée. Réécrire
 * ce texte pour contourner le détecteur reviendrait à rendre la page floue
 * là où elle doit être précise — c'est justement sa raison d'être.
 *
 * L'exemption est nominative et se voit dans le diff : y ajouter un fichier
 * est un geste délibéré, pas un effet de bord.
 */
const EXEMPTS = ['pages/AdminPosteCaisse.tsx'];

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

/** Portion CODE d'une ligne : une mention en commentaire n'est pas un appel. */
function portionCode(ligne: string): string {
  const t = ligne.trim();
  if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return '';
  const i = ligne.indexOf('//');
  return i >= 0 ? ligne.slice(0, i) : ligne;
}

const estTentative = (ligne: string) =>
  /navigator\s*\.\s*serial|['"]serial['"]\s+in\s+navigator|\bopenCashDrawer\b|requestPort\s*\(/
    .test(portionCode(ligne));

const estJustifie = (ligne: string) => /\/\/\s*TIROIR-NAVIGATEUR:\s*\S/.test(ligne);

interface Tentative { fichier: string; ligne: number; contenu: string }

function tentatives(): Tentative[] {
  const trouvees: Tentative[] = [];
  for (const fichier of fichiersSources(SRC)) {
    const relatif = path.relative(SRC, fichier).replace(/\\/g, '/');
    if (EXEMPTS.includes(relatif) || estFichierDeTest(relatif)) continue;
    fs.readFileSync(fichier, 'utf8').split('\n').forEach((contenu, i) => {
      if (estTentative(contenu) && !estJustifie(contenu)) {
        trouvees.push({ fichier: relatif, ligne: i + 1, contenu: contenu.trim() });
      }
    });
  }
  return trouvees;
}

describe('gouvernance du tiroir-caisse', () => {
  it("aucune tentative d'ouverture du tiroir depuis le navigateur", () => {
    const t = tentatives();
    if (t.length) {
      throw new Error(
        "Ouverture du tiroir depuis le navigateur : impasse connue. Une imprimante " +
          "de tickets USB n'est pas un port serie, elle n'apparait jamais dans le " +
          "selecteur Web Serial. L'ouverture se fait par public/outils/tiroir-caisse.ps1. " +
          'Si vous savez ce que vous faites, justifiez sur la ligne avec ' +
          '`// TIROIR-NAVIGATEUR: <raison>` :\n' +
          t.map(x => `  ${x.fichier}:${x.ligne} → ${x.contenu.slice(0, 100)}`).join('\n'),
      );
    }
    expect(t).toHaveLength(0);
  });

  // Témoin : sans lui, une expression régulière cassée rendrait la
  // gouvernance silencieusement inopérante — au vert en ne détectant plus rien.
  it('le détecteur distingue appel, justification et simple mention', () => {
    expect(estTentative(`const port = await navigator.serial.requestPort();`)).toBe(true);
    expect(estTentative(`if (!('serial' in navigator)) return;`)).toBe(true);
    expect(estTentative(`onClick={() => { handlePrint(); openCashDrawer(); }}`)).toBe(true);
    expect(estTentative(` * l'ouverture par navigator.serial a été retirée`)).toBe(false);
    expect(estTentative(`const ps = getPrintSettings();`)).toBe(false);
    expect(estJustifie(`navigator.serial.requestPort(); // TIROIR-NAVIGATEUR: borne dédiée série`)).toBe(true);
    expect(estJustifie(`navigator.serial.requestPort();`)).toBe(false);
  });

  it('balaie réellement les sources (sinon le test ne prouve rien)', () => {
    expect(fichiersSources(SRC).length).toBeGreaterThan(40);
  });

  // Une exemption qui s'élargit sans qu'on s'en aperçoive viderait la règle
  // de son sens : on fige la liste, l'allonger devra être un choix explicite.
  it("l'exemption reste limitée à la page qui documente l'impasse", () => {
    expect(EXEMPTS).toEqual(['pages/AdminPosteCaisse.tsx']);
  });

  it('les scripts servis aux boutiques sont bien présents', () => {
    // La page d'installation propose ces fichiers au téléchargement : s'ils
    // disparaissaient du dépôt, les liens rendraient un 404 sans que rien
    // d'autre ne le signale.
    const outils = path.resolve(SRC, '..', 'public', 'outils');
    for (const f of ['installer-imprimante-ticket.ps1', 'tiroir-caisse.ps1', 'LISEZ-MOI.txt']) {
      expect(fs.existsSync(path.join(outils, f)), `public/outils/${f} manquant`).toBe(true);
    }
  });
});
