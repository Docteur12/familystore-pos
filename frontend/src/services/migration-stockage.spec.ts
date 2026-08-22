/**
 * Migration du stockage hérité — exigence 6.
 *
 * Le scénario testé est celui d'un vrai navigateur de Family Store au moment
 * du déploiement : des ventes non synchronisées, un jeton, des brouillons,
 * un cache produits. Le risque n'est pas la déconnexion (un jeton se
 * retrouve) mais la **perte silencieuse de ventes réelles** devenues
 * invisibles sous une clé que plus personne ne lit.
 */
import { describe, it, expect, vi } from 'vitest';
import { set as idbSetBrut, get as idbGetBrut } from 'idb-keyval';

// Module réel par défaut : on ne remplace `set` que le temps d'un test, pour
// vérifier que l'échec d'écriture est bien bruyant. Un espion posé
// directement sur un export ES échouerait — le module est figé.
vi.mock('idb-keyval', async (original) => {
  const vrai = await original<typeof import('idb-keyval')>();
  return { ...vrai, set: vi.fn(vrai.set) };
});
import {
  migrerStockageHerite, migrationNecessaire, MigrationStockageError, BOUTIQUE_HERITAGE,
} from './migration-stockage';
import { idbLire, lire, jetonDeBoutique, boutiqueActive, definirJeton } from './storage';

/** Jeton crédible, avec ou sans tenantId. */
function faireJeton(tenantId?: string): string {
  const charge: Record<string, unknown> = { v: 2, sub: 'u1', name: 'Caissière' };
  if (tenantId) charge.tenantId = tenantId;
  return `entete.${btoa(JSON.stringify(charge))}.signature`;
}

/** Reconstitue le stockage d'un navigateur d'avant Caméléon. */
async function planterStockageHerite() {
  await idbSetBrut('pending_sales', [
    { id: 'v1', total: 15000, paymentMethod: 'cash', amountPaid: 15000, createdAt: '2026-08-20T10:00:00Z', items: [], idempotencyKey: 'idem-1' },
    { id: 'v2', total: 3000, paymentMethod: 'cash', amountPaid: 3000, createdAt: '2026-08-20T11:00:00Z', items: [], idempotencyKey: 'idem-2' },
  ]);
  await idbSetBrut('magazin_pending_receptions', [
    { id: 'r1', fournisseur: 'Soleco', items: [], idempotencyKey: 'idem-r1', createdAt: '2026-08-20T09:00:00Z' },
  ]);
  await idbSetBrut('stock_pending_ajouts', [
    { productId: 'p1', quantity: 5, idempotencyKey: 'idem-a1', createdAt: '2026-08-20T09:30:00Z' },
  ]);
  await idbSetBrut('products', [{ _id: 'p1', name: 'Savon' }]);
  localStorage.setItem('access_token', faireJeton());
  localStorage.setItem('fs_held_tickets', '[{"n":1}]');
  localStorage.setItem('fs_brouillon_commande_partenaire', '{"partId":"x"}');
  localStorage.setItem('app_lang', 'fr'); // réglage d'appareil : ne doit PAS bouger
}

