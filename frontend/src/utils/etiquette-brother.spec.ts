// @vitest-environment jsdom
/**
 * Étiquette Brother 62 × 29 — l'enseigne revient, la quantité reste.
 *
 * Radiance (14/09/2026) : « remettez Radiance Essentials sur les étiquettes ».
 * La quantité, demandée entre-temps à la place de l'enseigne, ne doit pas
 * disparaître pour autant. Ce test dessine de VRAIES étiquettes avec jsPDF et
 * vérifie :
 *  - l'enseigne est imprimée en gras italique, la quantité et le prix aussi ;
 *  - aucun texte de la colonne de gauche ne mord sur le prix, même avec une
 *    enseigne très longue (coupée avec « … ») ;
 *  - sans enseigne saisie, rien ne s'imprime à sa place — jamais une marque
 *    de repli ;
 *  - rien dans la zone morte du haut, et le bas reste au-dessus du rail.
 *
 * Le docblock force jsdom : ce fichier doit tourner même là où la
 * configuration Vitest ne le pose pas.
 */
import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { dessinerEtiquetteBrother, COTES, BROTHER_62, TextesEtiquette } from './etiquette-brother';

const CHEWING_GUM: TextesEtiquette = {
  nom: '5IVE Chewing Gum', code: '022000005144', sku: '022000005144',
  uniteQuantite: 'piece · 15', prix: '1 500 XAF',
};

interface Ecrit { texte: string; x: number; y: number; police: string; style: string; taille: number; align?: string }

/** Dessine une étiquette et relève chaque texte écrit, avec sa police. */
function dessiner(e: TextesEtiquette, enseigne: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [BROTHER_62.largeur, BROTHER_62.hauteur] });
  const ecrits: Ecrit[] = [];
  const texteOriginal = doc.text.bind(doc);
  vi.spyOn(doc, 'text').mockImplementation(((texte: string, x: number, y: number, options?: { align?: string }) => {
    const f = doc.getFont();
    ecrits.push({ texte, x, y, police: f.fontName, style: f.fontStyle, taille: doc.getFontSize(), align: options?.align });
    return texteOriginal(texte, x, y, options as never);
  }) as never);
  dessinerEtiquetteBrother(doc, e, enseigne);

  /** Étendue horizontale (mm) d'un texte écrit, à sa police. */
  const etendue = (w: Ecrit) => {
    doc.setFont(w.police, w.style); doc.setFontSize(w.taille);
    const l = doc.getTextWidth(w.texte);
    return w.align === 'right' ? { gauche: w.x - l, droite: w.x } : w.align === 'center' ? { gauche: w.x - l / 2, droite: w.x + l / 2 } : { gauche: w.x, droite: w.x + l };
  };
  return { ecrits, etendue };
}

describe('étiquette Brother 62 — enseigne, quantité, prix', () => {
  it('imprime l’enseigne en gras italique, ET la quantité, ET le prix', () => {
    const { ecrits } = dessiner(CHEWING_GUM, 'Radiance Essentials');
    const textes = ecrits.map(w => w.texte);
    expect(textes).toEqual(expect.arrayContaining(['5IVE Chewing Gum', '022000005144', '1 500 XAF', 'Radiance Essentials', 'piece · 15']));

    const enseigne = ecrits.find(w => w.texte === 'Radiance Essentials')!;
    expect(enseigne.style).toBe('bolditalic');
    expect(enseigne.x).toBe(COTES.margeGauche);
    // L'enseigne est AU-DESSUS de la quantité, qui garde sa place validée.
    const quantite = ecrits.find(w => w.texte === 'piece · 15')!;
    expect(enseigne.y).toBeLessThan(quantite.y);
    expect(quantite.y).toBe(COTES.uniteY);
  });

  it('la colonne de gauche ne mord jamais sur le prix — même une enseigne très longue', () => {
    const cher = { ...CHEWING_GUM, prix: '1 250 000 XAF' };
    const { ecrits, etendue } = dessiner(cher, 'Radiance Essentials Beauty & Wellness Center Bonamoussadi');
    const prix = etendue(ecrits.find(w => w.texte === cher.prix)!);
    const gauche = ecrits.filter(w => w.y === COTES.enseigneY || w.y === COTES.uniteY);
    expect(gauche).toHaveLength(2);
    for (const w of gauche) expect(etendue(w).droite).toBeLessThanOrEqual(prix.gauche - COTES.espacePrix + 0.01);
    expect(ecrits.find(w => w.y === COTES.enseigneY)!.texte.endsWith('…')).toBe(true);
  });

  it('sans enseigne saisie : rien à sa place — jamais une marque de repli', () => {
    const { ecrits } = dessiner(CHEWING_GUM, '   ');
    expect(ecrits.some(w => w.y === COTES.enseigneY)).toBe(false);
    expect(ecrits.some(w => /Caméléon|Family Store/.test(w.texte))).toBe(false);
    // La quantité et le prix restent.
    expect(ecrits.map(w => w.texte)).toEqual(expect.arrayContaining(['piece · 15', '1 500 XAF']));
  });

  it('respecte la zone morte du haut et le rail du bas (cotes validées à la QL-800)', () => {
    const { ecrits } = dessiner(CHEWING_GUM, 'Radiance Essentials');
    for (const w of ecrits) {
      expect(w.y, `${w.texte} trop haut`).toBeGreaterThanOrEqual(COTES.nomY);
      expect(w.y, `${w.texte} trop bas`).toBeLessThanOrEqual(COTES.prixY);
    }
    // L'enseigne ne touche pas la référence sous les barres.
    expect(COTES.enseigneY - COTES.skuY).toBeGreaterThanOrEqual(3);
  });
});
