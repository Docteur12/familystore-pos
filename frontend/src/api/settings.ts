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
};

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
