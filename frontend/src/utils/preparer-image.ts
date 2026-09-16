/**
 * Préparation d'une photo de facture AVANT envoi au serveur — pensé pour le
 * téléphone, chez le fournisseur, souvent à l'étranger en itinérance.
 *
 * Pourquoi (HERVAN, 16/09/2026) : la photo partait telle quelle. Un téléphone
 * d'aujourd'hui produit 3 à 12 Mo par cliché ; au-delà de ~6 Mo la requête
 * est refusée (limite JSON 10 Mo après base64), au-delà de 5 Mo l'API de
 * lecture refuse l'image, et chaque envoi coûtait des mégaoctets de données
 * mobiles là où 300 Ko suffisent. Une facture A4 lue à 2 000 px de large est
 * parfaitement lisible pour le lecteur.
 *
 * Ce que fait `preparerFichierFacture` :
 *  - PDF, ou fichier qui n'est pas une image → inchangé ;
 *  - image petite et déjà en JPEG/PNG/WEBP → inchangée ;
 *  - sinon : décodage (orientation EXIF respectée), réduction à
 *    COTE_MAX px sur le grand côté, ré-encodage JPEG à QUALITE — ce qui
 *    convertit aussi le HEIC des iPhone quand le navigateur sait le lire ;
 *  - en cas d'échec (navigateur sans canvas, format indéchiffrable) : le
 *    fichier d'origine est renvoyé et c'est le serveur qui explique.
 *
 * Les calculs sont isolés (`dimensionsCible`, `doitReduire`) pour être testés
 * sans canvas.
 */

/** Grand côté maximal (px) après réduction — assez pour les petits caractères d'une facture. */
export const COTE_MAX = 2000;
/** Qualité JPEG du ré-encodage. */
export const QUALITE = 0.85;
/** En dessous de ce poids, une image déjà dans un format accepté part telle quelle. */
export const POIDS_SANS_REDUCTION = 600 * 1024;
/** Formats que le serveur accepte pour une image. */
export const FORMATS_IMAGE_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/** Dimensions après réduction : le grand côté ramené à `max`, proportions conservées, jamais agrandi. */
export function dimensionsCible(largeur: number, hauteur: number, max: number = COTE_MAX): { largeur: number; hauteur: number } {
  const grand = Math.max(largeur, hauteur);
  if (grand <= max || grand <= 0) return { largeur, hauteur };
  const k = max / grand;
  return { largeur: Math.max(1, Math.round(largeur * k)), hauteur: Math.max(1, Math.round(hauteur * k)) };
}

/** Faut-il passer l'image par la réduction ? (type et poids seulement — sans décoder) */
export function doitReduire(f: { type: string; size: number }): boolean {
  const type = (f.type || '').toLowerCase();
  if (type === 'application/pdf') return false;
  if (!type.startsWith('image/')) return false;
  if (!(FORMATS_IMAGE_ACCEPTES as readonly string[]).includes(type)) return true;   // HEIC, TIFF, BMP…
  return f.size > POIDS_SANS_REDUCTION;
}

/** Message d'aide quand un format d'image n'a pas pu être converti (HEIC des iPhone, typiquement). */
export function conseilFormat(type: string, t: (fr: string, en: string) => string): string | null {
  if (/heic|heif/i.test(type)) {
    return t(
      'Photo au format HEIC non prise en charge par ce navigateur. Sur iPhone : Réglages → Appareil photo → Formats → « Le plus compatible », puis reprenez la photo — ou prenez-la directement avec le bouton « Prendre en photo ».',
      'HEIC photo not supported by this browser. On iPhone: Settings → Camera → Formats → “Most Compatible”, then retake the photo — or take it directly with the “Take a photo” button.',
    );
  }
  return null;
}

async function decoder(f: File): Promise<{ source: CanvasImageSource; largeur: number; hauteur: number; liberer: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bmp, largeur: bmp.width, hauteur: bmp.height, liberer: () => bmp.close?.() };
    } catch { /* on retombe sur <img> */ }
  }
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image indéchiffrable'));
      i.src = url;
    });
    return { source: img, largeur: img.naturalWidth, hauteur: img.naturalHeight, liberer: () => URL.revokeObjectURL(url) };
  } catch (e) { URL.revokeObjectURL(url); throw e; }
}

/**
 * Renvoie le fichier à envoyer : réduit et ré-encodé en JPEG si utile, sinon
 * l'original. Ne lève jamais : en cas d'échec, l'original est renvoyé.
 */
export async function preparerFichierFacture(f: File): Promise<File> {
  if (!doitReduire(f)) return f;
  try {
    const { source, largeur, hauteur, liberer } = await decoder(f);
    try {
      const cible = dimensionsCible(largeur, hauteur);
      const canvas = document.createElement('canvas');
      canvas.width = cible.largeur; canvas.height = cible.hauteur;
      const ctx = canvas.getContext('2d');
      if (!ctx) return f;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);   // fond blanc sous un PNG transparent
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITE));
      if (!blob) return f;
      // Une réduction qui alourdit n'a pas de sens — sauf si le format d'origine n'est pas accepté.
      const formatAccepte = (FORMATS_IMAGE_ACCEPTES as readonly string[]).includes((f.type || '').toLowerCase());
      if (formatAccepte && blob.size >= f.size) return f;
      const nom = f.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
      return new File([blob], nom, { type: 'image/jpeg', lastModified: Date.now() });
    } finally { liberer(); }
  } catch {
    return f;
  }
}
