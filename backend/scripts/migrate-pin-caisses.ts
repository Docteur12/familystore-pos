/**
 * Migration « PIN de caisse haché » — CLI (phase 3, sécurisation).
 *
 * Remplace le champ `pin` (4 chiffres en clair) des documents `caisses` par la
 * dérivation PBKDF2 `{pinKdf, pinSalt}` (voir src/config/pin.ts), puis retire
 * le clair. Idempotent : une caisse déjà migrée (pinKdf présent) est ignorée.
 *
 *   Dry-run (défaut) :  npm run migrate:pin
 *   Exécution réelle :  npm run migrate:pin -- --execute
 *
 * Ordre de déploiement impératif : sauvegarde → CE script sur la base de
 * production (familystore ET radiance — la .env locale vise familystore_test)
 * → merge/push. L'ancien code lit encore `pin` : ne PAS exécuter avec
 * --purge avant que le nouveau code soit déployé et vérifié.
 *
 *   Purge du clair (après déploiement vérifié) :  npm run migrate:pin -- --execute --purge
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { deriverPin, nouveauSelPin } from '../src/config/pin';

async function main() {
  const execute = process.argv.includes('--execute');
  const purge = process.argv.includes('--purge');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('caisses');

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  MIGRATION PIN CAISSES — ${execute ? 'EXÉCUTION RÉELLE' : 'DRY-RUN (aucune écriture)'}${purge ? ' + PURGE DU CLAIR' : ''}`);
  console.log(`  Base : ${db.databaseName}`);
  console.log('══════════════════════════════════════════════════════════════');

  const docs = await col.find({}).toArray();
  for (const doc of docs) {
    const d = doc as any;
    if (d.pinKdf && (!d.pin || purge)) {
      if (purge && d.pin) {
        console.log(`  ${d.code ?? d._id} : purge du PIN en clair${execute ? '' : ' (à faire)'}`);
        if (execute) await col.updateOne({ _id: doc._id }, { $unset: { pin: '' } });
      } else {
        console.log(`  ${d.code ?? d._id} : déjà migrée — rien à faire.`);
      }
      continue;
    }
    if (!d.pin) {
      console.log(`  !! ${d.code ?? d._id} : ni pin ni pinKdf — à corriger à la main (PIN à redéfinir dans Caisses).`);
      continue;
    }
    const pinSalt = nouveauSelPin();
    const pinKdf = deriverPin(String(d.pin), pinSalt);
    console.log(`  ${d.code ?? d._id} : dérivation ${execute ? 'écrite' : 'à écrire'}${purge ? ' + clair retiré' : ' (clair conservé pour l\'ancien code encore en ligne)'}`);
    if (execute) {
      const update: any = { $set: { pinKdf, pinSalt } };
      if (purge) update.$unset = { pin: '' };
      await col.updateOne({ _id: doc._id }, update);
    }
  }

  if (!execute) console.log('\nDRY-RUN terminé. Relancez avec --execute pour appliquer.');
  else console.log('\nMigration appliquée.');
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
