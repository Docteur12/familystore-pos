import { authHeaders } from './http';
import { t } from '../i18n';

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
  if (!res.ok) throw new Error(t('Erreur chargement utilisateurs', 'Failed to load users'));
  return res.json();
}

export async function getUserActivity(): Promise<UserActivity[]> {
  const res = await fetch('/api/auth/users/activity', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement activité', 'Failed to load activity'));
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
  if (res.status === 409) throw new Error(t('Cet email est déjà utilisé', 'This email is already in use'));
  if (!res.ok) throw new Error(t('Erreur création compte', 'Failed to create account'));
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
  if (!res.ok) throw new Error(t('Erreur modification compte', 'Failed to update account'));
  return res.json();
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/auth/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(t('Erreur suppression compte', 'Failed to delete account'));
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.status === 404) throw new Error(t('Aucun compte associé à cet email', 'No account found for this email'));
  if (!res.ok) throw new Error(t('Erreur lors de la réinitialisation', 'Failed to reset password'));
  return res.json();
}
