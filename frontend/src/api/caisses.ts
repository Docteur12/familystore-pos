import { authHeaders } from './http';
import { t } from '../i18n';

export interface CaisseRecord {
  _id:   string;
  nom:   string;
  code:  string;
  pin:   string;
  ville: string;
}

export async function getCaisses(): Promise<CaisseRecord[]> {
  const res = await fetch('/api/caisses', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement caisses', 'Failed to load registers'));
  return res.json();
}

export async function createCaisse(data: { nom: string; code: string; pin: string; ville?: string }): Promise<CaisseRecord> {
  const res = await fetch('/api/caisses', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 409) throw new Error(t(`Le code ${data.code} est déjà utilisé`, `Code ${data.code} is already in use`));
  if (!res.ok) throw new Error(t('Erreur création caisse', 'Failed to create register'));
  return res.json();
}

export async function updateCaisse(id: string, data: Partial<{ nom: string; pin: string; ville: string }>): Promise<CaisseRecord> {
  const res = await fetch(`/api/caisses/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(t('Erreur modification caisse', 'Failed to update register'));
  return res.json();
}

export async function deleteCaisse(id: string): Promise<void> {
  const res = await fetch(`/api/caisses/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(t('Erreur suppression caisse', 'Failed to delete register'));
}
