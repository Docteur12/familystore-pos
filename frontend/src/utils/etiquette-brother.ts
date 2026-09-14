/**
 * Étiquette Brother 62 mm — le dessin, isolé pour être testé.
 *
 * La LARGEUR est celle du rouleau (62 mm). La HAUTEUR est la longueur coupée :
 * 29 mm par défaut (validé à la QL-800, douchette en main, septembre 2026),
 * réglable de 29 à 60 mm pour remplir un porte-étiquette plus haut — Radiance
 * (14/09/2026) : le cadre fait ~39 mm, la 29 laissait une bande vide au-dessus.
 *
 * Ce qui ne bouge pas avec la hauteur :
 *  - rien avant 5,6 mm en haut : la QL-800 n'imprime pas les ~2 premiers mm ;
 *  - barres de 4 à 58 mm de large — la chaîne qui se scanne ;
 *  - la dernière ligne reste à ~4 mm du bord bas : glissée dans un
 *    porte-étiquette, elle sortait cachée par le rail du support.
 * Ce qui s'étire : la hauteur des barres (mieux pour la douchette) et,
 * modérément, les polices.
 *
 * Bas de l'étiquette : à droite le PRIX, gros ; à gauche, en petit, l'ENSEIGNE
 * (gras italique), seule — « juste Radiance Essentials » (14/09). Elle vient
 * des paramètres du magasin ; vide, rien ne s'imprime à sa place — jamais le
 * nom d'un autre commerce ni celui du logiciel (même règle que STORE_FALLBACK).
 *
 * Aucune dépendance à la langue ni au stockage : l'appelant fournit les textes
 * déjà mis en forme (nom affiché, prix).
 */
import type { jsPDF } from 'jspdf';
import { rectsCode39 } from './code39';

export const BROTHER_62 = { largeur: 62, hauteur: 29 } as const;

/**
 * Hauteur PAR DÉFAUT (mm) : 39, celle des porte-étiquettes de Radiance
 * (demande du 14/09/2026). La 29 reste la référence des cotes validées.
 */
export const HAUTEUR_DEFAUT = 39;

/** Hauteurs proposées (mm) — la 29 est celle des étiquettes prédécoupées DK-11209. */
export const HAUTEURS_BROTHER = [29, 34, 39, 44, 50] as const;
export const HAUTEUR_MIN = 29;
export const HAUTEUR_MAX = 60;

/** Borne une hauteur saisie : hors plage ou absurde → la hauteur par défaut. */
export function hauteurValide(h: unknown): number {
  const n = Math.round(Number(h));
  if (!Number.isFinite(n) || n < HAUTEUR_MIN || n > HAUTEUR_MAX) return HAUTEUR_DEFAUT;
  return n;
}

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

export interface Cotes {
  hauteur: number;
  margeGauche: number; bordDroit: number;
  nomY: number; nomTaille: number;
  barresX: number; barresLargeur: number; barresY: number; barresHauteur: number;
  skuX: number; skuY: number;
  enseigneY: number; enseigneTaille: number;
  prixY: number; prixTaille: number;
  /** Blanc minimal entre l'enseigne et le prix. */
  espacePrix: number;
}

/**
 * Cotes (mm) pour une hauteur donnée. À 29 mm, ce sont exactement celles
 * validées à la QL-800 ; au-delà, les barres et les polices grandissent, la
 * ligne du bas reste à 4,4 mm du bord.
 */
export function cotes(hauteur: number = HAUTEUR_DEFAUT): Cotes {
  const h = hauteurValide(hauteur);
  const extra = h - BROTHER_62.hauteur;                 // 0 à 31 mm
  const k = Math.min(1.3, 1 + extra / 40);              // polices : +30 % au plus
  const barresHauteur = 9.2 + extra * 0.55;             // ~55 % du gain va aux barres
  const barresY = 6.8 + Math.max(0, (k - 1) * 3);       // le nom, plus grand, pousse un peu
  return {
    hauteur: h,
    margeGauche: 2, bordDroit: 60,
    nomY: 5.6 + Math.max(0, (k - 1) * 3), nomTaille: 9.5 * k,
    barresX: 4, barresLargeur: 54, barresY, barresHauteur,
    skuX: 31, skuY: barresY + barresHauteur + 2.6,
    enseigneY: h - 4.4, enseigneTaille: 6.5 * k,
    prixY: h - 4.0, prixTaille: 12.5 * k,
    espacePrix: 3,
  };
}

