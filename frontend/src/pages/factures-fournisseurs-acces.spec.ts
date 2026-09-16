/**
 * Factures fournisseurs : accessibles depuis l'espace ADMINISTRATION aussi.
 *
 * HERVAN (16/09/2026) : c'est le patron qui achète à l'étranger et scanne les
 * factures ; l'entrée n'existait que dans l'espace Gestion de stock.
 *
 * Ce que ce test garantit (gouvernance sur les sources, sans rendu) :
 *  - une route /admin/factures-fournisseurs existe, gardée par le MÊME module
 *    optionnel que la route Stock (un magasin sans le module ne voit rien) ;
 *  - l'entrée du menu Administration porte ce module (elle disparaît avec lui) ;
 *  - la page accepte l'espace « admin » et y monte la barre d'administration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (chemin: string) => readFileSync(resolve(__dirname, '..', chemin), 'utf8');

describe('factures fournisseurs — accès depuis l’administration', () => {
  it('route /admin/factures-fournisseurs gardée par le module factures-fournisseurs', () => {
    const app = src('App.tsx');
    const ligne = app.split('\n').find(l => l.includes('path="/admin/factures-fournisseurs"'));
    expect(ligne, 'route absente').toBeTruthy();
    expect(ligne).toMatch(/RequireModule id="factures-fournisseurs"/);
    expect(ligne).toMatch(/espace="admin"/);
  });

  it('entrée du menu Administration, conditionnée au module', () => {
    const side = src('components/AdminSidebar.tsx');
    const ligne = side.split('\n').find(l => l.includes("path: '/admin/factures-fournisseurs'"));
    expect(ligne, 'entrée absente').toBeTruthy();
    expect(ligne).toMatch(/module: 'factures-fournisseurs'/);
  });

  it('la page monte AdminSidebar en espace admin, StocksSidebar sinon', () => {
    const page = src('pages/StocksFactures.tsx');
    expect(page).toMatch(/espace === 'admin' \? <AdminSidebar\/> : <StocksSidebar\/>/);
  });

  it('témoin : la route Stock existe toujours, avec la même garde', () => {
    const ligne = src('App.tsx').split('\n').find(l => l.includes('path="/stocks/factures"'));
    expect(ligne).toMatch(/RequireModule id="factures-fournisseurs"/);
  });
});
