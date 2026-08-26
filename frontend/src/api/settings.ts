import { jeton } from '../services/storage';
import { authHeaders } from './http';
import { t } from '../i18n';

// Offre marketing imprimée en pied de facture — les segments entre
// *astérisques* sont rendus en gras sur le ticket.
export interface OffreFacture {
  titre: string;
  message: string;
  validite: string;
  cta: string;
  salutation: string;
}

/**
 * Pied de ticket VIDE par défaut — miroir du défaut serveur
 * (`settings.schema.ts`).
 *
 * Il portait le nom « Family Store » et une remise de 5 %. Une boutique
 * neuve les aurait imprimés sur ses reçus sans les avoir décidés : une
 * promesse commerciale faite en son nom. Un pied vide ne gêne personne.
 */
export const OFFRE_DEFAULTS: OffreFacture = {
  titre:      '',
  message:    '',
  validite:   '',
  cta:        '',
  salutation: '',
};

export interface StoreSettings {
  nomMagasin: string;
  adresse: string;
  ville: string;
  telephone: string;
  email: string;
  devise: string;
  logoUrl: string;
  /** Manuel d utilisation de la boutique (PDF). Vide = pas d entree de menu. */
  manuelUrl: string;
  horaires: { ouverture: string; fermeture: string };
  reseauxSociaux: { facebook: string; whatsapp: string };
  langue: string;
  couleurPrincipale: string;
  couleurSecondaire?: string;      // palette « gold » (accents)
  // Identité imprimée (tickets, PDF, e-mails)
  slogan?: string;                 // ex. « Beauté • Saveur • Bien-être »
  signatureTicket?: string;        // ex. « BY RDCT »
  mentionsLegales?: string;        // ex. « NIU : … • RC : … »
  telephonesTicket?: string[];     // numéros imprimés sur le ticket
  // Modules activés (vide = tous). Voir MODULES_DISPONIBLES.
  // Contient les ids actifs, ou [MODULE_AUCUN] pour « aucun module optionnel ».
  modules?: string[];
  // Règles métier paramétrables
  metier?: { inactiviteMinutes?: number; seedFournisseursDemo?: boolean };
  offreFacture?: OffreFacture;
}

// Modules pouvant être désactivés par magasin (menus + routes).
export const MODULES_DISPONIBLES = [
  { id: 'partenaires', label: 'Partenaires (dépôt-vente, agences)' },
] as const;
export type ModuleId = (typeof MODULES_DISPONIBLES)[number]['id'];

// Sentinelle « aucun module optionnel actif ». Une liste vide signifie « tout
// actif » (rétro-compatibilité des documents Settings antérieurs) : on ne peut
// donc pas exprimer « rien » par [] — on sauvegarde [MODULE_AUCUN] à la place.
export const MODULE_AUCUN = 'aucun';

// Un module est actif s'il figure dans la liste — ou si la liste est vide
// (documents Settings antérieurs à l'introduction des modules : tout actif).
export function moduleActif(settings: Pick<StoreSettings, 'modules'>, id: ModuleId): boolean {
  const m = settings.modules;
  return !m || m.length === 0 || m.includes(id);
}

export const METIER_DEFAULTS = { inactiviteMinutes: 10, seedFournisseursDemo: true };

export const SETTINGS_DEFAULTS: StoreSettings = {
  // Vide : le nom réel arrive avec les paramètres de la boutique. L'interface
  // retombe sur « Caméléon » via nomEnseigne(), les tickets sur rien.
  nomMagasin: '',
  adresse: '',
  ville: 'Douala',
  telephone: '',
  email: '',
  devise: 'XAF',
  logoUrl: '',
  manuelUrl: '',
  horaires: { ouverture: '08:00', fermeture: '20:00' },
  reseauxSociaux: { facebook: '', whatsapp: '' },
  langue: 'fr',
  // Vert Cameleon — miroir du defaut serveur. Le defaut etait #FF0000, dont
  // applyPrimaryColor derivait un bordeaux : une boutique neuve sortait aux
  // couleurs de Family Store sans que personne l ait choisi.
  couleurPrincipale: '#3F8F6B',
  couleurSecondaire: '#B8893E',
  slogan: '',
  signatureTicket: '',
  mentionsLegales: '',
  telephonesTicket: [],
  modules: [],
  metier: { ...METIER_DEFAULTS },
  offreFacture: { ...OFFRE_DEFAULTS },
};

