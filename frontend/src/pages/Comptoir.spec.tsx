/**
 * Écran Comptoir — rendu réel (react-dom dans jsdom), serveur simulé par un
 * `fetch` factice, stockage local réel (IndexedDB en mémoire).
 *
 * Ce qui est prouvé :
 *  - le catalogue s'affiche en grille, le badge consigne sur les produits qui
 *    en portent une, la catégorie filtre ;
 *  - trois taps sur la grille + un mode de paiement + « Encaisser » envoient
 *    à `POST /api/sales` EXACTEMENT le panier attendu (lignes, consignes à
 *    part, total, mode, clé d'idempotence) — le noyau de vente n'est pas
 *    dupliqué, il est appelé ;
 *  - hors ligne, la vente part dans la file `offlineSync` avec ses lignes de
 *    consigne, rien n'est perdu ;
 *  - le retour de vide appelle la route dédiée avec produit et quantité.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import Comptoir from './Comptoir';
import { definirJeton } from '../services/storage';
import { getPendingSales } from '../services/offlineSync';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const BOUTIQUE = '507f1f77bcf86cd799439011';
const JETON = `entete.${btoa(JSON.stringify({ v: 2, sub: 'u1', name: 'Awa', role: 'caissier', tenantId: BOUTIQUE }))}.signature`;

const PRODUITS = [
  { _id: 'b1', name: 'beaufort 65cl', price: 700, costPrice: 500, stock: 5,  alertThreshold: 2, unit: 'bouteille', category: 'bières' },
  { _id: 'e1', name: 'supermont 1L',  price: 500, costPrice: 300, stock: 20, alertThreshold: 2, unit: 'bouteille', category: 'eaux' },
  { _id: 'r1', name: 'rhum',          price: 1000, costPrice: 700, stock: 0, alertThreshold: 1, unit: 'bouteille', category: 'spiritueux' },
];
const CONDITIONNEMENTS = [{ product: 'b1', bouteillesParCasier: 24, consigne: 200, videsEnReserve: 0 }];

type Appel = { url: string; method: string; body: any };
let appels: Appel[] = [];

function reponse(status: number, corps: unknown) {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
}

function serveurFactice(): typeof fetch {
  return vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entree);
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    appels.push({ url, method, body });
    if (url === '/api/products')                 return reponse(200, PRODUITS);
    if (url === '/api/comptoir/conditionnements')   return reponse(200, CONDITIONNEMENTS);
    if (url === '/api/sessions/active')          return reponse(404, {});
    if (url === '/api/sessions' && method === 'POST') return reponse(201, { _id: 'sess-1' });
    if (url === '/api/sales' && method === 'POST') return reponse(201, { sale: { _id: 'abcdef123456' }, change: Math.max(0, body.amountPaid - body.total), alerts: [] });
    if (url === '/api/comptoir/consignes/retours' && method === 'POST') return reponse(201, { montant: 200 * body.quantite, rejeu: false });
    return reponse(404, { message: `route inconnue ${method} ${url}` });
  }) as unknown as typeof fetch;
}

let conteneur: HTMLDivElement;
let racine: Root;

const dormir = () => new Promise<void>(r => setTimeout(r, 0));
async function attendre(condition: () => boolean, delaiMs = 3000) {
  const fin = Date.now() + delaiMs;
  while (!condition()) {
    if (Date.now() > fin) throw new Error('condition non atteinte à temps');
    await act(async () => { await dormir(); });
  }
}
const $  = <T extends Element = HTMLElement>(sel: string) => conteneur.querySelector(sel) as T | null;
// Montants : l'espace de milliers est une espace fine insécable (locale) — on compare sans blancs.
const montant = (sel: string) => ($(sel)?.textContent ?? '').replace(/\s/g, '');
const $$ = (sel: string) => Array.from(conteneur.querySelectorAll<HTMLElement>(sel));
const taper = async (el: Element | null) => {
  if (!el) throw new Error('élément absent');
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); await dormir(); });
};

async function monter() {
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
  await act(async () => { racine.render(<Comptoir />); });
  await attendre(() => $$('[data-testid="carte-produit"]').length === 3);
}

beforeEach(() => {
  appels = [];
  definirJeton(BOUTIQUE, JETON);
  vi.stubGlobal('fetch', serveurFactice());
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

afterEach(async () => {
  await act(async () => { racine?.unmount(); });
  conteneur?.remove();
  vi.unstubAllGlobals();
});

describe('Comptoir', () => {
  it('affiche la grille, le badge consigne, et filtre par catégorie', async () => {
    await monter();
    const cartes = $$('[data-testid="carte-produit"]');
    expect(cartes.map(c => c.dataset.produit)).toEqual(['b1', 'e1', 'r1']);
    expect(cartes[0].querySelector('[data-testid="badge-consigne"]')?.textContent).toContain('200');
    expect(cartes[1].querySelector('[data-testid="badge-consigne"]')).toBeNull();
    expect((cartes[2] as HTMLButtonElement).disabled).toBe(true);   // rupture : intouchable

    const puces = $$('[data-testid="categories"] button');
    expect(puces.map(b => b.textContent)).toEqual(['Tout', 'Bières', 'Eaux', 'Spiritueux']);
    await taper(puces[2]);
    expect($$('[data-testid="carte-produit"]').map(c => c.dataset.produit)).toEqual(['e1']);
  });

  it('2 bières + 1 eau, Mobile Money, Encaisser → POST /api/sales avec le panier exact', async () => {
    await monter();
    const carte = (id: string) => $(`[data-produit="${id}"]`);
    await taper(carte('b1')); await taper(carte('b1')); await taper(carte('e1'));

    expect($$('[data-testid="ligne-panier"]')).toHaveLength(2);
    expect(montant('[data-testid="total-articles"]')).toBe('1900F');
    expect(montant('[data-testid="total-consignes"]')).toBe('400F');
    expect(montant('[data-testid="total"]')).toBe('2300F');

    await taper($('[data-testid="mode-mobile_money"]'));
    await taper($('[data-testid="btn-encaisser"]'));
    await attendre(() => appels.some(a => a.url === '/api/sales'));

    const vente = appels.find(a => a.url === '/api/sales')!.body;
    expect(vente.items).toEqual([
      { product: 'b1', name: 'beaufort 65cl', quantity: 2, unitPrice: 700 },
      { product: 'b1', divers: true, name: 'Consigne Beaufort 65cl', quantity: 2, unitPrice: 200 },
      { product: 'e1', name: 'supermont 1L', quantity: 1, unitPrice: 500 },
    ]);
    expect(vente).toMatchObject({ total: 2300, subtotal: 2300, paymentMethod: 'mobile_money', amountPaid: 2300, sessionId: 'sess-1' });
    expect(typeof vente.idempotencyKey).toBe('string');
    expect(vente.idempotencyKey.length).toBeGreaterThan(8);

    // Panier vidé, stock local décrémenté, dernière vente rappelée.
    await attendre(() => $$('[data-testid="ligne-panier"]').length === 0);
    expect(montant('[data-testid="derniere-vente"]')).toContain('2300F');
    expect(carte('b1')?.textContent).toContain('3');   // 5 − 2
    expect(($('[data-testid="btn-ticket"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('espèces : montant remis → monnaie affichée et transmise', async () => {
    await monter();
    await taper($('[data-produit="e1"]'));
    const champ = $('[data-testid="remis"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(champ, '1000');
      champ.dispatchEvent(new Event('input', { bubbles: true }));
      await dormir();
    });
    expect(montant('[data-testid="monnaie"]')).toContain('500F');
    await taper($('[data-testid="btn-encaisser"]'));
    await attendre(() => appels.some(a => a.url === '/api/sales'));
    expect(appels.find(a => a.url === '/api/sales')!.body).toMatchObject({ total: 500, amountPaid: 1000, paymentMethod: 'cash' });
  });

  it('hors ligne : la vente (consignes comprises) va dans la file locale, rien ne part au serveur', async () => {
    await monter();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    await taper($('[data-produit="b1"]'));
    await taper($('[data-testid="btn-encaisser"]'));
    await attendre(() => $$('[data-testid="ligne-panier"]').length === 0);

    expect(appels.some(a => a.url === '/api/sales')).toBe(false);
    const file = await getPendingSales();
    expect(file).toHaveLength(1);
    expect(file[0]).toMatchObject({ total: 900, paymentMethod: 'cash', amountPaid: 900, boutiqueId: BOUTIQUE });
    expect(file[0].items.map(i => i.name)).toEqual(['beaufort 65cl', 'Consigne Beaufort 65cl']);
    expect($('[data-testid="badge-attente"]')?.textContent).toContain('1');
  });

  it('retour de vide : choisir la bière, 2 vides, Rembourser → POST /api/comptoir/consignes/retours', async () => {
    await monter();
    await taper($('[data-testid="btn-retour-vide"]'));
    const choix = $$('[data-testid="retour-produit"]');
    expect(choix).toHaveLength(1);              // seule la bière est consignée
    await taper(choix[0]);
    await taper($('[data-testid="modal-retour"] button[aria-label="Plus"]'));
    expect($('[data-testid="retour-qte"]')?.textContent).toBe('2');
    expect(montant('[data-testid="btn-rembourser"]')).toContain('400F');
    await taper($('[data-testid="btn-rembourser"]'));
    await attendre(() => appels.some(a => a.url === '/api/comptoir/consignes/retours'));
    expect(appels.find(a => a.url === '/api/comptoir/consignes/retours')!.body).toMatchObject({ productId: 'b1', quantite: 2 });
    await attendre(() => $('[data-testid="modal-retour"]') === null);
  });
});
