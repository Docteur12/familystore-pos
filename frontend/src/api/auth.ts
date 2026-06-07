import { authHeaders } from './http';

export interface UserRecord {
  _id:              string;
  name:             string;
  email:            string;
  role:             'patron' | 'caissier' | 'gestionnaire' | 'magazinier' | 'commercial';
  phone?:           string;
  caisseId?:        string | null;
  assignedLocation?: string;
}

export interface UserActivity extends UserRecord {
  lastActionAt:     string | null;
  actionsToday:     number;
  lastActionDetail: string | null;
}

export async function getUsers(): Promise<UserRecord[]> {
  const res = await fetch('/api/auth/users', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement utilisateurs');
  return res.json();
}

export async function getUserActivity(): Promise<UserActivity[]> {
  const res = await fetch('/api/auth/users/activity', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement activité');
  return res.json();
}

export async function createUser(data: {
  name: string; email: string; password: string;
  role: 'caissier' | 'gestionnaire' | 'magazinier' | 'commercial'; phone?: string; caisseId?: string; assignedLocation?: string;
}): Promise<UserRecord> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 409) throw new Error('Cet email est déjà utilisé');
  if (!res.ok) throw new Error('Erreur création compte');
  return res.json();
}

export async function updateUser(
  id: string,
  data: { name?: string; email?: string; phone?: string; password?: string; oldPassword?: string; caisseId?: string | null; assignedLocation?: string },
): Promise<UserRecord> {
  const res = await fetch(`/api/auth/users/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erreur modification compte');
  return res.json();
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/auth/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Erreur suppression compte');
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.status === 404) throw new Error('Aucun compte associé à cet email');
  if (!res.ok) throw new Error('Erreur lors de la réinitialisation');
  return res.json();
}
