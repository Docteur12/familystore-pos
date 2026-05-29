import { authHeaders } from './http';

export interface FournisseurRecord {
  _id:                string;
  name:               string;
  contact:            string;
  phone:              string;
  email:              string;
  adresse:            string;
  conditionsPaiement: 'comptant' | '30j' | '60j' | '';
  remise:             string;
  note:               number;
  categories:         string[];
}

export type FournisseurInput = Omit<FournisseurRecord, '_id'>;

export async function getFournisseurs(): Promise<FournisseurRecord[]> {
  const res = await fetch('/api/fournisseurs', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement fournisseurs');
  return res.json();
}

export async function createFournisseur(data: FournisseurInput): Promise<FournisseurRecord> {
  const res = await fetch('/api/fournisseurs', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur création fournisseur');
  return res.json();
}

export async function updateFournisseur(id: string, data: Partial<FournisseurInput>): Promise<FournisseurRecord> {
  const res = await fetch(`/api/fournisseurs/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur modification fournisseur');
  return res.json();
}

export async function deleteFournisseur(id: string): Promise<void> {
  const res = await fetch(`/api/fournisseurs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Erreur suppression fournisseur');
}
