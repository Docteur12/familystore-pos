// @vitest-environment jsdom
/**
 * En-tête du ticket : le logo OU le nom, au choix — jamais les deux, jamais rien.
 *
 * Demande de Radiance (14/09/2026) avec son nouveau logo. Ce que ce test
 * garantit, sur le ticket imprimé (HTML) et sur l'archive PDF :
 *  - réglage « nom » : le nom en gros, pas d'image (le comportement d'avant) ;
 *  - réglage « logo » avec un logo : l'image, et plus le nom en gros ;
 *  - réglage « logo » SANS logo téléversé : retour au nom — un ticket ne sort
 *    jamais sans en-tête ;
 *  - un logo illisible dans le PDF : retour au nom, sans planter la vente.
 */
import { describe, it, expect } from 'vitest';
import { storeIdentity, SETTINGS_DEFAULTS, StoreSettings } from '../api/settings';
import { buildReceiptHTML, buildReceiptPDF, ReceiptData } from './ReceiptPrint';

// PNG 1 × 1 rose, valide.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const reglages = (extra: Partial<StoreSettings>): StoreSettings => ({ ...SETTINGS_DEFAULTS, nomMagasin: 'Radiance Essentials', ...extra });

const ticket = (store: ReceiptData['store']): ReceiptData => ({
  receiptNo: 'FSV-20260914-ABC123', date: new Date('2026-09-14T10:00:00'), cashierName: 'Awa',
  items: [{ name: 'Antacid Tablets', unit: 'pce', quantity: 1, unitPrice: 100 }],
  subtotal: 100, total: 100, paymentLabel: 'Cash', amountPaid: 100, change: 0, store,
});

describe('identité imprimée — le choix de l’en-tête', () => {
  it('« nom » par défaut, et le logo est transporté pour qui en a besoin', () => {
    const id = storeIdentity(reglages({ logoUrl: PNG }));
    expect(id.entete).toBe('nom');
    expect(id.logoUrl).toBe(PNG);
  });

  it('« logo » avec un logo téléversé → logo', () => {
    expect(storeIdentity(reglages({ enteteTicket: 'logo', logoUrl: PNG })).entete).toBe('logo');
  });

  it('« logo » SANS logo → retour au nom : jamais d’en-tête vide', () => {
    expect(storeIdentity(reglages({ enteteTicket: 'logo', logoUrl: '' })).entete).toBe('nom');
    expect(storeIdentity(reglages({ enteteTicket: 'logo', logoUrl: '   ' })).entete).toBe('nom');
  });
});

describe('ticket imprimé (HTML)', () => {
  it('« nom » : le nom en gros, aucune image', () => {
    const html = buildReceiptHTML(ticket(storeIdentity(reglages({ logoUrl: PNG }))));
    expect(html).toContain('<div class="store">Radiance Essentials</div>');
    expect(html).not.toContain('<img class="logo"');
  });

  it('« logo » : l’image en tête, et plus le nom en gros — mais le reste de l’en-tête demeure', () => {
    const html = buildReceiptHTML(ticket(storeIdentity(reglages({ enteteTicket: 'logo', logoUrl: PNG, slogan: 'Beauty • Flavour • Well-being' }))));
    expect(html).toContain(`<img class="logo" src="${PNG}"`);
    expect(html).not.toContain('<div class="store">');
    expect(html).toContain('Beauty • Flavour • Well-being');
    // Le logo est borné et noirci pour la thermique.
    expect(html).toMatch(/\.logo\s*\{[^}]*max-width:\s*54mm/);
    expect(html).toMatch(/\.logo\s*\{[^}]*grayscale\(1\)/);
  });
});

describe('archive PDF', () => {
  it('« logo » : le PDF se construit avec l’image', () => {
    const pdf = buildReceiptPDF(ticket(storeIdentity(reglages({ enteteTicket: 'logo', logoUrl: PNG }))));
    expect(pdf.length).toBeGreaterThan(1000);
    // Un PDF avec image porte un objet XObject Image ; sans, non.
    const brut = Buffer.from(pdf, 'base64').toString('latin1');
    expect(brut).toContain('/Subtype /Image');
  });

  it('« nom » : aucun objet image dans le PDF', () => {
    const brut = Buffer.from(buildReceiptPDF(ticket(storeIdentity(reglages({ logoUrl: PNG })))), 'base64').toString('latin1');
    expect(brut).not.toContain('/Subtype /Image');
  });

  it('logo illisible : retour au nom, la vente n’est pas bloquée', () => {
    const store = { ...storeIdentity(reglages({ enteteTicket: 'logo', logoUrl: PNG })), logoUrl: 'data:image/png;base64,PASUNEIMAGE' };
    const brut = Buffer.from(buildReceiptPDF(ticket(store)), 'base64').toString('latin1');
    expect(brut).not.toContain('/Subtype /Image');
    expect(brut).toContain('Radiance Essentials');
  });
});
