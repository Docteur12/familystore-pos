import { authHeaders } from './http';

export interface CaisseRecord {
  _id:   string;
  nom:   string;
  code:  string;
  pin:   string;
  ville: string;
}

export async function getCaisses(): Promise<CaisseRecord[]> {
  const res = await fetch('/api/caisses', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement caisses');
  return res.json();
}

export async function createCaisse(data: { nom: string; code: string; pin: string; ville?: string }): Promise<CaisseRecord> {
  const res = await fetch('/api/caisses', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 409) throw new Error(`Le code ${data.code} est déjà utilisé`);
  if (!res.ok) throw new Error('Erreur création caisse');
  return res.json();
}

export async function updateCaisse(id: string, data: Partial<{ nom: string; pin: string; ville: string }>): Promise<CaisseRecord> {
  const res = await fetch(`/api/caisses/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur modification caisse');
  return res.json();
}

export async function deleteCaisse(id: string): Promise<void> {
  const res = await fetch(`/api/caisses/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Erreur suppression caisse');
}
