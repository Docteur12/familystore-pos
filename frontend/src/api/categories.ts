import { authHeaders } from './http';
import { t } from '../i18n';

export type CategoryTree = Record<string, string[]>;

// Arbre catégories → sous-catégories (depuis la base, éditable sans code).
export async function getCategoryTree(): Promise<CategoryTree> {
  const res = await fetch('/api/categories', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement catégories', 'Failed to load categories'));
  return res.json();
}

// Ajoute une catégorie (et éventuellement une sous-catégorie) — patron.
export async function addCategory(category: string, subCategory = ''): Promise<void> {
  const res = await fetch('/api/categories/add', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ category, subCategory }),
  });
  if (!res.ok) throw new Error(t('Erreur ajout catégorie', 'Failed to add category'));
}

// Remplace toute la taxonomie (import CSV) — patron.
export async function importCategories(rows: { category: string; subCategory?: string }[]): Promise<{ count: number }> {
  const res = await fetch('/api/categories/import', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(t('Erreur import catégories', 'Failed to import categories'));
  return res.json();
}
