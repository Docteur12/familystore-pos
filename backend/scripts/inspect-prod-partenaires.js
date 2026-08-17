// LECTURE SEULE — inspecte les données Partenaires de la base de PRODUCTION (familystore).
// N'écrit / ne supprime RIEN. Usage : node scripts/inspect-prod-partenaires.js
const fs = require('fs');
const { MongoClient } = require('mongodb');

const raw = fs.readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8');
const uriLine = raw.split(/\r?\n/).find(l => l.startsWith('MONGO_URI='));
let uri = uriLine.slice('MONGO_URI='.length).trim();
// Bascule sur la base de PRODUCTION (familystore) au lieu de familystore_test
uri = uri.replace('/familystore_test?', '/familystore?');
const dbName = 'familystore';

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  console.log('Connecté à la base :', dbName, '\n');

  const cols = ['partenaires', 'agences', 'commandepartenaires', 'livraisonpartenaires', 'paiementpartenaires', 'retourpartenaires'];
  for (const c of cols) {
    const n = await db.collection(c).countDocuments().catch(() => 'N/A');
    console.log(`  ${c.padEnd(22)} : ${n} document(s)`);
  }
  console.log('');

  const parts = await db.collection('partenaires').find({}).toArray();
  for (const p of parts) {
    const livr = await db.collection('livraisonpartenaires').find({ partenaire: p._id }).toArray();
    const paie = await db.collection('paiementpartenaires').find({ partenaire: p._id }).toArray();
    const cmds = await db.collection('commandepartenaires').find({ partenaire: p._id }).toArray();
    const totalLivre = livr.reduce((s, l) => s + (l.montant ?? l.total ?? 0), 0);
    const totalPaye = paie.reduce((s, x) => s + (x.montant ?? 0), 0);
    console.log(`• ${p.name}  [${p._id}]  archivee=${!!p.archivee}`);
    console.log(`    commandes=${cmds.length}  livraisons=${livr.length} (total ${totalLivre})  paiements=${paie.length} (total ${totalPaye})  → dette=${totalLivre - totalPaye}`);
    livr.forEach(l => console.log(`      livraison ${l._id}  montant=${l.montant ?? l.total}  cmd=${l.commande ?? '—'}  date=${l.createdAt}`));
  }

  await client.close();
  console.log('\n(Aucune modification effectuée.)');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