// Applique la couleur principale sur TOUTE la palette (50 → 900) afin que
// chaque élément qui utilise var(--fs-wine-*) suive la couleur de la boutique.
export function applyPrimaryColor(hex: string) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const shade = (f: number) => `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;            // plus sombre
  const tint  = (p: number) => `rgb(${Math.round(r + (255 - r) * p)},${Math.round(g + (255 - g) * p)},${Math.round(b + (255 - b) * p)})`; // plus clair
  const set = (k: string, v: string) => document.documentElement.style.setProperty(k, v);
  set('--fs-wine-900', shade(0.62));
  set('--fs-wine-800', shade(0.80));
  set('--fs-wine-700', hex);
  set('--fs-wine-600', tint(0.15));
  set('--fs-wine-500', tint(0.30));
  set('--fs-wine-400', tint(0.45));
  set('--fs-wine-300', tint(0.62));
  set('--fs-wine-200', tint(0.78));
  set('--fs-wine-100', tint(0.90));
  set('--fs-wine-50',  tint(0.95));
}

/**
 * Retire les couleurs de boutique posées sur la racine du document.
 *
 * ═══ POURQUOI CE N'EST PAS FACULTATIF ═══
 *
 * `applyPrimaryColor` et `applySecondaryColor` écrivent des propriétés CSS
 * personnalisées EN LIGNE sur `documentElement`. Elles survivent à tout, sauf
 * à un rechargement complet de la page.
 *
 * Onze des quatorze déconnexions faisaient `window.location.href = '/login'`
 * — rechargement, donc remise à zéro fortuite. Trois faisaient
 * `navigate('/login')`, une navigation côté client : l'écran de connexion
 * gardait alors les couleurs de la boutique qu'on venait de quitter. Sur un
 * poste partagé, l'utilisateur suivant voyait l'enseigne du précédent.
 *
 * Dépendre du fait que chaque appelant recharge la page est une garantie
 * fragile : il suffit d'un quinzième appel écrit autrement. La remise à zéro
 * est donc faite dans `deconnexion()`, une fois, pour tous.
 */
export function reinitialiserTheme(): void {
  try {
    const racine = document.documentElement.style;
    for (const palette of ['wine', 'gold']) {
      for (const ton of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
        racine.removeProperty(`--fs-${palette}-${ton}`);
      }
    }
  } catch { /* pas de DOM (test, rendu serveur) : rien à nettoyer */ }
}

// Palette secondaire (« gold ») : accents, titres de la caisse, focus.
export function applySecondaryColor(hex: string) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const shade = (f: number) => `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
  const tint  = (p: number) => `rgb(${Math.round(r + (255 - r) * p)},${Math.round(g + (255 - g) * p)},${Math.round(b + (255 - b) * p)})`;
  const set = (k: string, v: string) => document.documentElement.style.setProperty(k, v);
  set('--fs-gold-900', shade(0.50));
  set('--fs-gold-800', shade(0.62));
  set('--fs-gold-700', shade(0.75));
  set('--fs-gold-600', shade(0.89));
  set('--fs-gold-500', hex);
  set('--fs-gold-400', tint(0.35));
  set('--fs-gold-300', tint(0.60));
  set('--fs-gold-200', tint(0.75));
  set('--fs-gold-100', tint(0.87));
  set('--fs-gold-50',  tint(0.94));
}

export async function getSettings(): Promise<StoreSettings> {
  const token = jeton();
  try {
    // Sans session : identité publique du magasin (nom, logo, couleurs, langue)
    // pour habiller la page de connexion et l'écran PIN.
    if (!token) {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return SETTINGS_DEFAULTS;
      return { ...SETTINGS_DEFAULTS, ...(await res.json()) };
    }
    const res = await fetch('/api/settings', { headers: authHeaders() });
    if (!res.ok) return SETTINGS_DEFAULTS;
    return { ...SETTINGS_DEFAULTS, ...(await res.json()) };
  } catch {
    return SETTINGS_DEFAULTS;
  }
}

export async function updateSettings(data: Partial<StoreSettings>): Promise<StoreSettings> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(t('Erreur sauvegarde paramètres', 'Error saving settings'));
  return res.json();
}

// ── Identité imprimée sur les tickets (en-tête + coordonnées) ────────────────
export interface StoreIdentity {
  nom: string;             // « Family Store »
  signature: string;       // « BY RDCT » — vide : ligne omise
  slogan: string;          // « Beauté • Saveur • Bien-être » — vide : ligne omise
  mentionsLegales: string; // « NIU : … • RC : … » — vide : ligne omise
  adresse: string;         // « Bonamoussadi – Douala »
  telephones: string[];    // numéros affichés à droite de l'en-tête
}

export function storeIdentity(s: StoreSettings): StoreIdentity {
  // « adresse – ville », sans répéter la ville si l'adresse la contient déjà.
  const a = (s.adresse ?? '').trim(), v = (s.ville ?? '').trim();
  const adresse = a && v && !a.toLowerCase().includes(v.toLowerCase()) ? `${a} – ${v}` : (a || v);
  const tels = (s.telephonesTicket ?? []).map(x => (x ?? '').trim()).filter(Boolean);
  return {
    // Vide plutôt qu'une enseigne : c'est cette valeur qui s'imprime en tête
    // du ticket remis au client. Voir STORE_FALLBACK dans ReceiptPrint.tsx.
    nom:             (s.nomMagasin || '').trim(),
    signature:       (s.signatureTicket ?? '').trim(),
    slogan:          (s.slogan ?? '').trim(),
    mentionsLegales: (s.mentionsLegales ?? '').trim(),
    adresse,
    telephones:      tels.length ? tels : ((s.telephone ?? '').trim() ? [s.telephone.trim()] : []),
  };
}