/** Cotes de la 29 mm — celles validées, gardées sous ce nom pour les tests. */
export const COTES = cotes(BROTHER_62.hauteur);

/** Coupe un texte avec « … » pour qu'il tienne dans `largeurMax` (mm), à la police courante. */
export function ajuster(doc: jsPDF, texte: string, largeurMax: number): string {
  if (doc.getTextWidth(texte) <= largeurMax) return texte;
  let t = texte;
  while (t.length > 1 && doc.getTextWidth(t + '…') > largeurMax) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

/** Taille de police minimale (pt) de l'enseigne avant de la couper. */
export const ENSEIGNE_TAILLE_MIN = 5;
/** Place (mm) que le prix doit laisser à l'enseigne avant de rétrécir lui-même. */
export const LARGEUR_MIN_ENSEIGNE = 18;

/**
 * Fait TENIR un texte dans `largeurMax` en réduisant la police d'abord (jusqu'à
 * `tailleMin`), en coupant avec « … » seulement si ça ne suffit pas. Renvoie la
 * taille retenue et le texte à écrire ; laisse la police réglée à cette taille.
 *
 * Radiance (14/09/2026) : à 39 mm, le prix grossit et « Radiance Essentials »
 * sortait « Radiance Essent… ». Une enseigne coupée est pire qu'une enseigne
 * un peu plus petite.
 */
export function faireTenir(doc: jsPDF, texte: string, largeurMax: number, taille: number, tailleMin = ENSEIGNE_TAILLE_MIN): { texte: string; taille: number } {
  let t = taille;
  doc.setFontSize(t);
  while (doc.getTextWidth(texte) > largeurMax && t - 0.5 >= tailleMin) { t -= 0.5; doc.setFontSize(t); }
  return { texte: ajuster(doc, texte, largeurMax), taille: t };
}

/** Dessine UNE étiquette sur la page courante du document, aux cotes de `hauteur`. */
export function dessinerEtiquetteBrother(doc: jsPDF, e: TextesEtiquette, enseigne: string, hauteur: number = HAUTEUR_DEFAUT): void {
  const c = cotes(hauteur);
  doc.setTextColor(0, 0, 0);

  // Nom du produit.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(c.nomTaille);
  doc.text(ajuster(doc, e.nom, c.bordDroit - c.margeGauche), c.margeGauche, c.nomY);

  // Barres.
  doc.setFillColor(0, 0, 0);
  for (const r of rectsCode39(e.code, c.barresX, c.barresLargeur)) doc.rect(r.x, c.barresY, r.w, c.barresHauteur, 'F');
  doc.setFont('courier', 'bold'); doc.setFontSize(7);
  doc.text(e.sku, c.skuX, c.skuY, { align: 'center' });

  // Prix à droite — mesuré d'abord : c'est lui qui borne la colonne de gauche.
  // Sur une étiquette haute, le prix grossit ; s'il ne laisse plus la place
  // minimale à l'enseigne, il redescend jusqu'à sa taille validée (29 mm).
  doc.setFont('helvetica', 'bold');
  let taillePrix = c.prixTaille;
  const placeGauche = () => c.bordDroit - doc.getTextWidth(e.prix) - c.espacePrix - c.margeGauche;
  doc.setFontSize(taillePrix);
  while (placeGauche() < LARGEUR_MIN_ENSEIGNE && taillePrix - 0.5 >= COTES.prixTaille) { taillePrix -= 0.5; doc.setFontSize(taillePrix); }
  doc.text(e.prix, c.bordDroit, c.prixY, { align: 'right' });
  const largeurGauche = Math.max(8, placeGauche());

  // Enseigne, petit gras italique — seule sur la ligne du bas. Elle rétrécit
  // pour tenir entière ; coupée seulement si même la plus petite ne tient pas.
  const nomEnseigne = enseigne.trim();
  if (nomEnseigne) {
    doc.setFont('helvetica', 'bolditalic');
    const { texte } = faireTenir(doc, nomEnseigne, largeurGauche, c.enseigneTaille);
    doc.text(texte, c.margeGauche, c.enseigneY);
  }
}
