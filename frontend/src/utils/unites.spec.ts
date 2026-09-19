// @vitest-environment jsdom
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

import { declinaison, UNITES_TAILLE } from './unites';

describe('declinaison — la taille / l’âge d’un article (étiquette de vêtement)', () => {
  it('âges et tailles : la forme imprimée', () => {
    expect(declinaison('ans', '4')).toBe('4 ans');
    expect(declinaison('ans', '1')).toBe('1 an');
    expect(declinaison('mois', '6')).toBe('6 mois');
    expect(declinaison('taille', 'M')).toBe('T. M');
    expect(declinaison('pointure', '28')).toBe('P. 28');
    expect(declinaison(' Ans ', ' 8 ')).toBe('8 ans');          // casse et espaces
  });
  it('contenances : valeur + unité', () => {
    expect(declinaison('mL', '250')).toBe('250 mL');
    expect(declinaison('g', '90')).toBe('90 g');
  });
  it('rien quand l’unité est un conditionnement ou qu’aucune valeur n’est saisie', () => {
    expect(declinaison('pièce', '15')).toBe('');                // Radiance : « pièce · 15 » ne revient pas
    expect(declinaison('boîte', '2')).toBe('');
    expect(declinaison('ans', '')).toBe('');
    expect(declinaison(undefined, undefined)).toBe('');
  });
  it('les unités de taille proposées à la saisie', () => {
    expect([...UNITES_TAILLE]).toEqual(['ans', 'mois', 'taille', 'pointure']);
  });
});
