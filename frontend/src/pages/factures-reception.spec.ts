/**
 * Factures fournisseurs — le flux en DEUX temps côté interface.
 *
 * Décision HERVAN (16/09/2026) : le patron valide le contenu (souvent de
 * l'étranger) ; le stock n'entre que lorsque le magasinier a compté la
 * marchandise arrivée et confirmé. Gouvernance sur les sources (sans rendu) :
 *  - le type de statut connaît « recue », et l'API expose recevoirFacture ;
 *  - la page Factures monte ReceptionFacture pour une facture « validee » ;
 *  - l'espace Magasinier affiche les livraisons attendues dans « Réceptions » ;
 *  - le bouton de validation ne promet plus une réception en entrepôt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (chemin: string) => readFileSync(resolve(__dirname, '..', chemin), 'utf8');

describe('factures fournisseurs — validation puis réception', () => {
  it('API : statut « recue » et recevoirFacture', () => {
    const api = src('api/facturesFournisseurs.ts');
    expect(api).toMatch(/'a_verifier' \| 'validee' \| 'recue' \| 'rejetee'/);
    expect(api).toMatch(/export async function recevoirFacture\(/);
    expect(api).toMatch(/\/recevoir`/);
  });

  it('la page Factures : ReceptionFacture pour une facture validée, plus de « réception » promise à la validation', () => {
    const page = src('pages/StocksFactures.tsx');
    expect(page).toMatch(/selection\.statut === 'validee' && \(\s*<div[^>]*>\s*<ReceptionFacture/);
    expect(page).not.toMatch(/Valider → réception en entrepôt/);
  });

  it('l’espace Magasinier montre les livraisons attendues dans l’onglet Réceptions', () => {
    const page = src('pages/Magazinier.tsx');
    expect(page).toMatch(/import LivraisonsAttendues/);
    const idx = page.indexOf("tab === 'receptions' && (");
    expect(idx).toBeGreaterThan(0);
    expect(page.slice(idx, idx + 900)).toMatch(/<LivraisonsAttendues/);
  });

  it('ReceptionFacture : une quantité par ligne, confirmation explicite, appel à recevoirFacture', () => {
    const c = src('components/ReceptionFacture.tsx');
    expect(c).toMatch(/recevoirFacture\(/);
    expect(c).toMatch(/quantiteRecue/);
    expect(c).toMatch(/Confirmer la réception/);
  });
});
