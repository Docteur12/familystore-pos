/**
 * Exports — les documents mensuels suivent le mois choisi.
 *
 * Le client ne pouvait télécharger que le mois en cours : la page listait des
 * documents figés (« mois en cours », « mois précédent »). Désormais un
 * sélecteur de mois pilote journal, rapport mensuel et fiche comptable.
 * `buildExports` porte cette logique ; ce test la verrouille pour qu'un mois
 * choisi se retrouve bien dans l'URL ET le nom de fichier — sans quoi on
 * régénérerait toujours le même mois sans que rien ne plante.
 */
import { describe, it, expect } from 'vitest';
import { buildExports } from './AdminExports';

describe('buildExports — le mois choisi pilote les documents mensuels', () => {
  const items = buildExports({ year: 2026, month: 3 }, '2026-09-04');
  const parId = (id: string) => items.find(e => e.id === id)!;

  it('le rapport mensuel PDF vise le mois choisi (URL + nom de fichier)', () => {
    expect(parId('e3').url).toContain('month=3');
    expect(parId('e3').url).toContain('year=2026');
    expect(parId('e3').filename).toBe('rapport-mensuel-2026-03.pdf');
  });

  it('le journal des ventes Excel vise le mois choisi', () => {
    expect(parId('e2').url).toContain('month=3');
    expect(parId('e2').filename).toBe('journal-ventes-2026-03.xlsx');
  });

  it('la fiche comptable PDF vise le mois choisi', () => {
    expect(parId('e8').url).toContain('month=3');
    expect(parId('e8').filename).toBe('fiche-comptable_2026-03.pdf');
  });

  it('le catalogue produits PDF est branché sur la nouvelle route', () => {
    const cat = parId('e-catalogue');
    expect(cat.format).toBe('pdf');
    expect(cat.section).toBe('Stock');
    expect(cat.url).toBe('/api/reports/catalogue/pdf');
  });

  it('un autre mois change bien le document mensuel…', () => {
    const autre = buildExports({ year: 2025, month: 11 }, '2026-09-04');
    expect(autre.find(e => e.id === 'e3')!.filename).toBe('rapport-mensuel-2025-11.pdf');
  });

  it('…mais pas les documents non mensuels (catalogue, audit)', () => {
    const autre = buildExports({ year: 2025, month: 11 }, '2026-09-04');
    for (const id of ['e-catalogue', 'e12', 'e5']) {
      expect(autre.find(e => e.id === id)!.url).toBe(parId(id).url);
    }
  });
});
