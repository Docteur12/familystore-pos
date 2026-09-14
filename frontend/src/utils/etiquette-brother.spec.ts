// @vitest-environment jsdom
/**
 * Étiquette Brother 62 × 29 — l'enseigne, seule, en bas à gauche.
 *
 * Radiance (14/09/2026) : « remettez Radiance Essentials », puis « retirez
 * piece, mettez juste Radiance Essentials ». Ce test dessine de VRAIES
 * étiquettes avec jsPDF et vérifie :
 *  - l'enseigne est imprimée en gras italique, le prix aussi, et RIEN d'autre
 *    sur la ligne du bas (plus d'unité · quantité) ;
 *  - l'enseigne ne mord jamais sur le prix, même très longue (coupée « … ») ;
 *  - sans enseigne saisie, rien ne s'imprime à sa place — jamais une marque
 *    de repli ;
 *  - rien dans la zone morte du haut, et le bas reste au-dessus du rail.
 *
 * Le docblock force jsdom : ce fichier doit tourner même là où la
 * configuration Vitest ne le pose pas.
 */
import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { dessinerEtiquetteBrother, COTES, BROTHER_62, TextesEtiquette, cotes, hauteurValide } from './etiquette-brother';

const CHEWING_GUM: TextesEtiquette = {
  nom: '5IVE Chewing Gum', code: '022000005144', sku: '022000005144', prix: '1 500 XAF',
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

describe('étiquette Brother 62 — enseigne seule et prix', () => {
  it('imprime nom, barres, référence, enseigne en gras italique et prix — rien d’autre', () => {
    const { ecrits } = dessiner(CHEWING_GUM, 'Radiance Essentials');
    expect(ecrits.map(w => w.texte).sort()).toEqual(['022000005144', '1 500 XAF', '5IVE Chewing Gum', 'Radiance Essentials'].sort());

    const enseigne = ecrits.find(w => w.texte === 'Radiance Essentials')!;
    expect(enseigne.style).toBe('bolditalic');
    expect(enseigne.x).toBe(COTES.margeGauche);
    expect(enseigne.y).toBe(COTES.enseigneY);
    // Plus d'unité ni de quantité : aucun texte ne contient « piece » ou « · ».
    expect(ecrits.some(w => /piece|pièce|·/.test(w.texte))).toBe(false);
  });

  it('l’enseigne ne mord jamais sur le prix — même très longue', () => {
    const cher = { ...CHEWING_GUM, prix: '1 250 000 XAF' };
    const { ecrits, etendue } = dessiner(cher, 'Radiance Essentials Beauty & Wellness Center Bonamoussadi');
    const prix = etendue(ecrits.find(w => w.texte === cher.prix)!);
    const enseigne = ecrits.find(w => w.y === COTES.enseigneY)!;
    expect(etendue(enseigne).droite).toBeLessThanOrEqual(prix.gauche - COTES.espacePrix + 0.01);
    expect(enseigne.texte.endsWith('…')).toBe(true);
  });

  it('sans enseigne saisie : rien à sa place — jamais une marque de repli', () => {
    const { ecrits } = dessiner(CHEWING_GUM, '   ');
    expect(ecrits.some(w => w.y === COTES.enseigneY)).toBe(false);
    expect(ecrits.some(w => /Caméléon|Family Store/.test(w.texte))).toBe(false);
    expect(ecrits.map(w => w.texte)).toContain('1 500 XAF');
  });

  it('respecte la zone morte du haut et le rail du bas (cotes validées à la QL-800)', () => {
    const { ecrits } = dessiner(CHEWING_GUM, 'Radiance Essentials');
    for (const w of ecrits) {
      expect(w.y, `${w.texte} trop haut`).toBeGreaterThanOrEqual(COTES.nomY);
      expect(w.y, `${w.texte} trop bas`).toBeLessThanOrEqual(COTES.prixY);
    }
    expect(COTES.enseigneY - COTES.skuY).toBeGreaterThanOrEqual(3);
  });
});

describe('hauteur réglable — remplir un porte-étiquette plus haut', () => {
  it('à 29 mm, les cotes sont exactement celles validées à la QL-800', () => {
    const c = cotes(29);
    expect(c).toMatchObject({ nomY: 5.6, barresY: 6.8, barresHauteur: 9.2, skuY: 18.6, enseigneY: 24.6, prixY: 25.0, nomTaille: 9.5, prixTaille: 12.5 });
    expect(cotes()).toEqual(c);
  });

  it('à 39 mm, les barres grandissent et la ligne du bas reste à 4 mm du bord', () => {
    const c = cotes(39);
    expect(c.hauteur).toBe(39);
    expect(c.barresHauteur).toBeGreaterThan(cotes(29).barresHauteur);
    expect(c.prixY).toBe(35);
    expect(c.enseigneY).toBe(34.6);
    // La référence sous les barres ne mord pas sur la ligne du bas.
    expect(c.enseigneY - c.skuY).toBeGreaterThanOrEqual(3);
    // Rien dans la zone morte du haut.
    expect(c.nomY).toBeGreaterThanOrEqual(5.6);
  });

  it('dessine réellement à 39 mm : tout dans la page, prix et enseigne en bas', () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [62, 39] });
    const ecrits: { texte: string; y: number }[] = [];
    vi.spyOn(doc, 'text').mockImplementation(((texte: string, _x: number, y: number) => { ecrits.push({ texte, y }); return doc; }) as never);
    dessinerEtiquetteBrother(doc, CHEWING_GUM, 'Radiance Essentials', 39);
    for (const w of ecrits) { expect(w.y).toBeGreaterThan(0); expect(w.y).toBeLessThan(39); }
    expect(ecrits.find(w => w.texte === '1 500 XAF')!.y).toBe(35);
    expect(ecrits.find(w => w.texte === 'Radiance Essentials')!.y).toBe(34.6);
  });

  it('une hauteur absurde retombe sur 29', () => {
    expect(hauteurValide(0)).toBe(29);
    expect(hauteurValide(999)).toBe(29);
    expect(hauteurValide('abc')).toBe(29);
    expect(hauteurValide(39)).toBe(39);
    expect(hauteurValide(39.4)).toBe(39);
  });
});
