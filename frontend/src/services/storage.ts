/**
 * Stockage local cloisonné par boutique — l'équivalent client du plugin
 * Mongoose côté serveur, avec la même exigence : **fail-closed**.
 *
 * Jusqu'ici un navigateur = une boutique, et les clés étaient globales
 * (`pending_sales`, `products`, `access_token`…). Avec Caméléon, le même
 * utilisateur bascule entre ses boutiques dans la même session : sans
 * cloisonnement, le stock de Bonamoussadi s'afficherait à Bependa et une
 * vente en attente partirait sur la mauvaise boutique.
 *
 * Règles :
 *  1. toute clé de données porte le préfixe `cam:<boutiqueId>:` ;
 *  2. lire ou écrire une donnée de boutique SANS boutique active LÈVE
 *     (`BoutiqueNonDefinieError`) — jamais de repli silencieux sur une clé
 *     globale, qui rouvrirait exactement le trou qu'on ferme ;
 *  3. seules les clés de `CLES_GLOBALES` échappent au cloisonnement, et la
 *     liste est fermée : ce sont des réglages d'APPAREIL (langue affichée,
 *     configuration de l'imprimante posée sur le comptoir), pas des données
 *     de boutique ;
 *  4. chaque boutique a SON jeton : la file de Bonamoussadi peut donc se
 *     synchroniser avec le jeton de Bonamoussadi pendant qu'on consulte
 *     Bependa (voir `jetonDeBoutique`).
 *
 * TOUT accès au stockage passe par ce module : `storage-governance.spec.ts`
 * échoue si un `localStorage.` / `sessionStorage.` / `idb-keyval` direct
 * réapparaît ailleurs dans `src/`.
 */
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';

const PREFIXE = 'cam';

/** Pointeur (global) vers la boutique consultée en ce moment. */
const CLE_BOUTIQUE_ACTIVE = `${PREFIXE}:boutique_active`;

/** Suffixe du jeton, par boutique. */
const CLE_JETON = 'access_token';

/**
 * Réglages d'appareil, volontairement NON cloisonnés. Liste fermée : toute
 * addition doit être un choix conscient, pas un oubli de préfixe.
 *  - `app_lang` : la langue est relue de `Settings.langue` à chaque
 *    chargement ; la stocker par boutique la ferait osciller sans bénéfice ;
 *  - `fs_print_settings` : décrit l'imprimante branchée sur ce poste.
 */
export const CLES_GLOBALES = ['app_lang', 'fs_print_settings'] as const;
export type CleGlobale = (typeof CLES_GLOBALES)[number];

/** Clés de session (durée de l'onglet), sans donnée de boutique. */
export const CLES_SESSION = ['fs_session_ouverte', 'session_expired'] as const;
export type CleSession = (typeof CLES_SESSION)[number];

/** Levée dès qu'on touche une donnée de boutique sans boutique active. */
export class BoutiqueNonDefinieError extends Error {
  constructor(operation: string) {
    super(
      `Stockage local : aucune boutique active pour « ${operation} ». ` +
        'Aucun repli sur une clé globale — voir services/storage.ts.',
    );
    this.name = 'BoutiqueNonDefinieError';
  }
}

// ── Boutique active ──────────────────────────────────────────────────────────

export function boutiqueActive(): string | null {
  try {
    return localStorage.getItem(CLE_BOUTIQUE_ACTIVE);
  } catch {
    return null; // stockage indisponible (navigation privée)
  }
}

/** Identifiant de la boutique active, ou lève. Base du fail-closed. */
export function exigerBoutiqueActive(operation = 'accès au stockage'): string {
  const id = boutiqueActive();
  if (!id) throw new BoutiqueNonDefinieError(operation);
  return id;
}

export function definirBoutiqueActive(boutiqueId: string): void {
  if (!boutiqueId) throw new Error('definirBoutiqueActive : identifiant vide');
  localStorage.setItem(CLE_BOUTIQUE_ACTIVE, boutiqueId);
}

export function oublierBoutiqueActive(): void {
  localStorage.removeItem(CLE_BOUTIQUE_ACTIVE);
}

/** Clé complète d'une donnée : `cam:<boutiqueId>:<cle>`. */
export function cleDeBoutique(cle: string, boutiqueId?: string): string {
  const id = boutiqueId ?? exigerBoutiqueActive(cle);
  return `${PREFIXE}:${id}:${cle}`;
}

// ── localStorage cloisonné ───────────────────────────────────────────────────

export function lire(cle: string, boutiqueId?: string): string | null {
  return localStorage.getItem(cleDeBoutique(cle, boutiqueId));
}

export function ecrire(cle: string, valeur: string, boutiqueId?: string): void {
  localStorage.setItem(cleDeBoutique(cle, boutiqueId), valeur);
}

export function supprimer(cle: string, boutiqueId?: string): void {
  localStorage.removeItem(cleDeBoutique(cle, boutiqueId));
}

/** Lecture JSON tolérante : une valeur illisible vaut « absente ». */
export function lireJson<T>(cle: string, defaut: T, boutiqueId?: string): T {
  try {
    const brut = lire(cle, boutiqueId);
    return brut === null ? defaut : (JSON.parse(brut) as T);
  } catch (e) {
    if (e instanceof BoutiqueNonDefinieError) throw e; // le fail-closed ne se rattrape pas
    return defaut;
  }
}

