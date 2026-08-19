export const EXPENSE_CATEGORIES = ['Loyer', 'Électricité', 'Fournisseur', 'Salaires', 'Autre'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  _id: string;
  amount: number;
  category: string;
  description?: string;
  date: string;
  createdAt: string;
}

export interface CategoryStat {
  category: string;
  total: number;
  count: number;
}

export interface MonthStats {
  month: string;
  total: number;
  count: number;
  categories: CategoryStat[];
}

export interface CreateExpensePayload {
  amount: number;
  category: string;
  description?: string;
  date?: string;
}

import { authHeaders } from './http';
import { t } from '../i18n';

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const res = await fetch('/api/expenses', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error(t('Non authentifié', 'Not authenticated'));
  if (!res.ok) throw new Error(t('Erreur lors de l\'ajout de la dépense', 'Failed to add expense'));
  return res.json();
}

export async function getAllExpenses(): Promise<Expense[]> {
  const res = await fetch('/api/expenses', { headers: authHeaders() });
  if (res.status === 401) throw new Error(t('Non authentifié', 'Not authenticated'));
  if (!res.ok) throw new Error(t('Erreur chargement dépenses', 'Failed to load expenses'));
  return res.json();
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await fetch(`/api/expenses/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 401) throw new Error(t('Non authentifié', 'Not authenticated'));
  if (!res.ok) throw new Error(t('Erreur lors de la suppression', 'Failed to delete'));
}

export async function getMonthStats(): Promise<MonthStats> {
  const res = await fetch('/api/expenses/stats/month', { headers: authHeaders() });
  if (res.status === 401) throw new Error(t('Non authentifié', 'Not authenticated'));
  if (!res.ok) throw new Error(t('Erreur chargement statistiques', 'Failed to load statistics'));
  return res.json();
}