describe('migration du stockage hérité', () => {
  it('ne fait rien quand il n’y a rien à migrer', async () => {
    expect(await migrationNecessaire()).toBe(false);
    const rapport = await migrerStockageHerite();
    expect(rapport.effectuee).toBe(false);
  });

  it('rattache les files, les préférences et le jeton à la boutique, sans rien perdre', async () => {
    await planterStockageHerite();
    expect(await migrationNecessaire()).toBe(true);

    const rapport = await migrerStockageHerite();

    expect(rapport.effectuee).toBe(true);
    expect(rapport.boutique).toBe(BOUTIQUE_HERITAGE);
    expect(rapport.files['pending_sales']).toBe(2);

    // ── Vérification document par document ────────────────────────────────
    const ventes = await idbLire<any[]>('pending_sales', BOUTIQUE_HERITAGE);
    expect(ventes).toHaveLength(2);
    expect(ventes!.map(v => v.id).sort()).toEqual(['v1', 'v2']);
    expect(ventes!.find(v => v.id === 'v1')!.total).toBe(15000);
    expect(ventes!.find(v => v.id === 'v1')!.idempotencyKey).toBe('idem-1');

    expect(await idbLire<any[]>('magazin_pending_receptions', BOUTIQUE_HERITAGE)).toHaveLength(1);
    expect(await idbLire<any[]>('stock_pending_ajouts', BOUTIQUE_HERITAGE)).toHaveLength(1);
    expect(await idbLire<any[]>('products', BOUTIQUE_HERITAGE)).toEqual([{ _id: 'p1', name: 'Savon' }]);

    expect(lire('fs_held_tickets', BOUTIQUE_HERITAGE)).toBe('[{"n":1}]');
    expect(lire('fs_brouillon_commande_partenaire', BOUTIQUE_HERITAGE)).toBe('{"partId":"x"}');

    // Le jeton est rattaché et la boutique devient active.
    expect(jetonDeBoutique(BOUTIQUE_HERITAGE)).not.toBeNull();
    expect(boutiqueActive()).toBe(BOUTIQUE_HERITAGE);

    // ── Plus rien sous les anciennes clés ─────────────────────────────────
    expect(await idbGetBrut('pending_sales')).toBeUndefined();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('fs_held_tickets')).toBeNull();

    // Le réglage d'appareil n'a pas été touché.
    expect(localStorage.getItem('app_lang')).toBe('fr');
  });

  it('suit le tenantId du jeton quand il en porte un', async () => {
    const AUTRE = '000000000000000000000009';
    await idbSetBrut('pending_sales', [{ id: 'v1', total: 100 }]);
    localStorage.setItem('access_token', faireJeton(AUTRE));

    const rapport = await migrerStockageHerite();

    expect(rapport.boutique).toBe(AUTRE);
    expect(await idbLire<any[]>('pending_sales', AUTRE)).toHaveLength(1);
    expect(boutiqueActive()).toBe(AUTRE);
  });

  it('est idempotente : rejouée, elle ne duplique aucune vente', async () => {
    await planterStockageHerite();
    await migrerStockageHerite();
    const apresPremiere = await idbLire<any[]>('pending_sales', BOUTIQUE_HERITAGE);

    // Second passage (rechargement de la page)
    const rapport2 = await migrerStockageHerite();
    expect(rapport2.effectuee).toBe(false); // plus rien d'hérité

    const apresSeconde = await idbLire<any[]>('pending_sales', BOUTIQUE_HERITAGE);
    expect(apresSeconde).toHaveLength(apresPremiere!.length);
    expect(apresSeconde).toHaveLength(2);
  });

  it('interrompue puis reprise, elle fusionne sans doublon', async () => {
    // Simule un plantage APRÈS écriture côté boutique et AVANT effacement de
    // la clé héritée : la vente existe des deux côtés au redémarrage.
    await idbSetBrut('pending_sales', [{ id: 'v1', total: 100, idempotencyKey: 'idem-1' }]);
    localStorage.setItem('access_token', faireJeton());
    await idbSetBrut(`cam:${BOUTIQUE_HERITAGE}:pending_sales`, [{ id: 'v1', total: 100, idempotencyKey: 'idem-1' }]);

    await migrerStockageHerite();

    const ventes = await idbLire<any[]>('pending_sales', BOUTIQUE_HERITAGE);
    expect(ventes).toHaveLength(1); // fusion par identité, pas d'empilement
  });

  it('conserve les ventes déjà présentes dans la boutique et y ajoute les héritées', async () => {
    await idbSetBrut(`cam:${BOUTIQUE_HERITAGE}:pending_sales`, [{ id: 'deja', total: 500 }]);
    await idbSetBrut('pending_sales', [{ id: 'herite', total: 900 }]);
    localStorage.setItem('access_token', faireJeton());

    await migrerStockageHerite();

    const ventes = await idbLire<any[]>('pending_sales', BOUTIQUE_HERITAGE);
    expect(ventes!.map(v => v.id).sort()).toEqual(['deja', 'herite']);
  });

  it('migre les files orphelines même sans jeton — une vente sans session reste une vente', async () => {
    await idbSetBrut('pending_sales', [{ id: 'orpheline', total: 2500 }]);

    const rapport = await migrerStockageHerite();

    expect(rapport.effectuee).toBe(true);
    expect(rapport.jetonMigre).toBe(false);
    expect(await idbLire<any[]>('pending_sales', BOUTIQUE_HERITAGE)).toHaveLength(1);
    expect(await idbGetBrut('pending_sales')).toBeUndefined();
  });

  it('échoue BRUYAMMENT si une file ne peut pas être migrée', async () => {
    await idbSetBrut('pending_sales', [{ id: 'v1', total: 100 }]);
    localStorage.setItem('access_token', faireJeton());

    // Écriture IndexedDB en panne (quota dépassé, base corrompue…) : la
    // migration ne doit surtout pas « réussir » en laissant la vente derrière.
    vi.mocked(idbSetBrut).mockRejectedValueOnce(new Error('quota dépassé'));

    await expect(migrerStockageHerite()).rejects.toThrow(MigrationStockageError);
    // La clé héritée est INTACTE : rien n'a été perdu.
    expect(await idbGetBrut('pending_sales')).toHaveLength(1);
  });
});

describe('migration — cohabitation avec une boutique déjà active', () => {
  it('ne détourne pas les données héritées vers la boutique consultée', async () => {
    const AUTRE = '000000000000000000000042';
    // L'utilisateur est déjà passé sur une autre boutique…
    definirJeton(AUTRE, faireJeton(AUTRE));
    // …et un stockage hérité traîne, avec son propre jeton sans tenantId.
    await idbSetBrut('pending_sales', [{ id: 'v-heritee', total: 700 }]);
    localStorage.setItem('access_token', faireJeton());

    await migrerStockageHerite();

    // Les ventes héritées vont à la boutique d'héritage, PAS à celle active.
    expect(await idbLire<any[]>('pending_sales', BOUTIQUE_HERITAGE)).toHaveLength(1);
    expect(await idbLire<any[]>('pending_sales', AUTRE)).toBeUndefined();
  });
});
