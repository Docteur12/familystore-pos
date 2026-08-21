// Copie une base MongoDB vers une autre dans le MÊME cluster.
// Usage : node scripts/copy-db.js [dbSource] [dbDest]
// Par défaut : familystore -> familystore_test
// Lecture seule sur la source ; la destination est écrasée collection par collection.
require('dotenv').config();
const { MongoClient } = require('mongodb');

const SRC = process.argv[2] || 'familystore';
const DEST = process.argv[3] || 'familystore_test';

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('❌ MONGO_URI manquante dans .env'); process.exit(1); }
  if (SRC === DEST) { console.error('❌ Source et destination identiques'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  console.log(`Connecté au cluster. Copie : ${SRC}  →  ${DEST}\n`);

  const src = client.db(SRC);
  const dest = client.db(DEST);
  const cols = (await src.listCollections().toArray()).filter(c => c.type !== 'view');
  console.log(`${cols.length} collection(s) à copier.\n`);

  let totalDocs = 0;
  for (const c of cols) {
    const name = c.name;
    const docs = await src.collection(name).find({}).toArray();
    await dest.collection(name).drop().catch(() => {});
    if (docs.length) await dest.collection(name).insertMany(docs, { ordered: false });
    totalDocs += docs.length;
    console.log(`  • ${name.padEnd(28)} ${docs.length} doc(s)`);
  }

  // Recrée les index (unicité barcode, clés d'idempotence, email…).
  //
  // ⚠️ Toutes les options sont reprises, `partialFilterExpression` COMPRIS :
  // les index composites { tenant, idempotencyKey } et { tenant, barcode }
  // sont partiels. Sans ce filtre, leur création échoue (les documents sans
  // code-barres se ressemblent tous) — et une copie sans ces index perd
  // silencieusement la protection contre les doublons de stock à la synchro
  // hors-ligne. Un échec est signalé, jamais avalé : une sauvegarde qui a
  // perdu ses garanties d'unicité n'est pas une sauvegarde.
  console.log('\nRecréation des index…');
  let indexOk = 0;
  const indexEchecs = [];
  for (const c of cols) {
    const idx = await src.collection(c.name).indexes().catch(() => []);
    for (const i of idx) {
      if (i.name === '_id_') continue;
      const { key, v, ns, background, ...opts } = i;   // v/ns : métadonnées serveur, non transmissibles
      try {
        await dest.collection(c.name).createIndex(key, opts);
        indexOk++;
      } catch (e) {
        indexEchecs.push(`${c.name}.${i.name} — ${e.message}`);
      }
    }
  }
  console.log(`  ${indexOk} index recréé(s).`);
  if (indexEchecs.length) {
    console.error(`\n❌ ${indexEchecs.length} index NON recréé(s) — la copie n'est pas fidèle :`);
    for (const e of indexEchecs) console.error(`   • ${e}`);
    process.exitCode = 1;
  }

  console.log(`\n✓ Copie terminée — ${totalDocs} document(s) au total dans « ${DEST} ».`);
  await client.close();
})().catch(e => { console.error('❌ Erreur :', e.message); process.exit(1); });
