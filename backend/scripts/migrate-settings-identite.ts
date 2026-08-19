/**
 * Migration « identité imprimée » — CLI.
 *
 * Jusqu'ici, l'en-tête des tickets, des PDF et des e-mails était codé en dur
 * (« Family Store », « BY RDCT », slogan, NIU/RC, téléphones). Ces valeurs
 * vivent désormais dans le document Settings (phase 2 SaaS : un même code pour
 * Family Store et Radiance). Ce script les écrit dans la base pour que rien ne
 * disparaisse des tickets au déploiement.
 *
 *   Dry-run (défaut) :  npm run migrate:settings
 *   Exécution réelle :  npm run migrate:settings -- --execute
 *
 * N'écrit QUE les champs absents ou vides : un magasin qui a déjà renseigné son
 * identité dans Paramètres n'est pas écrasé. Idempotent.
 *
 * Ordre de déploiement impératif : sauvegarde → CE script sur la base
 * `familystore` (la .env locale vise familystore_test) → merge/push.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

// Valeurs historiques Family Store (anciennement dans ReceiptPrint.tsx / Receipt.tsx).
const IDENTITE_FAMILY_STORE = {
  slogan:           'Beauté • Saveur • Bien-être',
  signatureTicket:  'BY RDCT',
  mentionsLegales:  'NIU : MO22118477039J • RC : RC/DLN/2021/B/392',
  telephonesTicket: ['+237 694060524', '+237 682634355'],
  adresse:          'Bonamoussadi',
  ville:            'Douala',
  couleurSecondaire:'#B8893E',
  modules:          ['partenaires'],
  metier:           { inactiviteMinutes: 10, seedFournisseursDemo: true },
};

async function main() {
  const execute = process.argv.includes('--execute');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('settings');

  console.log('══════════════════════════════════════════════════════════════');
  console.log(execute ? '  MIGRATION IDENTITÉ TICKET — EXÉCUTION RÉELLE' : '  MIGRATION IDENTITÉ TICKET — DRY-RUN (aucune écriture)');
  console.log(`  Base : ${db.databaseName}`);
  console.log('══════════════════════════════════════════════════════════════');

  const docs = await col.find({}).toArray();
  if (docs.length === 0) {
    console.log('Aucun document Settings : il sera créé au premier appel de l\'API avec les valeurs par défaut du schéma.');
    console.log('→ Renseignez ensuite l\'identité dans Paramètres magasin.');
    await client.close();
    return;
  }

  for (const doc of docs) {
    const set: Record<string, unknown> = {};
    const vide = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    for (const [k, v] of Object.entries(IDENTITE_FAMILY_STORE)) {
      if (vide((doc as any)[k])) set[k] = v;
    }
    // Le ticket imprime désormais « adresse – ville ». La prod portait
    // « Douala - Bonamousadi » (coquille + ville en double) : on la ramène à
    // « Bonamoussadi » pour retrouver exactement l'ancien en-tête.
    if (String((doc as any).adresse ?? '').trim().toLowerCase() === 'douala - bonamousadi') set.adresse = 'Bonamoussadi';
    const tenant = (doc as any).tenant ?? '(sans tenant)';
    if (Object.keys(set).length === 0) {
      console.log(`  Settings ${doc._id} [${tenant}] : identité déjà renseignée — rien à faire.`);
      continue;
    }
    console.log(`  Settings ${doc._id} [${tenant}] : ${execute ? 'écriture' : 'à écrire'} →`);
    for (const [k, v] of Object.entries(set)) console.log(`     ${k.padEnd(18)} = ${JSON.stringify(v)}`);
    if (execute) await col.updateOne({ _id: doc._id }, { $set: set });
  }

  if (!execute) console.log('\nDRY-RUN terminé. Relancez avec --execute pour appliquer.');
  else console.log('\nMigration appliquée.');
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
