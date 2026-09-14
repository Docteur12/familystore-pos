// @vitest-environment jsdom
/**
 * Pied de ticket : AUCUNE offre par défaut, et jamais le nom d'un autre commerce.
 *
 * Régression vécue chez Radiance le 14/09/2026 : leurs Settings n'avaient pas
 * de champ `offreFacture`, le défaut du code prenait le relais, et chaque reçu
 * sortait avec « Pour vous remercier, Family Store vous offre 5 % de réduction
 * sur votre prochain achat » — une promesse commerciale faite au nom d'une
 * autre enseigne. Un pied vide ne gêne personne ; une offre inventée engage.
 *
 * Ce que ce test garantit :
 *  - OFFRE_DEFAULTS est entièrement vide ;
 *  - un ticket sans offre en base ne porte ni bloc d'offre ni « Family Store » ;
 *  - une offre SAISIE par le magasin, elle, s'imprime toujours (témoin : le
 *    test ne passe pas « au vert » en ayant simplement supprimé le pied).
 */
import { describe, it, expect } from 'vitest';
import { OFFRE_DEFAULTS, OffreFacture, storeIdentity, SETTINGS_DEFAULTS } from './settings';
import { buildReceiptHTML, ReceiptData } from '../components/ReceiptPrint';

const MARQUE_AUTRE = /family\s*store/i;

const ticket = (offre?: OffreFacture): ReceiptData => ({
  receiptNo: 'FSV-20260914-027686', date: new Date('2026-09-14T11:48:00'), cashierName: 'Administrator',
  items: [{ name: 'Delight Butter Cookies', unit: 'pce', quantity: 1, unitPrice: 5000 }],
  subtotal: 5000, total: 5000, paymentLabel: 'Cash', amountPaid: 10000, change: 5000,
  store: storeIdentity({ ...SETTINGS_DEFAULTS, nomMagasin: 'Radiance Essentials' }),
  offre,
});

describe('offre du pied de ticket — défaut', () => {
  it('OFFRE_DEFAULTS est entièrement vide', () => {
    for (const champ of Object.keys(OFFRE_DEFAULTS) as (keyof OffreFacture)[]) {
      expect(OFFRE_DEFAULTS[champ], champ).toBe('');
    }
  });

  it('ne porte le nom d’aucune autre enseigne', () => {
    expect(JSON.stringify(OFFRE_DEFAULTS)).not.toMatch(MARQUE_AUTRE);
  });
});

describe('ticket sans offre en base', () => {
  it('HTML : pas de bloc d’offre, pas « Family Store »', () => {
    const html = buildReceiptHTML(ticket(undefined));
    expect(html).not.toMatch(MARQUE_AUTRE);
    expect(html).not.toContain('class="offer"');
    expect(html).not.toContain('vous offre');
  });

  // Pas d'assertion sur le PDF : jsPDF n'écrit pas le texte en clair dans le
  // flux, un `not.toMatch` y passerait au vert avant comme après — vérifié.
});

describe('témoin — une offre SAISIE par le magasin s’imprime toujours', () => {
  it('HTML : le message saisi est là, en bloc d’offre', () => {
    const html = buildReceiptHTML(ticket({ ...OFFRE_DEFAULTS, message: 'Enjoy *10% off* your next visit.' }));
    expect(html).toContain('class="offer"');
    expect(html).toContain('10% off');
  });
});
