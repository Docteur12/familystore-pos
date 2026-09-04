/**
 * Encodage Code39 — LA source unique des codes-barres d'étiquettes.
 *
 * L'aperçu à l'écran (canvas) et l'impression (HTML) doivent produire le
 * MÊME code : la page Étiquettes dessinait un vrai Code39 à l'écran, mais
 * imprimait des barres décoratives calculées sur les codes des caractères —
 * jolies, et illisibles pour toute douchette. Le client scannait du vide.
 *
 * Chaque caractère = 9 éléments (5 barres + 4 espaces), étroits ou larges ;
 * un espace étroit sépare deux caractères ; « * » ouvre et ferme le code.
 * Rapport large/étroit : 2,5 (la norme admet 2 à 3).
 */

export const CODE39_MAP: Record<string, string> = {
  '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn',
  '4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw',
  '8':'wnnwnnwnn','9':'nnwwnnwnn','A':'wnnnnwnnw','B':'nnwnnwnnw',
  'C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn',
  'G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
  'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww',
  'O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn',
  // « - », espace et « * » : motifs de la NORME. L'ancienne table locale les
  // avait faux (« * » comptait 4 éléments larges au lieu de 3) — le délimiteur
  // ouvrant/fermant de CHAQUE code était invalide, donc aucun code n'était
  // scannable, même à l'écran. Le test « 3 de 9 » verrouille désormais chaque
  // motif.
  'S':'nnwnnnwwn','T':'nnnnwnwwn','-':'nwnnnnwnw',' ':'nwwnnnwnn',
  '*':'nwnnwnwnn',
};

export const RAPPORT_LARGE = 2.5;   // largeur d'un élément large, en unités étroites

export interface ElementCode39 {
  barre: boolean;   // true = barre noire, false = espace blanc
  unites: number;   // largeur en unités étroites (1 ou RAPPORT_LARGE)
}

/**
 * Suite complète des barres et espaces de `*texte*`, en unités étroites.
 * Un caractère absent de la table est ignoré (même comportement que le canvas).
 */
export function elementsCode39(texte: string): ElementCode39[] {
  const encode = `*${texte.toUpperCase()}*`;
  const elements: ElementCode39[] = [];
  for (let c = 0; c < encode.length; c++) {
    const motif = CODE39_MAP[encode[c]];
    if (!motif) continue;
    if (elements.length > 0) elements.push({ barre: false, unites: 1 });  // espace inter-caractère
    for (let i = 0; i < 9; i++) {
      elements.push({ barre: i % 2 === 0, unites: motif[i] === 'w' ? RAPPORT_LARGE : 1 });
    }
  }
  return elements;
}

/** Largeur totale du code, en unités étroites — pour dimensionner en %. */
export function totalUnites(elements: ElementCode39[]): number {
  return elements.reduce((s, e) => s + e.unites, 0);
}

/**
 * Rendu HTML du code — barres en pourcentage de la largeur du conteneur :
 * les RAPPORTS de largeur sont préservés quelle que soit la taille imprimée,
 * c'est eux que lit la douchette. Le conteneur doit être en `display:flex`.
 */
export function barresHtml(texte: string): string {
  const elements = elementsCode39(texte);
  const total = totalUnites(elements);
  if (total === 0) return '';
  return elements
    .map(e => `<div style="width:${((e.unites / total) * 100).toFixed(4)}%;background:${e.barre ? '#000' : 'transparent'}"></div>`)
    .join('');
}

/** Dessin sur canvas — l'aperçu à l'écran. Même encodage que l'impression. */
export function drawCode39(canvas: HTMLCanvasElement, texte: string, color = '#111', unite = 2): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let x = 8;
  const h = canvas.height - 4;
  for (const e of elementsCode39(texte)) {
    const w = e.unites * unite;
    if (e.barre) {
      ctx.fillStyle = color;
      ctx.fillRect(x, 2, w, h);
    }
    x += w;
  }
}
