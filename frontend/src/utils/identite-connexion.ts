/**
 * Ce que l'écran de connexion affiche AVANT que quiconque soit identifié.
 *
 * Règle tranchée le 26/08/2026 (CLAUDE.md « Identité avant connexion ») :
 *  - **mode single** — un domaine par client : le domaine EST l'identification.
 *    L'écran porte le logo, le nom et la couleur du magasin, comme chez
 *    Family Store et Radiance aujourd'hui ;
 *  - **mode multi** — origine partagée : on ne sait pas encore chez qui l'on
 *    entre. L'écran reste Caméléon, neutre.
 *
 * Le serveur dit le mode dans `GET /api/settings/public` (`mode`). Sans cette
 * information — serveur ancien, hors-ligne, cache d'une autre boutique — on
 * reste neutre : afficher l'enseigne d'un autre commerçant est l'erreur que
 * personne ne remarque.
 */
import type { StoreSettings } from '../api/settings';
import { COULEUR_MARQUE } from '../config/marque';

export interface IdentiteConnexion {
  /** Vrai : Caméléon neutre. Faux : l'identité du magasin ci-dessous. */
  neutre: boolean;
  nom: string;
  logoUrl: string;
  /** Couleur du bouton et du filet — celle du magasin, ou le vert Caméléon. */
  couleur: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function identiteConnexion(s: Partial<StoreSettings> | null | undefined): IdentiteConnexion {
  const neutre = { neutre: true, nom: 'Caméléon', logoUrl: '', couleur: COULEUR_MARQUE };
  if (!s || s.modeIdentite !== 'single') return neutre;
  const nom = String(s.nomMagasin ?? '').trim();
  if (!nom) return neutre;   // boutique sans nom : rien à afficher de vrai
  const couleur = HEX.test(s.couleurPrincipale ?? '') ? s.couleurPrincipale! : COULEUR_MARQUE;
  return { neutre: false, nom, logoUrl: String(s.logoUrl ?? '').trim(), couleur };
}

/** Assombrit une couleur hex — survol du bouton. */
export function assombrir(hex: string, facteur = 0.82): string {
  if (!HEX.test(hex)) return hex;
  const c = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * facteur);
  return `rgb(${c(1)},${c(3)},${c(5)})`;
}
