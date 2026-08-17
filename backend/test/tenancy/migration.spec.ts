/**
 * Migration multi-tenant — sur données synthétiques reproduisant l'état
 * PRÉ-migration (documents sans `tenant`, anciens index uniques globaux).
 *
 * Vérifie les quatre exigences du script :
 *  1. idempotence, y compris reprise après interruption à mi-course ;
 *  2. dry-run sans aucune écriture ;
 *  3. vérification chiffrée (zéro écart, sinon échec) ;
 *  4. cycle complet migration → vérif → rollback → vérif de l'état initial.
 *
 * (La répétition sur le dump Atlas réel de Family Store — exigence 4 du
 * cahier des charges — se fait hors CI, via les CLI, une fois le dump fourni.)
 */
import { MongoClient, Db } from 'mongodb';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';
import {
  migrate, stampTenant, rebuildIndexes, verify, rollback, INDEX_CONFIGS,
} from '../../scripts/migrate-tenant-lib';
import { DEFAULT_TENANT_ID } from '../../src/tenancy/tenant-context';

const memeCle = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

describe('migration multi-tenant (script)', () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('migtest');
  });

  afterAll(async () => {
    await client.close();
    await fermerBaseDeTest();
  });

  /** Reconstitue un état PRÉ-migration : docs sans tenant + anciens index. */
  async function semerEtatInitial() {
    for (const nom of ['caisses', 'products', 'sales', 'users', 'categories', 'expenses']) {
      await db.collection(nom).deleteMany({}).catch(() => {});
      await db.collection(nom).dropIndexes().catch(() => {});
    }
    await db.collection('caisses').insertMany([
      { nom: 'Caisse 01', code: 'C01' },
      { nom: 'Caisse 02', code: 'C02' },
    ]);
    await db.collection('caisses').createIndex({ code: 1 }, { unique: true });

    await db.collection('products').insertMany([
      { name: 'Savon', barcode: '3401' },
      { name: 'Divers sans code' }, // pas de code-barres
    ]);
    await db.collection('products').createIndex({ barcode: 1 }, { unique: true, sparse: true });

    await db.collection('users').insertMany([{ name: 'Patron', email: 'p@x.cm' }]);
    await db.collection('users').createIndex({ email: 1 }, { unique: true });

    await db.collection('sales').insertMany([
      { total: 100, idempotencyKey: 'k1' },
      { total: 200 }, // pas de clé
    ]);
    await db.collection('sales').createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });

    await db.collection('categories').insertMany([{ category: 'Hygiène', subCategory: '' }]);
    await db.collection('categories').createIndex({ category: 1, subCategory: 1 }, { unique: true });

    // Collection sans index unique à migrer, mais à estampiller quand même
    await db.collection('expenses').insertMany([{ amount: 500 }, { amount: 800 }]);
  }

  async function aIndexAvecCle(coll: string, cle: any): Promise<boolean> {
    const idx = await db.collection(coll).indexes();
    return idx.some(i => memeCle(i.key, cle));
  }

  // ── Exigence 2 — DRY-RUN ────────────────────────────────────────────────────

  it('dry-run : n’écrit rien (aucun tenant posé, anciens index intacts)', async () => {
    await semerEtatInitial();

    const rapport = await migrate(db, { execute: false });

    // Le rapport annonce le travail…
    const caisses = rapport.stamp.find(l => l.collection === 'caisses')!;
    expect(caisses.aEstampiller).toBe(2);
    expect(caisses.estampilles).toBe(0); // …mais rien n'est écrit

    // Réalité en base : aucun tenant, ancien index toujours là
    expect(await db.collection('caisses').countDocuments({ tenant: { $exists: true } })).toBe(0);
    expect(await aIndexAvecCle('caisses', { code: 1 })).toBe(true);
    expect(await aIndexAvecCle('caisses', { tenant: 1, code: 1 })).toBe(false);
  });

  // ── Exigences 1 & 3 — MIGRATION + VÉRIFICATION ──────────────────────────────

  it('exécution : estampille tout, remplace les index, vérification à zéro écart', async () => {
    await semerEtatInitial();

    await migrate(db, { execute: true });
    const v = await verify(db);

    expect(v.ok).toBe(true);
    // Zéro écart partout (y compris expenses, sans index à migrer)
    for (const l of v.lignes) expect(l.ecart).toBe(0);
    expect(v.lignes.find(l => l.collection === 'expenses')!.avecTenant).toBe(2);

    // Anciens index supprimés, composites créés
    for (const cfg of INDEX_CONFIGS) {
      if (!(await db.listCollections({ name: cfg.collection }).toArray()).length) continue;
      expect(await aIndexAvecCle(cfg.collection, cfg.newKey)).toBe(true);
      expect(await aIndexAvecCle(cfg.collection, cfg.oldKey)).toBe(false);
    }

    // Le tenant posé est bien DEFAULT_TENANT_ID (source unique)
    const caisse = await db.collection('caisses').findOne({ code: 'C01' });
    expect(String(caisse!.tenant)).toBe(String(DEFAULT_TENANT_ID));

    // L'index partiel autorise TOUJOURS plusieurs produits sans code-barres
    await db.collection('products').insertOne({ name: 'Autre divers', tenant: DEFAULT_TENANT_ID });
    const sansCode = await db.collection('products').countDocuments({ barcode: { $exists: false } });
    expect(sansCode).toBe(2); // pas de collision sur {tenant, null}
  });

  // ── Exigence 1 — IDEMPOTENCE / REPRISE APRÈS INTERRUPTION ───────────────────

  it('reprise après interruption à mi-course : relancer aboutit à l’état correct', async () => {
    await semerEtatInitial();

    // Simule une coupure : seule « caisses » a été estampillée, puis crash
    // AVANT toute reconstruction d'index.
    await stampTenant(db, DEFAULT_TENANT_ID, { execute: true, onlyCollections: ['caisses'] });
    expect(await db.collection('caisses').countDocuments({ tenant: { $exists: true } })).toBe(2);
    expect(await db.collection('users').countDocuments({ tenant: { $exists: true } })).toBe(0);
    expect(await aIndexAvecCle('users', { email: 1 })).toBe(true); // index pas encore touché

    // Relance complète du script
    const reprise = await migrate(db, { execute: true });

    // « caisses » n'est pas ré-estampillée (idempotent)
    expect(reprise.stamp.find(l => l.collection === 'caisses')!.estampilles).toBe(0);
    // « users » l'est cette fois
    expect(reprise.stamp.find(l => l.collection === 'users')!.estampilles).toBe(1);

    // État final : correct et vérifié
    const v = await verify(db);
    expect(v.ok).toBe(true);
    expect(await aIndexAvecCle('users', { tenant: 1, email: 1 })).toBe(true);
    expect(await aIndexAvecCle('users', { email: 1 })).toBe(false);
  });

  it('rejouer la migration déjà terminée est un no-op vérifié', async () => {
    await semerEtatInitial();
    await migrate(db, { execute: true });

    const rejeu = await migrate(db, { execute: true });
    // Rien à estampiller, aucun ancien index à supprimer, composites déjà là
    expect(rejeu.stamp.every(l => l.estampilles === 0)).toBe(true);
    expect(rejeu.indexes.filter(i => !i.absent).every(i => i.ancienSupprime === null && !i.compositeCree)).toBe(true);
    expect((await verify(db)).ok).toBe(true);
  });

  // ── Exigence 3 — la vérification DÉTECTE un écart ───────────────────────────

  it('la vérification échoue si un document échappe à l’estampillage', async () => {
    await semerEtatInitial();
    await migrate(db, { execute: true });

    // Un intrus sans tenant se glisse après coup
    await db.collection('sales').insertOne({ total: 999 });

    const v = await verify(db);
    expect(v.ok).toBe(false);
    expect(v.lignes.find(l => l.collection === 'sales')!.ecart).toBe(1);
  });

  // ── Exigence 4 — CYCLE COMPLET migration → rollback → état initial ──────────

  it('rollback : retire le tenant et restaure les index d’origine', async () => {
    await semerEtatInitial();
    await migrate(db, { execute: true });
    expect((await verify(db)).ok).toBe(true);

    await rollback(db, { execute: true });

    // Plus aucun tenant, composites supprimés, anciens index restaurés
    for (const nom of ['caisses', 'products', 'users', 'sales', 'categories', 'expenses']) {
      expect(await db.collection(nom).countDocuments({ tenant: { $exists: true } })).toBe(0);
    }
    for (const cfg of INDEX_CONFIGS) {
      if (!(await db.listCollections({ name: cfg.collection }).toArray()).length) continue;
      expect(await aIndexAvecCle(cfg.collection, cfg.newKey)).toBe(false);
      expect(await aIndexAvecCle(cfg.collection, cfg.oldKey)).toBe(true);
    }
  });

  it('rollback puis re-migration : boucle stable (l’état se reconstruit)', async () => {
    await semerEtatInitial();
    await migrate(db, { execute: true });
    await rollback(db, { execute: true });
    await migrate(db, { execute: true });
    expect((await verify(db)).ok).toBe(true);
  });
});