export function ecrireJson(cle: string, valeur: unknown, boutiqueId?: string): void {
  ecrire(cle, JSON.stringify(valeur), boutiqueId);
}

// ── Réglages globaux (liste fermée) ──────────────────────────────────────────

export function lireGlobal(cle: CleGlobale): string | null {
  verifierGlobale(cle);
  try { return localStorage.getItem(cle); } catch { return null; }
}

export function ecrireGlobal(cle: CleGlobale, valeur: string): void {
  verifierGlobale(cle);
  try { localStorage.setItem(cle, valeur); } catch { /* stockage plein : non bloquant */ }
}

function verifierGlobale(cle: string): void {
  if (!(CLES_GLOBALES as readonly string[]).includes(cle)) {
    throw new Error(
      `« ${cle} » n'est pas une clé globale déclarée. Une donnée de boutique ` +
        'doit être cloisonnée (lire/ecrire), pas rangée en global.',
    );
  }
}

// ── sessionStorage (durée de l'onglet) ───────────────────────────────────────

export function lireSession(cle: CleSession): string | null {
  try { return sessionStorage.getItem(cle); } catch { return null; }
}

export function ecrireSession(cle: CleSession, valeur: string): void {
  try { sessionStorage.setItem(cle, valeur); } catch { /* non bloquant */ }
}

export function supprimerSession(cle: CleSession): void {
  try { sessionStorage.removeItem(cle); } catch { /* non bloquant */ }
}

// ── Jetons, un par boutique ──────────────────────────────────────────────────

/** Jeton de la boutique active (null si aucune boutique ou aucun jeton). */
export function jeton(): string | null {
  const id = boutiqueActive();
  return id ? localStorage.getItem(cleDeBoutique(CLE_JETON, id)) : null;
}

/**
 * Jeton d'une boutique précise — indispensable pour synchroniser la file
 * d'une boutique qui n'est pas celle qu'on consulte (exigence 3).
 */
export function jetonDeBoutique(boutiqueId: string): string | null {
  return localStorage.getItem(cleDeBoutique(CLE_JETON, boutiqueId));
}

/** Pose le jeton d'une boutique ET en fait la boutique active. */
export function definirJeton(boutiqueId: string, jetonAcces: string): void {
  definirBoutiqueActive(boutiqueId);
  localStorage.setItem(cleDeBoutique(CLE_JETON, boutiqueId), jetonAcces);
}

export function supprimerJeton(boutiqueId: string): void {
  localStorage.removeItem(cleDeBoutique(CLE_JETON, boutiqueId));
}

/**
 * Déconnexion : AUCUN jeton dormant ne survit, y compris ceux des boutiques
 * qu'on ne consultait pas. Les files hors-ligne, elles, ne sont pas touchées
 * ici — c'est l'appelant qui prévient l'utilisateur avant toute purge
 * (exigence 5).
 */
export function supprimerTousLesJetons(): void {
  for (const id of boutiquesConnues()) supprimerJeton(id);
  oublierBoutiqueActive();
}

/** Boutiques ayant une trace locale (jeton posé au moins une fois). */
export function boutiquesConnues(): string[] {
  const ids = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      const m = cle?.match(new RegExp(`^${PREFIXE}:([^:]+):`));
      if (m) ids.add(m[1]);
    }
  } catch { /* stockage indisponible */ }
  return [...ids];
}

// ── Purge ────────────────────────────────────────────────────────────────────

/** Efface TOUTES les clés locales d'une boutique (jeton compris). */
export function purgerBoutique(boutiqueId: string): void {
  const prefixe = `${PREFIXE}:${boutiqueId}:`;
  try {
    const aSupprimer: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (cle?.startsWith(prefixe)) aSupprimer.push(cle);
    }
    for (const cle of aSupprimer) localStorage.removeItem(cle);
  } catch { /* stockage indisponible */ }
}

// ── IndexedDB cloisonné (idb-keyval) ─────────────────────────────────────────

export async function idbLire<T>(cle: string, boutiqueId?: string): Promise<T | undefined> {
  return idbGet<T>(cleDeBoutique(cle, boutiqueId));
}

export async function idbEcrire(cle: string, valeur: unknown, boutiqueId?: string): Promise<void> {
  return idbSet(cleDeBoutique(cle, boutiqueId), valeur);
}

export async function idbSupprimer(cle: string, boutiqueId?: string): Promise<void> {
  return idbDel(cleDeBoutique(cle, boutiqueId));
}

/** Efface les données IndexedDB d'une boutique. */
export async function idbPurgerBoutique(boutiqueId: string): Promise<void> {
  const prefixe = `${PREFIXE}:${boutiqueId}:`;
  const toutes = await idbKeys();
  for (const cle of toutes) {
    if (typeof cle === 'string' && cle.startsWith(prefixe)) await idbDel(cle);
  }
}

// ── Utilitaire : boutique portée par un jeton ────────────────────────────────

/**
 * `tenantId` inscrit dans le JWT à l'émission. C'est l'identifiant de boutique
 * qui fait autorité : il vient du serveur, pas d'un choix local.
 */
export function boutiqueDuJeton(jetonAcces: string): string | null {
  try {
    const charge = JSON.parse(atob(jetonAcces.split('.')[1]));
    return charge?.tenantId ?? null;
  } catch {
    return null;
  }
}
