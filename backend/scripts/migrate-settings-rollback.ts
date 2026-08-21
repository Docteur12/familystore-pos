/**
 * Rollback de la migration « identité imprimée » — CLI.
 *
 * Restaure les champs d'identité du document Settings tels qu'ils étaient dans
 * une sauvegarde ANTÉRIEURE à la migration : valeur précédente réécrite, champ
 * absent de la sauvegarde retiré.
 *
 *   Dry-run (défaut) :
 *     npm run migrate:settings:rollback -- --depuis=familystore_backup_20260819
 *   Exécution réelle :
 *     npm run migrate:settings:rollback -- --depuis=... --execute
 *
 * POURQUOI PAS UN SIMPLE `$unset` — la première version de ce script retirait
 * les champs gérés par la migration. Le test sur copie a montré deux erreurs :
 *  • `ville` valait déjà « Douala » AVANT la migration (qui n'écrit que les
 *    champs vides) : la retirer aurait détruit une donnée préexistante ;
 *  • `adresse` a été REMPLACÉE (« Douala - Bonamousadi » → « Bonamoussadi ») :
 *    il faut restaurer l'ancienne valeur, pas supprimer le champ.
 * Seule une sauvegarde permet de rétablir l'état exact.
 *
 * Ne touche QUE la collection `settings` — aucune vente, aucun stock.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { IDENTITES } from './migrate-settings-identite';

async function main() {
  const execute = process.argv.includes('--execute');
  const idArg = (process.argv.find(a => a.startsWith('--identite=')) ?? '--identite=familystore').split('=')[1];
  const depuis = (process.argv.find(a => a.startsWith('--depuis=')) ?? '').split('=')[1];
  if (!depuis) throw new Error('Base source manquante : --depuis=<nom_de_la_sauvegarde>');
  const IDENTITE = IDENTITES[idArg];
  if (!IDENTITE) throw new Error(`Identité inconnue « ${idArg} » — attendu : ${Object.keys(IDENTITES).join(' | ')}`);

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');
  const client = new MongoClient(uri);
  await client.connect();
  const cible = client.db();
  const source = client.db(depuis);

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  ROLLBACK IDENTITÉ (${idArg}) — ${execute ? 'EXÉCUTION RÉELLE' : 'DRY-RUN (aucune écriture)'}`);
  console.log(`  Cible : ${cible.databaseName}   ←   Source : ${depuis}`);
  console.log('══════════════════════════════════════════════════════════════');

  const champs = Object.keys(IDENTITE);
  const sauvegardes = await source.collection('settings').find({}).toArray();
  if (sauvegardes.length === 0) throw new Error(`La base « ${depuis} » ne contient aucun document settings.`);
  const parId = new Map(sauvegardes.map((d: any) => [String(d._id), d]));

  const memeValeur = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  for (const doc of await cible.collection('settings').find({}).toArray()) {
    const avant: any = parId.get(String(doc._id));
    if (!avant) {
      console.log(`  Settings ${doc._id} : absent de la sauvegarde — ignoré (créé depuis).`);
      continue;
    }
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    for (const champ of champs) {
      const actuel = (doc as any)[champ];
      const precedent = avant[champ];
      if (memeValeur(actuel, precedent)) continue;          // inchangé depuis la sauvegarde
      if (precedent === undefined) unset[champ] = '';        // n'existait pas avant → retirer
      else set[champ] = precedent;                           // restaurer la valeur d'avant
    }

    const nb = Object.keys(set).length + Object.keys(unset).length;
    if (nb === 0) { console.log(`  Settings ${doc._id} : déjà conforme à la sauvegarde.`); continue; }

    console.log(`  Settings ${doc._id} : ${execute ? 'restauration' : 'à restaurer'} — ${nb} champ(s)`);
    for (const [k, v] of Object.entries(set))  console.log(`     ${k.padEnd(18)} ← ${JSON.stringify(v)}`);
    for (const k of Object.keys(unset))        console.log(`     ${k.padEnd(18)} ← (retiré : absent de la sauvegarde)`);

    if (execute) {
      const update: any = {};
      if (Object.keys(set).length)   update.$set = set;
      if (Object.keys(unset).length) update.$unset = unset;
      await cible.collection('settings').updateOne({ _id: doc._id }, update);
    }
  }

  if (!execute) console.log('\nDRY-RUN terminé. Relancez avec --execute pour appliquer.');
  else console.log('\nRollback appliqué.');
  await client.close();
}

// Ne s'exécute QUE lancé directement : ce fichier est aussi importé (pour ses
// constantes) par les scripts de rollback — sans cette garde, un import
// déclencherait la migration, y compris avec --execute.
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
