/**
 * Migration multi-tenant — CLI.
 *
 *   Dry-run (défaut) :  ts-node -r tsconfig-paths/register scripts/migrate-add-tenant.ts
 *   Exécution réelle :  ts-node -r tsconfig-paths/register scripts/migrate-add-tenant.ts --execute
 *
 * Ordre de déploiement impératif (voir AUDIT-SAAS §5) :
 *   sauvegarde (mongodump) → CE script → déploiement du nouveau code.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { migrate, verify } from './migrate-tenant-lib';
import { DEFAULT_TENANT_ID } from '../src/tenancy/tenant-context';

async function main() {
  const execute = process.argv.includes('--execute');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log('══════════════════════════════════════════════════════════════');
  console.log(execute ? '  MIGRATION MULTI-TENANT — EXÉCUTION RÉELLE' : '  MIGRATION MULTI-TENANT — DRY-RUN (aucune écriture)');
  console.log(`  Base : ${db.databaseName}   Tenant : ${DEFAULT_TENANT_ID}`);
  console.log('══════════════════════════════════════════════════════════════');

  const rapport = await migrate(db, { execute });

  console.log('\n1) Estampillage du tenant');
  for (const l of rapport.stamp) {
    console.log(`   ${l.collection.padEnd(24)} total ${String(l.total).padStart(7)} · à estampiller ${String(l.aEstampiller).padStart(7)}${execute ? ` · estampillés ${l.estampilles}` : ''}`);
  }

  console.log('\n2) Reconstruction des index (composites { tenant, clé })');
  for (const l of rapport.indexes) {
    if (l.absent) { console.log(`   ${l.collection.padEnd(24)} (collection absente — ignorée)`); continue; }
    const drop = l.ancienSupprime ? `ancien « ${l.ancienSupprime} » ${execute ? 'supprimé' : 'à supprimer'}` : 'aucun ancien';
    const create = l.compositeCree ? `composite ${execute ? 'créé' : 'à créer'}` : 'composite déjà présent';
    console.log(`   ${l.collection.padEnd(24)} ${drop} · ${create}`);
  }

  if (!execute) {
    console.log('\nDRY-RUN terminé. Relancez avec --execute pour appliquer.');
    await client.close();
    return;
  }

  console.log('\n3) Vérification chiffrée');
  const v = await verify(db);
  for (const l of v.lignes) {
    const flag = l.ecart === 0 ? 'OK ' : '!! ';
    console.log(`   ${flag}${l.collection.padEnd(24)} ${l.avecTenant}/${l.total} avec tenant · écart ${l.ecart}`);
  }
  const indexKo = v.indexComposites.filter(i => !i.present);
  if (indexKo.length) console.log(`   !! index composites manquants : ${indexKo.map(i => i.collection).join(', ')}`);

  await client.close();

  if (!v.ok) {
    console.error('\n❌ VÉRIFICATION EN ÉCHEC — écart non nul ou index manquant. Voir ci-dessus.');
    process.exit(1);
  }
  console.log('\n✅ Migration vérifiée : zéro écart, tous les index composites présents.');
}

// Ne s'exécute QUE lancé directement : ce fichier est aussi importé (pour ses
// constantes) par les scripts de rollback — sans cette garde, un import
// déclencherait la migration, y compris avec --execute.
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
