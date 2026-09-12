/**
 * Écran Réserve — rendu réel (react-dom dans jsdom), serveur simulé.
 *
 * Prouvé : l'état de la réserve s'affiche en casiers (pleins, vides à rendre)
 * ; le formulaire de réception envoie casiers + vides rendus + clé
 * d'idempotence ; le conditionnement d'un produit non encore conditionné part
 * en PUT ; la casse part sur sa route. Les conversions sont faites par le
 * serveur (`etatReserve`) — l'écran les affiche, il ne les recalcule pas.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import StocksReserve from './StocksReserve';
import { definirJeton } from '../services/storage';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const BOUTIQUE = '507f1f77bcf86cd799439011';
const JETON = `entete.${btoa(JSON.stringify({ v: 2, sub: 'u1', name: 'Patron', role: 'patron', tenantId: BOUTIQUE }))}.signature`;

const RESERVE = [{
  productId: 'b1', nomProduit: 'Beaufort 65cl', unit: 'bouteille', category: 'bières', stock: 82,
  bouteillesParCasier: 24, casiersPleins: 3, bouteillesSeules: 10, consigne: 200,
  videsEnReserve: 30, casiersVidesARendre: 1, videsSeuls: 6, alertThreshold: 12,
}];
const PRODUITS = [
  { _id: 'b1', name: 'beaufort 65cl', price: 700, costPrice: 500, stock: 82, alertThreshold: 12, unit: 'bouteille', category: 'bières' },
  { _id: 'e1', name: 'supermont 1L',  price: 500, costPrice: 300, stock: 20, alertThreshold: 2,  unit: 'bouteille', category: 'eaux' },
];

type Appel = { url: string; method: string; body: any };
let appels: Appel[] = [];
const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

function serveurFactice(): typeof fetch {
  return vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entree);
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    appels.push({ url, method, body });
    if (url === '/api/comptoir/reserve')                        return reponse(200, RESERVE);
    if (url === '/api/products')                                return reponse(200, PRODUITS);
    if (url.startsWith('/api/comptoir/reserve/receptions') && method === 'GET') return reponse(200, []);
    if (url === '/api/comptoir/consignes/jour')                 return reponse(200, { date: '2026-09-11', encaissees: { quantite: 4, montant: 800 }, rendues: { quantite: 2, montant: 400 }, solde: 400, parProduit: [] });
    if (url === '/api/comptoir/reserve/receptions' && method === 'POST') return reponse(201, { rejeu: false, stock: 130, videsEnReserve: 6 });
    if (url === '/api/comptoir/reserve/casse' && method === 'POST') return reponse(201, { rejeu: false, stock: 80 });
    if (url.startsWith('/api/comptoir/conditionnements/') && method === 'PUT') return reponse(200, { product: url.split('/').pop(), ...body, videsEnReserve: 0 });
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
const $  = (sel: string) => conteneur.querySelector<HTMLElement>(sel);
const $$ = (sel: string) => Array.from(conteneur.querySelectorAll<HTMLElement>(sel));
const sansBlancs = (s: string | null | undefined) => (s ?? '').replace(/\s/g, '');
const taper = async (el: Element | null) => {
  if (!el) throw new Error('élément absent');
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); await dormir(); });
};
/** Saisie dans un champ contrôlé par React : passer par le setter natif, puis l'événement. */
const saisir = async (el: Element | null, valeur: string) => {
  if (!el) throw new Error('champ absent');
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, valeur);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    await dormir();
  });
};

async function monter() {
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
  await act(async () => { racine.render(<StocksReserve />); });
  await attendre(() => $$('[data-testid="ligne-reserve"]').length === 1);
}

beforeEach(() => {
  appels = [];
  definirJeton(BOUTIQUE, JETON);
  vi.stubGlobal('fetch', serveurFactice());
});
afterEach(async () => {
  await act(async () => { racine?.unmount(); });
  conteneur?.remove();
  vi.unstubAllGlobals();
});

