/**
 * Rollback de la migration « PIN de caisse haché » — CLI.
 *
 * ⚠️ La purge (`migrate:pin -- --execute --purge`) est IRRÉVERSIBLE en
 * elle-même : les 4 chiffres ne sont pas déductibles de la dérivation. Le seul
 * retour arrière possible consiste à RELIRE les PIN en clair dans une
 * sauvegarde antérieure à la purge, et à les réécrire.
 *
 * Ce script est chirurgical : il ne touche QUE le champ `pin` de la collection
 * `caisses`. Aucune vente, aucun produit, aucun mouvement de stock n'est
 * restauré — la base garde ses données du jour.
 *
 *   Dry-run (défaut) :
 *     npm run migrate:pin:rollback -- --depuis=familystore_backup_20260819
 *   Exécution réelle :
 *     npm run migrate:pin:rollback -- --depuis=... --execute
 *   Retirer aussi la dérivation (retour complet à l'ancien schéma) :
 *     npm run migrate:pin:rollback -- --depuis=... --execute --retirer-kdf
 *
 * Les caisses absentes de la sauvegarde (créées depuis) sont signalées : leur
 * PIN devra être redéfini à la main dans Paramètres → Caisses.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const execute = process.argv.includes('--execute');
  const retirerKdf = process.argv.includes('--retirer-kdf');
  const depuis = (process.argv.find(a => a.startsWith('--depuis=')) ?? '').split('=')[1];
  if (!depuis) throw new Error('Base source manquante : --depuis=<nom_de_la_sauvegarde>');

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');

  const client = new MongoClient(uri);
  await client.connect();
  const cible = client.db();
  const source = client.db(depuis);

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  ROLLBACK PIN — ${execute ? 'EXÉCUTION RÉELLE' : 'DRY-RUN (aucune écriture)'}`);
  console.log(`  Cible : ${cible.databaseName}   ←   Source : ${depuis}`);
  console.log('══════════════════════════════════════════════════════════════');

  const sauvegardees = await source.collection('caisses').find({}).toArray();
  if (sauvegardees.length === 0) throw new Error(`La base « ${depuis} » ne contient aucune caisse.`);

  const parCode = new Map(sauvegardees.map((c: any) => [String(c.code), c]));
  const actuelles = await cible.collection('caisses').find({}).toArray();

  let restaurees = 0;
  const orphelines: string[] = [];
  for (const caisse of actuelles as any[]) {
    const sauvegarde: any = parCode.get(String(caisse.code));
    if (!sauvegarde?.pin) {
      orphelines.push(caisse.code);
      continue;
    }
    console.log(`  ${String(caisse.code).padEnd(6)} PIN ${execute ? 'restauré' : 'à restaurer'} depuis la sauvegarde` +
      `${retirerKdf ? ' + dérivation retirée' : ''}`);
    if (execute) {
      const update: any = { $set: { pin: sauvegarde.pin } };
      if (retirerKdf) update.$unset = { pinKdf: '', pinSalt: '' };
      await cible.collection('caisses').updateOne({ _id: caisse._id }, update);
    }
    restaurees++;
  }

  if (orphelines.length) {
    console.log(`\n  ⚠️ ${orphelines.length} caisse(s) sans PIN dans la sauvegarde : ${orphelines.join(', ')}`);
    console.log('     → PIN à redéfinir à la main (Paramètres → Caisses → Modifier).');
  }

  console.log(`\n  ${restaurees}/${actuelles.length} caisse(s) ${execute ? 'restaurée(s)' : 'restaurable(s)'}.`);
  if (!execute) console.log('\nDRY-RUN terminé. Relancez avec --execute pour appliquer.');
  await client.close();
}

// Ne s'exécute QUE lancé directement : ce fichier est aussi importé (pour ses
// constantes) par les scripts de rollback — sans cette garde, un import
// déclencherait la migration, y compris avec --execute.
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
