/**
 * Couche de stockage cloisonnée — exigence 2 du lot A : FAIL-CLOSED.
 *
 * Le point dur n'est pas « les clés sont préfixées » mais « il est IMPOSSIBLE
 * d'écrire hors boutique ». Un repli silencieux sur une clé globale rouvrirait
 * exactement le trou qu'on ferme, et personne ne le verrait avant qu'une vente
 * de Bonamoussadi n'atterrisse à Bependa.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BoutiqueNonDefinieError,
  boutiqueActive, definirBoutiqueActive, oublierBoutiqueActive, exigerBoutiqueActive,
  cleDeBoutique, lire, ecrire, supprimer, lireJson, ecrireJson,
  lireGlobal, ecrireGlobal,
  jeton, jetonDeBoutique, definirJeton, supprimerTousLesJetons, boutiquesConnues,
  purgerBoutique, idbLire, idbEcrire, idbPurgerBoutique,
  boutiqueDuJeton,
} from './storage';

const BONAMOUSSADI = '000000000000000000000001';
const BEPENDA      = '000000000000000000000002';

describe('stockage cloisonné — fail-closed', () => {
  it('sans boutique active, toute lecture ou écriture de données lève', () => {
    expect(boutiqueActive()).toBeNull();

    expect(() => lire('pending_sales')).toThrow(BoutiqueNonDefinieError);
    expect(() => ecrire('pending_sales', '[]')).toThrow(BoutiqueNonDefinieError);
    expect(() => supprimer('pending_sales')).toThrow(BoutiqueNonDefinieError);
    expect(() => ecrireJson('produits', [1, 2])).toThrow(BoutiqueNonDefinieError);
    expect(() => cleDeBoutique('products')).toThrow(BoutiqueNonDefinieError);
    expect(() => exigerBoutiqueActive()).toThrow(BoutiqueNonDefinieError);
  });

  it('le fail-closed ne se laisse pas avaler par la lecture tolérante', () => {
    // lireJson rattrape le JSON illisible, mais JAMAIS l'absence de boutique :
    // sinon un `catch` bien intentionné rendrait la protection décorative.
    expect(() => lireJson('quoi', [])).toThrow(BoutiqueNonDefinieError);
  });

  it('sans boutique active, IndexedDB lève aussi', async () => {
    await expect(idbLire('pending_sales')).rejects.toThrow(BoutiqueNonDefinieError);
    await expect(idbEcrire('pending_sales', [])).rejects.toThrow(BoutiqueNonDefinieError);
  });

  it('aucune clé globale n’est écrite en repli quand la boutique manque', () => {
    try { ecrire('pending_sales', '[]'); } catch { /* attendu */ }
    expect(localStorage.getItem('pending_sales')).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});

describe('stockage cloisonné — séparation des boutiques', () => {
  beforeEach(() => definirBoutiqueActive(BONAMOUSSADI));

  it('préfixe les clés par la boutique active', () => {
    ecrire('pending_sales', 'A');
    expect(localStorage.getItem(`cam:${BONAMOUSSADI}:pending_sales`)).toBe('A');
    expect(localStorage.getItem('pending_sales')).toBeNull();
  });

  it('une boutique ne voit pas les données de l’autre', () => {
    ecrire('pending_sales', 'ventes-bonamoussadi');
    definirBoutiqueActive(BEPENDA);
    expect(lire('pending_sales')).toBeNull();

    ecrire('pending_sales', 'ventes-bependa');
    expect(lire('pending_sales')).toBe('ventes-bependa');
    // …et celles de Bonamoussadi sont intactes.
    expect(lire('pending_sales', BONAMOUSSADI)).toBe('ventes-bonamoussadi');
  });

  it('IndexedDB est cloisonné de la même façon', async () => {
    await idbEcrire('products', [{ nom: 'Savon A' }]);
    definirBoutiqueActive(BEPENDA);
    expect(await idbLire('products')).toBeUndefined();

    await idbEcrire('products', [{ nom: 'Savon B' }]);
    expect(await idbLire<any[]>('products', BONAMOUSSADI)).toEqual([{ nom: 'Savon A' }]);
  });

  it('purger une boutique ne touche pas l’autre', async () => {
    ecrire('pending_sales', 'A');
    await idbEcrire('products', ['a']);
    ecrire('pending_sales', 'B', BEPENDA);
    await idbEcrire('products', ['b'], BEPENDA);

    purgerBoutique(BONAMOUSSADI);
    await idbPurgerBoutique(BONAMOUSSADI);

    expect(lire('pending_sales', BONAMOUSSADI)).toBeNull();
    expect(await idbLire('products', BONAMOUSSADI)).toBeUndefined();
    expect(lire('pending_sales', BEPENDA)).toBe('B');
    expect(await idbLire<string[]>('products', BEPENDA)).toEqual(['b']);
  });
});

