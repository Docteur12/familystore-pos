/**
 * Bascule de boutique et déconnexion — exigences 3, 4 et 5 du lot A.
 *
 * Ce sont les scénarios où une régression coûte des ventes réelles :
 *  - 3 : une file marquée boutique A ne part JAMAIS avec un jeton boutique B ;
 *  - 4 : basculer de boutique ne perd pas les files de celle qu'on quitte ;
 *  - 5 : la déconnexion prévient avant de purger, et n'efface rien si
 *        l'utilisateur renonce.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  definirJeton, definirBoutiqueActive, boutiqueActive, jeton, jetonDeBoutique,
  idbLire, idbEcrire, lire, ecrire, ecrireGlobal, lireGlobal,
} from './storage';
import { deconnexion, filesEnAttente, boutiquesBloquees, basculerVersBoutique } from './session';

const BONAMOUSSADI = '000000000000000000000001';
const BEPENDA      = '000000000000000000000002';

const faireJeton = (tenantId: string) =>
  `entete.${btoa(JSON.stringify({ v: 2, sub: 'u1', tenantId }))}.signature`;

describe('bascule de boutique — exigence 4 : les files survivent', () => {
  it('les ventes en attente de la boutique quittée sont intactes après la bascule', async () => {
    // Bonamoussadi : deux ventes non synchronisées.
    basculerVersBoutique(faireJeton(BONAMOUSSADI));
    await idbEcrire('pending_sales', [{ id: 'v1' }, { id: 'v2' }]);
    ecrire('fs_held_tickets', '[{"panier":1}]');

    // L'utilisateur bascule sur Bependa et y encaisse.
    basculerVersBoutique(faireJeton(BEPENDA));
    expect(boutiqueActive()).toBe(BEPENDA);
    await idbEcrire('pending_sales', [{ id: 'v3' }]);

    // Rien n'a bougé côté Bonamoussadi.
    expect(await idbLire<any[]>('pending_sales', BONAMOUSSADI)).toHaveLength(2);
    expect(lire('fs_held_tickets', BONAMOUSSADI)).toBe('[{"panier":1}]');
    // …ni côté Bependa.
    expect(await idbLire<any[]>('pending_sales', BEPENDA)).toHaveLength(1);

    // Et le retour est symétrique.
    basculerVersBoutique(faireJeton(BONAMOUSSADI));
    expect(await idbLire<any[]>('pending_sales')).toHaveLength(2);
  });

  it('chaque boutique garde son jeton, celui de la quittée reste utilisable', async () => {
    basculerVersBoutique(faireJeton(BONAMOUSSADI));
    basculerVersBoutique(faireJeton(BEPENDA));

    expect(jeton()).toBe(jetonDeBoutique(BEPENDA));
    // Exigence 3 : le jeton de Bonamoussadi reste disponible pour vider sa file.
    expect(jetonDeBoutique(BONAMOUSSADI)).not.toBeNull();
  });

  it('refuse un jeton sans identifiant de boutique plutôt que de deviner', () => {
    const sansTenant = `e.${btoa(JSON.stringify({ v: 2, sub: 'u1' }))}.s`;
    expect(() => basculerVersBoutique(sansTenant)).toThrow(/tenantId/);
  });

  it('compte les files en attente boutique par boutique', async () => {
    definirBoutiqueActive(BONAMOUSSADI);
    await idbEcrire('pending_sales', [{ id: 'v1' }, { id: 'v2' }]);
    await idbEcrire('magazin_pending_receptions', [{ id: 'r1' }]);
    await idbEcrire('pending_sales', [{ id: 'v3' }], BEPENDA);

    const bona = await filesEnAttente(BONAMOUSSADI);
    expect(bona.ventes).toBe(2);
    expect(bona.receptions).toBe(1);
    expect(bona.total).toBe(3);

    expect((await filesEnAttente(BEPENDA)).total).toBe(1);
  });
});

describe('exigence 3 — une file ne part jamais avec le jeton d’une autre boutique', () => {
  it('signale les boutiques dont la file attend alors que leur jeton a disparu', async () => {
    definirJeton(BONAMOUSSADI, faireJeton(BONAMOUSSADI));
    await idbEcrire('pending_sales', [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }], BONAMOUSSADI);
    // Le jeton de Bonamoussadi expire / est retiré, la file reste.
    definirJeton(BEPENDA, faireJeton(BEPENDA));
    localStorage.removeItem(`cam:${BONAMOUSSADI}:access_token`); // STORAGE-DIRECT: simule un jeton expiré

    const bloquees = await boutiquesBloquees();

    expect(bloquees).toEqual([{ boutiqueId: BONAMOUSSADI, total: 3 }]);
  });

  it('ne signale rien quand chaque file dispose de son jeton', async () => {
    definirJeton(BONAMOUSSADI, faireJeton(BONAMOUSSADI));
    await idbEcrire('pending_sales', [{ id: 'v1' }], BONAMOUSSADI);
    expect(await boutiquesBloquees()).toEqual([]);
  });
});

describe('déconnexion — exigence 5 : jamais de perte silencieuse', () => {
  it('prévient avant de purger et n’efface RIEN si l’utilisateur renonce', async () => {
    definirJeton(BONAMOUSSADI, faireJeton(BONAMOUSSADI));
    await idbEcrire('pending_sales', [{ id: 'v1' }, { id: 'v2' }]);

    const refuser = vi.fn().mockReturnValue(false);
    const resultat = await deconnexion(refuser);

    expect(resultat).toBe(false);
    expect(refuser).toHaveBeenCalledOnce();
    // Le message nomme ce qui serait perdu.
    expect(refuser.mock.calls[0][0]).toMatch(/2 .*vente/i);
    // Rien n'a été touché.
    expect(await idbLire<any[]>('pending_sales', BONAMOUSSADI)).toHaveLength(2);
    expect(jetonDeBoutique(BONAMOUSSADI)).not.toBeNull();
    expect(boutiqueActive()).toBe(BONAMOUSSADI);
  });

  it('ne demande aucune confirmation quand il n’y a rien en attente', async () => {
    definirJeton(BONAMOUSSADI, faireJeton(BONAMOUSSADI));
    const confirmer = vi.fn().mockReturnValue(true);

    expect(await deconnexion(confirmer)).toBe(true);
    expect(confirmer).not.toHaveBeenCalled();
  });

  it('après confirmation, purge la boutique active et TOUS les jetons', async () => {
    definirJeton(BONAMOUSSADI, faireJeton(BONAMOUSSADI));
    await idbEcrire('pending_sales', [{ id: 'v1' }], BONAMOUSSADI);
    ecrire('fs_held_tickets', '[]', BONAMOUSSADI);
    definirJeton(BEPENDA, faireJeton(BEPENDA));
    await idbEcrire('pending_sales', [{ id: 'v9' }], BEPENDA);
    definirBoutiqueActive(BONAMOUSSADI);
    ecrireGlobal('fs_print_settings', '{"auto":true}');

    expect(await deconnexion(() => true)).toBe(true);

    // Boutique active : purgée.
    expect(await idbLire<any[]>('pending_sales', BONAMOUSSADI)).toBeUndefined();
    expect(lire('fs_held_tickets', BONAMOUSSADI)).toBeNull();
    // Aucun jeton dormant nulle part.
    expect(jetonDeBoutique(BONAMOUSSADI)).toBeNull();
    expect(jetonDeBoutique(BEPENDA)).toBeNull();
    expect(boutiqueActive()).toBeNull();
    // Réglage d'appareil conservé.
    expect(lireGlobal('fs_print_settings')).toBe('{"auto":true}');
  });

  it('la file de l’autre boutique n’est pas emportée par la déconnexion', async () => {
    definirJeton(BEPENDA, faireJeton(BEPENDA));
    await idbEcrire('pending_sales', [{ id: 'v9' }], BEPENDA);
    definirJeton(BONAMOUSSADI, faireJeton(BONAMOUSSADI));

    await deconnexion(() => true);

    // Bependa n'était pas la boutique active : ses ventes attendent toujours,
    // récupérables à la prochaine connexion sur cette boutique.
    expect(await idbLire<any[]>('pending_sales', BEPENDA)).toHaveLength(1);
  });
});
