export const EXPENSE_CATEGORIES = ['Loyer', 'Électricité', 'Fournisseur', 'Salaires', 'Autre'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export class CreateExpenseDto {
  amount: number;
  category: string;
  description?: string;
  date?: string; // ISO date string, defaults to today
}
