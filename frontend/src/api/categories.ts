import { authHeaders } from './http';

export type CategoryTree = Record<string, string[]>;

// Arbre catégories → sous-catégories (depuis la base, éditable sans code).
export async function getCategoryTree(): Promise<CategoryTree> {
  const res = await fetch('/api/categories', { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement catégories');
  return res.json();
}

// Ajoute une catégorie (et éventuellement une sous-catégorie) — patron.
export async function addCategory(category: string, subCategory = ''): Promise<void> {
  const res = await fetch('/api/categories/add', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ category, subCategory }),
  });
  if (!res.ok) throw new Error('Erreur ajout catégorie');
}

// Remplace toute la taxonomie (import CSV) — patron.
export async function importCategories(rows: { category: string; subCategory?: string }[]): Promise<{ count: number }> {
  const res = await fetch('/api/categories/import', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error('Erreur import catégories');
  return res.json();
}
