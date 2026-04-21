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

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token') ?? '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const res = await fetch('/api/expenses', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error('Non authentifié');
  if (!res.ok) throw new Error('Erreur lors de l\'ajout de la dépense');
  return res.json();
}

export async function getAllExpenses(): Promise<Expense[]> {
  const res = await fetch('/api/expenses', { headers: authHeaders() });
  if (res.status === 401) throw new Error('Non authentifié');
  if (!res.ok) throw new Error('Erreur chargement dépenses');
  return res.json();
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await fetch(`/api/expenses/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 401) throw new Error('Non authentifié');
  if (!res.ok) throw new Error('Erreur lors de la suppression');
}

export async function getMonthStats(): Promise<MonthStats> {
  const res = await fetch('/api/expenses/stats/month', { headers: authHeaders() });
  if (res.status === 401) throw new Error('Non authentifié');
  if (!res.ok) throw new Error('Erreur chargement statistiques');
  return res.json();
}
