import { authHeaders } from './http';

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
  offreFacture?: OffreFacture;
}

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

export async function getSettings(): Promise<StoreSettings> {
  const token = localStorage.getItem('access_token');
  if (!token) return SETTINGS_DEFAULTS;
  try {
    const res = await fetch('/api/settings', { headers: authHeaders() });
    if (!res.ok) return SETTINGS_DEFAULTS;
    return res.json();
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
  if (!res.ok) throw new Error('Erreur sauvegarde paramètres');
  return res.json();
}
