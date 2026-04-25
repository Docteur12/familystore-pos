export declare const EXPENSE_CATEGORIES: readonly ["Loyer", "Électricité", "Fournisseur", "Salaires", "Autre"];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export declare class CreateExpenseDto {
    amount: number;
    category: string;
    description?: string;
    date?: string;
}
