/**
 * Rollback de la migration multi-tenant — CLI.
 *
 *   Dry-run (défaut) :  ts-node -r tsconfig-paths/register scripts/migrate-rollback.ts
 *   Exécution réelle :  ts-node -r tsconfig-paths/register scripts/migrate-rollback.ts --execute
 *
 * Retire le champ `tenant` de tous les documents et restaure les 9 index
 * uniques d'origine. À n'utiliser qu'en cas de retour arrière avant
 * déploiement du nouveau code.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { rollback } from './migrate-tenant-lib';

async function main() {
  const execute = process.argv.includes('--execute');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log('══════════════════════════════════════════════════════════════');
  console.log(execute ? '  ROLLBACK MULTI-TENANT — EXÉCUTION RÉELLE' : '  ROLLBACK MULTI-TENANT — DRY-RUN (aucune écriture)');
  console.log(`  Base : ${db.databaseName}`);
  console.log('══════════════════════════════════════════════════════════════');

  const r = await rollback(db, { execute });

  console.log('\n1) Restauration des index d’origine');
  for (const l of r.indexes) {
    console.log(`   ${l.collection.padEnd(24)} composite ${l.compositeSupprime ? (execute ? 'supprimé' : 'à supprimer') : 'absent'} · ancien ${l.ancienRecree ? (execute ? 'recréé' : 'à recréer') : 'déjà présent'}`);
  }

  console.log('\n2) Retrait du champ tenant');
  for (const l of r.champsRetires) {
    console.log(`   ${l.collection.padEnd(24)} ${l.retires} document(s) ${execute ? 'nettoyés' : 'à nettoyer'}`);
  }

  await client.close();
  console.log(execute ? '\n✅ Rollback appliqué.' : '\nDRY-RUN terminé. Relancez avec --execute pour appliquer.');
}

// Ne s'exécute QUE lancé directement : ce fichier est aussi importé (pour ses
// constantes) par les scripts de rollback — sans cette garde, un import
// déclencherait la migration, y compris avec --execute.
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
