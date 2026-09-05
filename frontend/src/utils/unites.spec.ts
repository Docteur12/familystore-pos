/**
 * Unités — la donnée française s'affiche en anglais chez un magasin anglophone.
 *
 * L'étiquette Radiance sortait « pièce · 15 » : l'unité est une donnée saisie
 * en français. `uniteEn` porte la table de traduction ; ce test la verrouille
 * pour que les unités courantes ne retombent jamais en français chez Radiance,
 * et que les unités internationales restent intactes.
 */
import { describe, it, expect } from 'vitest';
import { uniteEn } from './unites';

describe('uniteEn — unités françaises traduites, internationales conservées', () => {
  it('traduit les unités françaises courantes', () => {
    expect(uniteEn('pièce')).toBe('piece');
    expect(uniteEn('boîte')).toBe('box');
    expect(uniteEn('boite')).toBe('box');       // sans accent aussi
    expect(uniteEn('bouteille')).toBe('bottle');
    expect(uniteEn('paquet')).toBe('pack');
  });

  it('est insensible à la casse et aux espaces', () => {
    expect(uniteEn(' Pièce ')).toBe('piece');
    expect(uniteEn('BOÎTE')).toBe('box');
  });

  it('laisse intactes les unités internationales et inconnues', () => {
    expect(uniteEn('ml')).toBe('ml');
    expect(uniteEn('kg')).toBe('kg');
    expect(uniteEn('mL')).toBe('mL');
    expect(uniteEn('douzaine')).toBe('douzaine');   // inconnue → telle quelle
  });

  it('vide ou absent → chaîne vide', () => {
    expect(uniteEn('')).toBe('');
    expect(uniteEn(undefined)).toBe('');
  });
});