describe('jetons — un par boutique', () => {
  it('chaque boutique porte le sien, lisible même quand elle n’est pas active', () => {
    definirJeton(BONAMOUSSADI, 'jeton-bona');
    definirJeton(BEPENDA, 'jeton-bependa');

    // definirJeton bascule la boutique active sur la dernière posée.
    expect(boutiqueActive()).toBe(BEPENDA);
    expect(jeton()).toBe('jeton-bependa');
    // Exigence 3 : la file de Bonamoussadi reste synchronisable.
    expect(jetonDeBoutique(BONAMOUSSADI)).toBe('jeton-bona');
  });

  it('la déconnexion supprime les jetons de TOUTES les boutiques', () => {
    definirJeton(BONAMOUSSADI, 'jeton-bona');
    definirJeton(BEPENDA, 'jeton-bependa');
    ecrire('pending_sales', 'vente-non-synchronisee', BONAMOUSSADI);

    supprimerTousLesJetons();

    expect(jetonDeBoutique(BONAMOUSSADI)).toBeNull();
    expect(jetonDeBoutique(BEPENDA)).toBeNull();
    expect(boutiqueActive()).toBeNull();
    // Les files ne sont PAS emportées par la suppression des jetons : c'est
    // l'appelant qui prévient avant de purger (exigence 5).
    expect(localStorage.getItem(`cam:${BONAMOUSSADI}:pending_sales`)).toBe('vente-non-synchronisee');
  });

  it('recense les boutiques ayant une trace locale', () => {
    definirJeton(BONAMOUSSADI, 'j1');
    definirJeton(BEPENDA, 'j2');
    expect(boutiquesConnues().sort()).toEqual([BONAMOUSSADI, BEPENDA].sort());
  });

  it('lit la boutique inscrite dans le jeton par le serveur', () => {
    const charge = { v: 2, sub: 'u1', tenantId: BEPENDA };
    const faux = `x.${btoa(JSON.stringify(charge))}.y`;
    expect(boutiqueDuJeton(faux)).toBe(BEPENDA);
    expect(boutiqueDuJeton('pas-un-jeton')).toBeNull();
  });
});

describe('réglages globaux — liste fermée', () => {
  it('accepte les clés déclarées', () => {
    ecrireGlobal('app_lang', 'en');
    expect(lireGlobal('app_lang')).toBe('en');
    expect(localStorage.getItem('app_lang')).toBe('en'); // sans préfixe, volontairement
  });

  it('refuse toute autre clé — une donnée de boutique ne se range pas en global', () => {
    expect(() => ecrireGlobal('pending_sales' as any, '[]')).toThrow(/n'est pas une clé globale/);
    expect(() => lireGlobal('access_token' as any)).toThrow(/n'est pas une clé globale/);
  });

  it('les réglages globaux survivent à une bascule et à une purge de boutique', () => {
    ecrireGlobal('fs_print_settings', '{"auto":true}');
    definirBoutiqueActive(BONAMOUSSADI);
    ecrire('pending_sales', 'A');
    purgerBoutique(BONAMOUSSADI);
    expect(lireGlobal('fs_print_settings')).toBe('{"auto":true}');
  });
});
