/**
 * Identité de l'écran de connexion — la règle « single = magasin, multi = neutre ».
 *
 * Le cas vécu (10/09/2026) : en test local de HERVAN Élite (mode single), la
 * page de connexion affichait Caméléon alors que Radiance et Family Store,
 * sur le même mode, montrent leur enseigne. La règle existait, l'écran ne la
 * lisait pas.
 */
import { describe, it, expect } from 'vitest';
import { identiteConnexion, assombrir } from './identite-connexion';

const hervan = { modeIdentite: 'single' as const, nomMagasin: 'HERVAN Élite', logoUrl: 'data:image/png;base64,AAA', couleurPrincipale: '#1A1A1A' };

describe('identité de l’écran de connexion', () => {
  it('mode single : logo, nom et couleur du magasin', () => {
    expect(identiteConnexion(hervan)).toEqual({
      neutre: false, nom: 'HERVAN Élite', logoUrl: 'data:image/png;base64,AAA', couleur: '#1A1A1A',
    });
  });

  it('mode multi : Caméléon neutre, quoi que disent les autres champs', () => {
    const r = identiteConnexion({ ...hervan, modeIdentite: 'multi' });
    expect(r.neutre).toBe(true);
    expect(r.nom).toBe('Caméléon');
    expect(r.logoUrl).toBe('');
  });

  it('sans information de mode (serveur ancien, hors-ligne, défauts) : neutre', () => {
    expect(identiteConnexion({ nomMagasin: 'Family Store', logoUrl: 'x.png' }).neutre).toBe(true);
    expect(identiteConnexion(null).neutre).toBe(true);
    expect(identiteConnexion(undefined).neutre).toBe(true);
  });

  it('single mais boutique sans nom : neutre plutôt qu’un cadre vide', () => {
    expect(identiteConnexion({ modeIdentite: 'single', nomMagasin: '  ' }).neutre).toBe(true);
  });

  it('couleur invalide ou absente : vert Caméléon, pas une valeur cassée', () => {
    expect(identiteConnexion({ ...hervan, couleurPrincipale: 'rouge' }).couleur).toBe('#3F8F6B');
    expect(identiteConnexion({ ...hervan, couleurPrincipale: undefined }).couleur).toBe('#3F8F6B');
  });

  it('assombrir rend une teinte plus foncée et laisse passer l’inconnu', () => {
    expect(assombrir('#FFFFFF', 0.5)).toBe('rgb(128,128,128)');
    expect(assombrir('pas-une-couleur')).toBe('pas-une-couleur');
  });
});
