// @vitest-environment jsdom
/**
 * Photo de facture au téléphone : réduite avant envoi, jamais bloquante.
 *
 * Ce que ce test garantit (HERVAN, 16/09/2026 — la cliente scanne ses factures
 * au téléphone chez ses fournisseurs à l'étranger) :
 *  - les dimensions cibles : grand côté à 2 000 px, proportions gardées, jamais
 *    d'agrandissement ;
 *  - la décision de réduire : PDF jamais, petit JPEG jamais, gros JPEG oui,
 *    HEIC toujours (format refusé par le serveur) ;
 *  - un PDF traverse `preparerFichierFacture` inchangé ;
 *  - sans canvas (jsdom), une image ressort telle quelle — la préparation ne
 *    lève jamais, c'est le serveur qui explique ;
 *  - gouvernance : l'envoi passe par la préparation, et la page offre DEUX
 *    entrées — appareil photo ET fichier existant (l'attribut `capture`
 *    verrouillait sur la caméra : impossible de choisir une photo déjà prise ou
 *    un PDF reçu par WhatsApp).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dimensionsCible, doitReduire, preparerFichierFacture, conseilFormat, COTE_MAX, POIDS_SANS_REDUCTION } from './preparer-image';

const src = (chemin: string) => readFileSync(resolve(__dirname, '..', chemin), 'utf8');
const t = (fr: string) => fr;

describe('dimensionsCible', () => {
  it('ramène le grand côté à 2 000 px en gardant les proportions', () => {
    expect(dimensionsCible(4000, 3000)).toEqual({ largeur: 2000, hauteur: 1500 });
    expect(dimensionsCible(3000, 4000)).toEqual({ largeur: 1500, hauteur: 2000 });
  });
  it('n’agrandit jamais', () => {
    expect(dimensionsCible(1200, 800)).toEqual({ largeur: 1200, hauteur: 800 });
    expect(dimensionsCible(COTE_MAX, 10)).toEqual({ largeur: COTE_MAX, hauteur: 10 });
  });
});

describe('doitReduire', () => {
  it('jamais un PDF, jamais un fichier qui n’est pas une image', () => {
    expect(doitReduire({ type: 'application/pdf', size: 20e6 })).toBe(false);
    expect(doitReduire({ type: 'text/plain', size: 20e6 })).toBe(false);
  });
  it('pas un petit JPEG déjà accepté', () => {
    expect(doitReduire({ type: 'image/jpeg', size: POIDS_SANS_REDUCTION - 1 })).toBe(false);
  });
  it('oui pour une grosse photo, oui pour un HEIC quel que soit son poids', () => {
    expect(doitReduire({ type: 'image/jpeg', size: 4e6 })).toBe(true);
    expect(doitReduire({ type: 'image/heic', size: 100 })).toBe(true);
  });
});

describe('preparerFichierFacture — ne bloque jamais', () => {
  it('un PDF ressort strictement inchangé', async () => {
    const pdf = new File([new Uint8Array(1000)], 'facture.pdf', { type: 'application/pdf' });
    expect(await preparerFichierFacture(pdf)).toBe(pdf);
  });
  it('sans canvas ni décodeur (jsdom), une grosse image ressort telle quelle, sans erreur', async () => {
    const photo = new File([new Uint8Array(3 * 1024 * 1024)], 'IMG_0001.jpeg', { type: 'image/jpeg' });
    const r = await preparerFichierFacture(photo);
    expect(r).toBe(photo);
  });
});

describe('conseilFormat', () => {
  it('explique le HEIC, rien pour les autres', () => {
    expect(conseilFormat('image/heic', t)).toMatch(/Le plus compatible/);
    expect(conseilFormat('image/jpeg', t)).toBeNull();
  });
});

describe('gouvernance — la page et l’envoi', () => {
  it('importerFacture passe par la préparation', () => {
    expect(src('api/facturesFournisseurs.ts')).toMatch(/preparerFichierFacture\(/);
  });
  it('la page offre l’appareil photo ET le choix d’un fichier existant', () => {
    const page = src('pages/StocksFactures.tsx');
    const inputs = page.match(/<input[^>]*type="file"[^>]*>/g) ?? [];
    expect(inputs.length).toBe(2);
    expect(inputs.filter(i => /capture=/.test(i)).length).toBe(1);
    expect(inputs.filter(i => !/capture=/.test(i)).length).toBe(1);
  });
});
