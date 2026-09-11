/**
 * Vocabulaire par profil — complet et traduit.
 *
 * Un terme manquant pour un type donnerait `undefined` dans un titre de
 * rapport ; un terme non traduit ferait apparaître un mot français dans une
 * interface anglaise. Les deux se voient trop tard : au client.
 */
import { describe, it, expect } from 'vitest';
import { TERMES, v, V, lexiqueBrut } from './vocabulaire';
import { TYPES_ETABLISSEMENT } from '../api/settings';

describe('vocabulaire par profil', () => {
  it('chaque type a chaque terme, en FR et en EN, non vides', () => {
    for (const { id } of TYPES_ETABLISSEMENT) {
      const lexique = lexiqueBrut(id);
      for (const terme of TERMES) {
        const [fr, en] = lexique[terme];
        expect(fr.trim(), `${id}.${terme} FR`).not.toBe('');
        expect(en.trim(), `${id}.${terme} EN`).not.toBe('');
      }
    }
  });

  it('commerce garde les mots d’aujourd’hui — rien ne change pour l’existant', () => {
    expect(v('article')).toBe('article');
    expect(v('caisse')).toBe('caisse');
    expect(v('ticket')).toBe('ticket');
    expect(v('vente', 'commerce')).toBe('vente');
  });

  it('les profils parlent leur langue', () => {
    expect(v('article', 'restaurant')).toBe('plat');
    expect(v('client', 'restaurant')).toBe('table');
    expect(v('vente', 'hotel')).toBe('séjour');
    expect(v('caisse', 'snack')).toBe('comptoir');
    expect(V('articles', 'restaurant')).toBe('Plats');
  });

  it('un type inconnu retombe sur commerce', () => {
    expect(v('article', 'pharmacie' as never)).toBe('article');
  });
});
