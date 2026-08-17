/**
 * Bibliothèque de migration multi-tenant — logique pure, sans I/O de console,
 * pour être pilotée aussi bien par les CLI (migrate/rollback) que par les tests.
 *
 * Ordre STRICT imposé par migrate() :
 *   1. estampiller `tenant` sur TOUS les documents de TOUTES les collections ;
 *   2. SEULEMENT ENSUITE, remplacer les 9 index uniques globaux par leurs
 *      équivalents composites { tenant, clé }.
 * Jamais l'inverse : reconstruire les index avant l'estampillage créerait des
 * doublons { tenant: null, clé } et ferait échouer la contrainte d'unicité.
 *
 * Propriétés : idempotent (rejouable après interruption), sans écriture en
 * dry-run, vérification chiffrée intégrée.
 */
import { Db } from 'mongodb';
import { DEFAULT_TENANT_ID } from '../src/tenancy/tenant-context';

// Collections NON cloisonnées à ne jamais estampiller (plateforme, système).
// Vide pour l'instant ; se remplira quand les schémas Tenant/Plan existeront.
export const EXCLUDED_COLLECTIONS = new Set<string>(['tenants', 'plans']);

/** Un index à faire migrer : de l'ancien global au nouveau composite par tenant. */
export interface IndexConfig {
  collection: string;
  oldKey: Record<string, 1 | -1>;
  newKey: Record<string, 1 | -1>;
  newOptions: Record<string, unknown>;
  /** Options de l'ancien index, pour le rollback. */
  oldOptions: Record<string, unknown>;
}

const PARTIEL = (champ: string) => ({
  unique: true,
  partialFilterExpression: { [champ]: { $type: 'string' } },
});
const ANCIEN_SPARSE = { unique: true, sparse: true };

/** Les 9 index à migrer (voir AUDIT-SAAS §2.4). */
export const INDEX_CONFIGS: IndexConfig[] = [
  { collection: 'caisses',              oldKey: { code: 1 },                       oldOptions: { unique: true }, newKey: { tenant: 1, code: 1 },                       newOptions: { unique: true } },
  { collection: 'products',             oldKey: { barcode: 1 },                    oldOptions: ANCIEN_SPARSE,    newKey: { tenant: 1, barcode: 1 },                    newOptions: PARTIEL('barcode') },
  { collection: 'categories',           oldKey: { category: 1, subCategory: 1 },   oldOptions: { unique: true }, newKey: { tenant: 1, category: 1, subCategory: 1 },   newOptions: { unique: true } },
  { collection: 'sales',                oldKey: { idempotencyKey: 1 },             oldOptions: ANCIEN_SPARSE,    newKey: { tenant: 1, idempotencyKey: 1 },             newOptions: PARTIEL('idempotencyKey') },
  { collection: 'receptions',           oldKey: { idempotencyKey: 1 },             oldOptions: ANCIEN_SPARSE,    newKey: { tenant: 1, idempotencyKey: 1 },             newOptions: PARTIEL('idempotencyKey') },
  { collection: 'stockmovements',       oldKey: { idempotencyKey: 1 },             oldOptions: ANCIEN_SPARSE,    newKey: { tenant: 1, idempotencyKey: 1 },             newOptions: PARTIEL('idempotencyKey') },
  { collection: 'stocksnapshots',       oldKey: { dateKey: 1 },                    oldOptions: { unique: true }, newKey: { tenant: 1, dateKey: 1 },                    newOptions: { unique: true } },
  { collection: 'livraisonpartenaires', oldKey: { idempotencyKey: 1 },             oldOptions: ANCIEN_SPARSE,    newKey: { tenant: 1, idempotencyKey: 1 },             newOptions: PARTIEL('idempotencyKey') },
  { collection: 'users',                oldKey: { email: 1 },                      oldOptions: { unique: true }, newKey: { tenant: 1, email: 1 },                      newOptions: { unique: true } },
];

const memeCle = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Collections réellement présentes, hors exclues et hors collections système. */
async function collectionsAEstampiller(db: Db): Promise<string[]> {
  const infos = await db.listCollections().toArray();
  return infos
    .map(i => i.name)
    .filter(n => !n.startsWith('system.') && !EXCLUDED_COLLECTIONS.has(n))
    .sort();
}

async function collectionExiste(db: Db, nom: string): Promise<boolean> {
  const infos = await db.listCollections({ name: nom }).toArray();
  return infos.length > 0;
}

// ── Phase 1 : estampillage ────────────────────────────────────────────────────

export interface StampLine { collection: string; total: number; aEstampiller: number; estampilles: number; }

/**
 * Pose `tenant` sur tous les documents qui ne l'ont pas encore.
 * Idempotent : filtre { tenant: { $exists: false } } — un document déjà
 * estampillé (par une exécution précédente interrompue) est ignoré.
 */
export async function stampTenant(
  db: Db,
  tenantId = DEFAULT_TENANT_ID,
  opts: { execute: boolean; onlyCollections?: string[] } = { execute: false },
): Promise<StampLine[]> {
  const collections = opts.onlyCollections ?? (await collectionsAEstampiller(db));
  const lignes: StampLine[] = [];
  for (const nom of collections) {
    const coll = db.collection(nom);
    const total = await coll.countDocuments({});
    const aEstampiller = await coll.countDocuments({ tenant: { $exists: false } });
    let estampilles = 0;
    if (opts.execute && aEstampiller > 0) {
      const r = await coll.updateMany({ tenant: { $exists: false } }, { $set: { tenant: tenantId } });
      estampilles = r.modifiedCount;
    }
    lignes.push({ collection: nom, total, aEstampiller, estampilles });
  }
  return lignes;
}

