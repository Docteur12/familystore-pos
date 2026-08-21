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

export const OFFRE_DEFAULTS: OffreFacture = {
  titre:      '',
  message:    'Pour vous remercier, *Family Store vous offre 5 %* de réduction sur votre prochain achat. Présentez simplement cette facture à la caisse pour bénéficier de cette offre.',
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
  modules?: ModuleId[];
  // Règles métier paramétrables
  metier?: { inactiviteMinutes?: number; seedFournisseursDemo?: boolean };
  offreFacture?: OffreFacture;
}

// Modules pouvant être désactivés par magasin (menus + routes).
export const MODULES_DISPONIBLES = [
  { id: 'partenaires', label: 'Partenaires (dépôt-vente, agences)' },
] as const;
export type ModuleId = (typeof MODULES_DISPONIBLES)[number]['id'];

// Un module est actif s'il figure dans la liste — ou si la liste est vide
// (documents Settings antérieurs à l'introduction des modules : tout actif).
export function moduleActif(settings: Pick<StoreSettings, 'modules'>, id: ModuleId): boolean {
  const m = settings.modules;
  return !m || m.length === 0 || m.includes(id);
}

export const METIER_DEFAULTS = { inactiviteMinutes: 10, seedFournisseursDemo: true };

export const SETTINGS_DEFAULTS: StoreSettings = {
  nomMagasin: 'Family Store',
  adresse: '',
  ville: 'Douala',
  telephone: '',
  email: '',
  devise: 'XAF',
  logoUrl: '',
  horaires: { ouverture: '08:00', fermeture: '20:00' },
  reseauxSociaux: { facebook: '', whatsapp: '' },
  langue: 'fr',
  couleurPrincipale: '#FF0000',
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
  const token = localStorage.getItem('access_token');
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
    nom:             (s.nomMagasin || '').trim() || 'Family Store',
    signature:       (s.signatureTicket ?? '').trim(),
    slogan:          (s.slogan ?? '').trim(),
    mentionsLegales: (s.mentionsLegales ?? '').trim(),
    adresse,
    telephones:      tels.length ? tels : ((s.telephone ?? '').trim() ? [s.telephone.trim()] : []),
  };
}
