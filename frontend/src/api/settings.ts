import { authHeaders } from './http';

export interface StoreSettings {
  nomMagasin: string;
  adresse: string;
  ville: string;
  telephone: string;
  email: string;
  tva: number;
  devise: string;
  logoUrl: string;
  horaires: { ouverture: string; fermeture: string };
  reseauxSociaux: { facebook: string; whatsapp: string };
  langue: string;
  couleurPrincipale: string;
}

export const SETTINGS_DEFAULTS: StoreSettings = {
  nomMagasin: 'Family Store',
  adresse: '',
  ville: 'Douala',
  telephone: '',
  email: '',
  tva: 19.25,
  devise: 'XAF',
  logoUrl: '',
  horaires: { ouverture: '08:00', fermeture: '20:00' },
  reseauxSociaux: { facebook: '', whatsapp: '' },
  langue: 'fr',
  couleurPrincipale: '#7A1D2E',
};

// Applique la couleur principale sur toutes les CSS variables
export function applyPrimaryColor(hex: string) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (f: number) => `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
  document.documentElement.style.setProperty('--fs-wine-700', hex);
  document.documentElement.style.setProperty('--fs-wine-800', darken(0.8));
  document.documentElement.style.setProperty('--fs-wine-900', darken(0.62));
  document.documentElement.style.setProperty('--fs-wine-100', `rgba(${r},${g},${b},0.1)`);
  document.documentElement.style.setProperty('--fs-wine-50',  `rgba(${r},${g},${b},0.05)`);
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
