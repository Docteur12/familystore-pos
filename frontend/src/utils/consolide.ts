/**
 * Rapport consolidé à types mélangés — logique pure (CAMELEON-GAMME.md §2.5).
 *
 * Un propriétaire qui tient une boutique et un snack lit ses deux métiers
 * séparément ; un propriétaire mono-type ne voit rien de plus qu'avant.
 */
import type { RapportConsolide, BoutiqueProprietaire } from '../api/consolide';
import { typeEtablissement, TypeEtablissement } from '../api/settings';

export interface SousTotalType { type: TypeEtablissement; ca: number; ventes: number; boutiques: number; panierMoyen: number }

/** Types distincts présents dans le rapport, dans l'ordre d'apparition. */
export function typesPresents(rapport: Pick<RapportConsolide, 'boutiques'>): TypeEtablissement[] {
  const vus: TypeEtablissement[] = [];
  for (const b of rapport.boutiques) {
    const type = typeEtablissement(b);
    if (!vus.includes(type)) vus.push(type);
  }
  return vus;
}

/**
 * Sous-totaux par type — recalculés depuis les lignes, pas lus dans
 * `total.parType` : un serveur antérieur au socle ne l'envoie pas, et le
 * résultat doit être le même dans les deux cas.
 */
export function sousTotauxParType(rapport: Pick<RapportConsolide, 'boutiques'>): SousTotalType[] {
  const parType = new Map<TypeEtablissement, SousTotalType>();
  for (const b of rapport.boutiques) {
    const type = typeEtablissement(b);
    const s = parType.get(type) ?? { type, ca: 0, ventes: 0, boutiques: 0, panierMoyen: 0 };
    s.ca += b.ca; s.ventes += b.ventes; s.boutiques += 1;
    parType.set(type, s);
  }
  return [...parType.values()].map(s => ({ ...s, panierMoyen: s.ventes ? Math.round(s.ca / s.ventes) : 0 }));
}

const PICTOS: Record<TypeEtablissement, string> = { commerce: '🛍', snack: '🥤', restaurant: '🍽', hotel: '🛏' };

/**
 * Pictogramme de type dans le sélecteur — SEULEMENT si le propriétaire mélange
 * les métiers. Une liste mono-type reste sobre, comme aujourd'hui.
 */
export function pictoType(type: TypeEtablissement | undefined, toutes: BoutiqueProprietaire[]): string {
  const distincts = new Set(toutes.map(b => typeEtablissement(b)));
  if (distincts.size < 2) return '';
  return `${PICTOS[typeEtablissement({ typeEtablissement: type })]} `;
}
