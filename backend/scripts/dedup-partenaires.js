// Dédoublonne les partenaires par nom (insensible casse/espaces).
// Garde 1 partenaire par nom (de préférence celui qui a un historique),
// le renomme avec la variante la plus fréquente, et supprime les doublons VIDES.
// Les doublons AYANT un historique ne sont jamais supprimés (signalés).
// Usage : node scripts/dedup-partenaires.js [dbName]
require('dotenv').config();
const { MongoClient } = require('mongodb');

const DB = process.argv[2] || 'familystore_test';
const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

(async () => {
  const c = new MongoClient(process.env.MONGO_URI);
  await c.connect();
  const db = c.db(DB);
  const P = db.collection('partenaires');

  const hist = async (id) => {
    const [a, b, d, e] = await Promise.all([
      db.collection('commandepartenaires').countDocuments({ partenaire: id }),
      db.collection('livraisonpartenaires').countDocuments({ partenaire: id }),
      db.collection('paiementpartenaires').countDocuments({ partenaire: id }),
      db.collection('agences').countDocuments({ partenaire: id }),
    ]);
    return a + b + d + e;
  };

  const all = await P.find({}).toArray();
  const groups = {};
  for (const p of all) (groups[norm(p.name)] ||= []).push(p);

  let supprimes = 0, gardesAvecHisto = 0;
  for (const key of Object.keys(groups)) {
    const grp = groups[key];
    if (grp.length < 2) continue;

    // variante de nom la plus fréquente = nom canonique
    const freq = {};
    grp.forEach(p => { freq[p.name] = (freq[p.name] || 0) + 1; });
    const canonique = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];

    // keeper = premier avec historique, sinon le premier
    let keeper = null;
    for (const p of grp) { if (await hist(p._id) > 0) { keeper = p; break; } }
    if (!keeper) keeper = grp[0];

    if (keeper.name !== canonique) await P.updateOne({ _id: keeper._id }, { $set: { name: canonique } });
    console.log(`« ${canonique} » → gardé ${String(keeper._id).slice(-6)}`);

    for (const p of grp) {
      if (String(p._id) === String(keeper._id)) continue;
      if (await hist(p._id) === 0) { await P.deleteOne({ _id: p._id }); supprimes++; console.log(`   supprimé doublon vide ${String(p._id).slice(-6)}`); }
      else { gardesAvecHisto++; console.log(`   ⚠ conservé ${String(p._id).slice(-6)} (a un historique)`); }
    }
  }

  console.log(`\n✓ Terminé — ${supprimes} doublon(s) vide(s) supprimé(s).${gardesAvecHisto ? ` ${gardesAvecHisto} doublon(s) avec historique conservé(s).` : ''}`);
  await c.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