describe('StocksReserve', () => {
  it('affiche l’état en casiers : 82 bouteilles = 3 casiers + 10 ; 30 vides = 1 casier + 6 ; consignes du jour', async () => {
    await monter();
    expect(sansBlancs($('[data-testid="cellule-stock"]')?.textContent)).toContain('82bout.=3casier(s)+10');
    expect(sansBlancs($('[data-testid="cellule-vides"]')?.textContent)).toContain('30=1casier(s)+6');
    expect($('[data-testid="tuile-pleins"]')?.textContent).toContain('3');
    expect(sansBlancs($('[data-testid="tuile-vides"]')?.textContent)).toContain('1+6');
    expect(sansBlancs($('[data-testid="tuile-encaissees"]')?.textContent)).toContain('800F');
    expect(sansBlancs($('[data-testid="tuile-rendues"]')?.textContent)).toContain('400F');
  });

  it('réception : 2 casiers, 24 vides rendus, note → POST avec conversion affichée et clé d’idempotence', async () => {
    await monter();
    await taper($('[data-testid="btn-reception"]'));
    await saisir($('[data-testid="champ-casiers"]'), '2');
    expect(sansBlancs($('[data-testid="apercu-bouteilles"]')?.textContent)).toContain('=48bouteilles');
    await saisir($('[data-testid="champ-vides-rendus"]'), '24');
    await saisir($('[data-testid="form-reception"] [data-testid="champ-note"]'), 'Livreur SABC');
    await taper($('[data-testid="btn-valider-reception"]'));
    await attendre(() => appels.some(a => a.url === '/api/comptoir/reserve/receptions' && a.method === 'POST'));

    const corps = appels.find(a => a.url === '/api/comptoir/reserve/receptions' && a.method === 'POST')!.body;
    expect(corps).toMatchObject({ productId: 'b1', casiers: 2, videsRendus: 24, note: 'Livreur SABC' });
    expect(typeof corps.idempotencyKey).toBe('string');
    // Le formulaire se ferme et la réserve est rechargée.
    await attendre(() => $('[data-testid="form-reception"]') === null);
    expect(appels.filter(a => a.url === '/api/comptoir/reserve').length).toBeGreaterThanOrEqual(2);
  });

  it('réception : plus de vides rendus que détenus → refus local, rien n’est envoyé', async () => {
    await monter();
    await taper($('[data-testid="btn-reception"]'));
    await saisir($('[data-testid="champ-vides-rendus"]'), '31');
    await taper($('[data-testid="btn-valider-reception"]'));
    await act(async () => { await dormir(); });
    expect(appels.some(a => a.method === 'POST')).toBe(false);
    expect($('[data-testid="form-reception"]')).not.toBeNull();
  });

  it('nouveau conditionnement : ne propose que les produits non conditionnés, envoie PUT /conditionnements/:id', async () => {
    await monter();
    await taper($('[data-testid="btn-nouveau-conditionnement"]'));
    const options = $$('[data-testid="champ-produit"] option').map(o => (o as HTMLOptionElement).value).filter(Boolean);
    expect(options).toEqual(['e1']);   // la bière est déjà conditionnée
    await saisir($('[data-testid="champ-produit"]'), 'e1');
    await saisir($('[data-testid="champ-par-casier"]'), '12');
    await saisir($('[data-testid="champ-consigne"]'), '0');
    await taper($('[data-testid="btn-valider-conditionnement"]'));
    await attendre(() => appels.some(a => a.method === 'PUT'));
    const put = appels.find(a => a.method === 'PUT')!;
    expect(put.url).toBe('/api/comptoir/conditionnements/e1');
    expect(put.body).toEqual({ bouteillesParCasier: 12, consigne: 0 });
  });

  it('casse : 3 bouteilles avec motif → POST /reserve/casse', async () => {
    await monter();
    await taper($('[data-testid="btn-casse"]'));
    await saisir($('[data-testid="champ-bouteilles"]'), '3');
    await saisir($('[data-testid="form-casse"] [data-testid="champ-note"]'), 'chute');
    await taper($('[data-testid="btn-valider-casse"]'));
    await attendre(() => appels.some(a => a.url === '/api/comptoir/reserve/casse'));
    expect(appels.find(a => a.url === '/api/comptoir/reserve/casse')!.body).toMatchObject({ productId: 'b1', bouteilles: 3, note: 'chute' });
  });
});
