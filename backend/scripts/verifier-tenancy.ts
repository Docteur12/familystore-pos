/**
 * État du cloisonnement d'une base — lecture seule.
 *
 * Sert à qualifier une migration ou un rollback par des CHIFFRES : combien de
 * documents portent le champ `tenant`, et quels index uniques sont en place
 * (composites `{tenant, clé}` de la version cloisonnée, ou index simples
 * d'origine).
 *
 *   npm run verifier:tenancy
 *
 * N'écrit rien. Ne prend aucun argument : la base visée est celle de
 * MONGO_URI.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { INDEX_CONFIGS, collectionsAEstampiller } from './migrate-tenant-lib';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  ÉTAT DU CLOISONNEMENT — base : ${db.databaseName}`);
  console.log('══════════════════════════════════════════════════════════════');

  let total = 0;
  let avecTenant = 0;
  for (const nom of await collectionsAEstampiller(db)) {
    const coll = db.collection(nom);
    const t = await coll.countDocuments({});
    const a = await coll.countDocuments({ tenant: { $exists: true } });
    total += t;
    avecTenant += a;
    if (t > 0) console.log(`   ${nom.padEnd(24)} ${String(a).padStart(6)}/${String(t).padEnd(6)} avec tenant`);
  }
  console.log(`   ${'TOTAL'.padEnd(24)} ${String(avecTenant).padStart(6)}/${String(total).padEnd(6)}`);

  console.log('\n  Index uniques :');
  const memeCle = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
  let composites = 0;
  let anciens = 0;
  for (const cfg of INDEX_CONFIGS) {
    const existe = await db.listCollections({ name: cfg.collection }).hasNext();
    if (!existe) continue;
    const idx = await db.collection(cfg.collection).indexes();
    const c = idx.some(i => memeCle(i.key, cfg.newKey));
    const o = idx.some(i => memeCle(i.key, cfg.oldKey));
    if (c) composites++;
    if (o) anciens++;
    console.log(`   ${cfg.collection.padEnd(24)} composite ${c ? 'oui' : 'non'} · ancien ${o ? 'oui' : 'non'}`);
  }
  console.log(`\n  → ${composites} index composite(s), ${anciens} index d'origine.`);
  const etat = avecTenant === 0 ? 'AUCUN document cloisonné (état « avant migration »)'
    : avecTenant === total ? 'TOUS les documents cloisonnés'
    : `ÉTAT MIXTE — ${total - avecTenant} document(s) sans tenant`;
  console.log(`  → ${etat}.`);

  await client.close();
}

// Ne s'exécute QUE lancé directement : ce fichier est aussi importé (pour ses
// constantes) par les scripts de rollback — sans cette garde, un import
// déclencherait la migration, y compris avec --execute.
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
