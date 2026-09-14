/**
 * Étiquette Brother 62 × 29 mm — le dessin, isolé pour être testé.
 *
 * Toutes les cotes ont été validées sur la QL-800 de Radiance, douchette en
 * main (septembre 2026) :
 *  - rien avant 5,6 mm en haut : la QL-800 n'imprime pas les ~2 premiers mm ;
 *  - barres de 4 à 58 mm, 9,2 mm de haut — la chaîne qui se scanne ;
 *  - la dernière ligne reste REMONTÉE : glissée dans un porte-étiquette, elle
 *    sortait cachée par le rail du support.
 *
 * Bas de l'étiquette : à droite le PRIX, gros, lisible de loin ; à gauche, en
 * petit, l'ENSEIGNE (gras italique), seule. Radiance a demandé l'enseigne
 * (06/09), puis la quantité à sa place, puis l'enseigne de retour et la
 * quantité retirée (14/09) : « juste Radiance Essentials ».
 *
 * L'enseigne vient des paramètres du magasin. Vide, rien ne s'imprime à sa
 * place — jamais le nom d'un autre commerce ni celui du logiciel : une
 * étiquette est un document remis au client (même règle que STORE_FALLBACK).
 *
 * Aucune dépendance à la langue ni au stockage : l'appelant fournit les textes
 * déjà mis en forme (nom affiché, unité traduite, prix).
 */
import type { jsPDF } from 'jspdf';
import { rectsCode39 } from './code39';

export const BROTHER_62 = { largeur: 62, hauteur: 29 } as const;

/** Textes d'une étiquette, déjà mis en forme par l'appelant. */
export interface TextesEtiquette {
  nom: string;
  /** Contenu encodé dans les barres (Code 39). */
  code: string;
  /** Référence lisible sous les barres. */
  sku: string;
  /** « 1 500 XAF ». */
  prix: string;
}

/** Cotes (mm) — exportées pour que le test vérifie l'absence de chevauchement. */
export const COTES = {
  margeGauche: 2,
  bordDroit: 60,
  nomY: 5.6,
  barresX: 4, barresLargeur: 54, barresY: 6.8, barresHauteur: 9.2,
  skuX: 31, skuY: 18.6,
  /** Ligne du bas, à la place validée au porte-étiquette (rail du support). */
  enseigneY: 24.6,
  prixY: 25.0,
  /** Blanc minimal entre l'enseigne et le prix. */
  espacePrix: 3,
} as const;

/** Coupe un texte avec « … » pour qu'il tienne dans `largeurMax` (mm), à la police courante. */
export function ajuster(doc: jsPDF, texte: string, largeurMax: number): string {
  if (doc.getTextWidth(texte) <= largeurMax) return texte;
  let t = texte;
  while (t.length > 1 && doc.getTextWidth(t + '…') > largeurMax) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

/** Dessine UNE étiquette sur la page courante du document. */
export function dessinerEtiquetteBrother(doc: jsPDF, e: TextesEtiquette, enseigne: string): void {
  const c = COTES;
  doc.setTextColor(0, 0, 0);

  // Nom du produit.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.text(ajuster(doc, e.nom, c.bordDroit - c.margeGauche), c.margeGauche, c.nomY);

  // Barres.
  doc.setFillColor(0, 0, 0);
  for (const r of rectsCode39(e.code, c.barresX, c.barresLargeur)) doc.rect(r.x, c.barresY, r.w, c.barresHauteur, 'F');
  doc.setFont('courier', 'bold'); doc.setFontSize(7);
  doc.text(e.sku, c.skuX, c.skuY, { align: 'center' });

  // Prix à droite — mesuré d'abord : c'est lui qui borne la colonne de gauche.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5);
  const prixGauche = c.bordDroit - doc.getTextWidth(e.prix);
  doc.text(e.prix, c.bordDroit, c.prixY, { align: 'right' });
  const largeurGauche = Math.max(8, prixGauche - c.espacePrix - c.margeGauche);

  // Enseigne, petit gras italique — seule sur la ligne du bas.
  const nomEnseigne = enseigne.trim();
  if (nomEnseigne) {
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(6.5);
    doc.text(ajuster(doc, nomEnseigne, largeurGauche), c.margeGauche, c.enseigneY);
  }
}