// ── Phase 2 : reconstruction des index ────────────────────────────────────────

export interface IndexLine { collection: string; ancienSupprime: string | null; composite: Record<string, 1 | -1>; compositeCree: boolean; absent?: boolean; }

/** Remplace les 9 index uniques globaux par leurs composites { tenant, clé }. */
export async function rebuildIndexes(db: Db, opts: { execute: boolean }): Promise<IndexLine[]> {
  const lignes: IndexLine[] = [];
  for (const cfg of INDEX_CONFIGS) {
    if (!(await collectionExiste(db, cfg.collection))) {
      lignes.push({ collection: cfg.collection, ancienSupprime: null, composite: cfg.newKey, compositeCree: false, absent: true });
      continue;
    }
    const coll = db.collection(cfg.collection);
    const index = await coll.indexes();
    const ancien = index.find(i => memeCle(i.key, cfg.oldKey) && i.unique);
    const dejaComposite = index.some(i => memeCle(i.key, cfg.newKey));

    if (opts.execute) {
      // Ordre : supprimer l'ancien puis créer le nouveau (clés différentes,
      // mais on reste net et déterministe).
      if (ancien) await coll.dropIndex(ancien.name);
      if (!dejaComposite) await coll.createIndex(cfg.newKey as any, cfg.newOptions);
    }
    lignes.push({
      collection: cfg.collection,
      ancienSupprime: ancien ? ancien.name : null,
      composite: cfg.newKey,
      compositeCree: !dejaComposite,
    });
  }
  return lignes;
}

// ── Migration complète (ordre strict) ─────────────────────────────────────────

export interface MigrationReport { stamp: StampLine[]; indexes: IndexLine[]; }

export async function migrate(
  db: Db,
  opts: { execute: boolean; tenantId?: typeof DEFAULT_TENANT_ID } = { execute: false },
): Promise<MigrationReport> {
  const tenantId = opts.tenantId ?? DEFAULT_TENANT_ID;
  // 1. TOUT estampiller d'abord.
  const stamp = await stampTenant(db, tenantId, { execute: opts.execute });
  // 2. SEULEMENT ENSUITE, les index.
  const indexes = await rebuildIndexes(db, { execute: opts.execute });
  return { stamp, indexes };
}

// ── Vérification chiffrée ──────────────────────────────────────────────────────

export interface VerifyLine { collection: string; total: number; avecTenant: number; ecart: number; }
export interface VerifyReport { ok: boolean; lignes: VerifyLine[]; indexComposites: { collection: string; present: boolean }[]; }

/**
 * Après migration : chaque collection doit avoir 0 écart (tous les documents
 * portent le tenant), et chaque index composite doit exister. ok=false sinon.
 */
export async function verify(db: Db, tenantId = DEFAULT_TENANT_ID): Promise<VerifyReport> {
  const collections = await collectionsAEstampiller(db);
  const lignes: VerifyLine[] = [];
  for (const nom of collections) {
    const coll = db.collection(nom);
    const total = await coll.countDocuments({});
    const avecTenant = await coll.countDocuments({ tenant: tenantId });
    lignes.push({ collection: nom, total, avecTenant, ecart: total - avecTenant });
  }
  const indexComposites: { collection: string; present: boolean }[] = [];
  for (const cfg of INDEX_CONFIGS) {
    if (!(await collectionExiste(db, cfg.collection))) continue;
    const index = await db.collection(cfg.collection).indexes();
    indexComposites.push({ collection: cfg.collection, present: index.some(i => memeCle(i.key, cfg.newKey)) });
  }
  const ok = lignes.every(l => l.ecart === 0) && indexComposites.every(i => i.present);
  return { ok, lignes, indexComposites };
}

// ── Rollback ────────────────────────────────────────────────────────────────

export interface RollbackReport { champsRetires: { collection: string; retires: number }[]; indexes: { collection: string; compositeSupprime: boolean; ancienRecree: boolean }[]; }

/** Défait la migration : retire `tenant` partout, restaure les index d'origine. */
export async function rollback(db: Db, opts: { execute: boolean }): Promise<RollbackReport> {
  // Index d'abord (on retire les composites), puis les champs.
  const indexes: RollbackReport['indexes'] = [];
  for (const cfg of INDEX_CONFIGS) {
    if (!(await collectionExiste(db, cfg.collection))) continue;
    const coll = db.collection(cfg.collection);
    const idx = await coll.indexes();
    const composite = idx.find(i => memeCle(i.key, cfg.newKey));
    const ancien = idx.find(i => memeCle(i.key, cfg.oldKey));
    if (opts.execute) {
      if (composite) await coll.dropIndex(composite.name);
      if (!ancien) await coll.createIndex(cfg.oldKey as any, cfg.oldOptions);
    }
    indexes.push({ collection: cfg.collection, compositeSupprime: !!composite, ancienRecree: !ancien });
  }

  const champsRetires: RollbackReport['champsRetires'] = [];
  for (const nom of await collectionsAEstampiller(db)) {
    const coll = db.collection(nom);
    const aRetirer = await coll.countDocuments({ tenant: { $exists: true } });
    let retires = 0;
    if (opts.execute && aRetirer > 0) {
      const r = await coll.updateMany({ tenant: { $exists: true } }, { $unset: { tenant: '' } });
      retires = r.modifiedCount;
    }
    champsRetires.push({ collection: nom, retires: opts.execute ? retires : aRetirer });
  }
  return { indexes, champsRetires };
}
