/**
 * Logo affiché quand le magasin n'a pas (encore) téléversé le sien.
 *
 * Incident HERVAN (16/09/2026) : le site hervan-pos.netlify.app, ouvert le
 * matin même, montrait le logo FAMILY STORE au-dessus de « HERVAN Élite » sur
 * l'écran de connexion — le repli `logo-fs.jpg` était codé en dur dans
 * StoreLogo et AdminSidebar. Une boutique neuve arborait l'enseigne d'un
 * autre commerçant tant que son patron n'avait rien téléversé.
 *
 * Ordre de repli, du plus précis au plus neutre :
 *  1. `Settings.logoUrl` — le logo téléversé par le magasin (Paramètres) ;
 *  2. le logo de MARQUE du build : `VITE_LOGO_MARQUE`, posé par vite.config.ts
 *     quand `public/brand/<VITE_BRAND_ICONS>/logo.png` existe (HERVAN) ;
 *  3. sans jeu d'icônes (`VITE_BRAND_ICONS` vide = build par défaut, qui est
 *     celui de Family Store — voir .env.production) : `logo-fs.jpg`, comme
 *     avant. Family Store n'a pas de logoUrl en base et ne doit rien perdre ;
 *  4. sinon RIEN : l'appelant écrit le nom du magasin en toutes lettres.
 *
 * Le littéral `logo-fs.jpg` ne vit plus qu'ICI — logo-marque.spec.ts refuse
 * sa réapparition dans les composants.
 */
import logoFs from '../assets/logo-fs.jpg';

/**
 * Manuel d'utilisation (PDF) du build, ou chaîne vide s'il n'y en a pas — le
 * menu cache alors l'entrée. Même incident HERVAN : le lien pointait en dur
 * sur /manuel-family-store.pdf, un manuel de 29 pages au nom et aux couleurs
 * d'un autre commerce, servi tel quel sur hervan-pos (et sur Radiance, en
 * français, depuis le 21/08). Repli : `VITE_MANUEL_URL` (posé par
 * vite.config.ts quand public/brand/<VITE_BRAND_ICONS>/manuel.pdf existe,
 * servi en /manuel.pdf) ; build par défaut → le manuel Family Store ; jeu
 * d'icônes sans manuel → rien.
 */
export function manuelUrl(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): string {
  const marque = String(env.VITE_MANUEL_URL ?? '').trim();
  if (marque) return marque;
  const icones = String(env.VITE_BRAND_ICONS ?? '').trim();
  return icones ? '' : '/manuel-family-store.pdf';
}

/**
 * Les MAQUETTES (écrans sans backend, données dans le localStorage du poste)
 * ne s'affichent que sur le build par défaut. Cas vécu (HERVAN, 16/09/2026) :
 * la page « Dépôts » montrait « Dépôt principal — Rue de la Joie, Akwa »,
 * « Entrepôt secondaire », « 4 dépôts » — l'adresse d'un autre commerce et
 * des transferts qui ne touchent aucun stock réel. Un client qui découvre le
 * logiciel ne peut pas savoir que c'est une maquette. Cachée hors du build par
 * défaut tant qu'un vrai module n'existe pas.
 */
export function maquettesVisibles(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): boolean {
  return !String(env.VITE_BRAND_ICONS ?? '').trim();
}

/** URL du logo à afficher, ou chaîne vide si l'on doit écrire le nom. */
export function logoAffiche(logoUrl?: string | null, env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): string {
  const propre = String(logoUrl ?? '').trim();
  if (propre) return propre;
  const marque = String(env.VITE_LOGO_MARQUE ?? '').trim();
  if (marque) return marque;
  const icones = String(env.VITE_BRAND_ICONS ?? '').trim();
  return icones ? '' : logoFs;
}
