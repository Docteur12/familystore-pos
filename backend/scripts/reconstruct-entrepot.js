/*
 * Reconstitution du stock entrepôt (stockMagazin) après une « Réinitialisation
 * du magazin » faite par erreur.
 *
 * La réinitialisation a : mis stockMagazin=0 partout + supprimé les réceptions.
 * MAIS elle n'a PAS touché :
 *   - les mouvements de stock (stockmovements, reason='reception')  → entrées
 *   - les demandes/envois     (demandestocks, statut envoyé|reçu)   → sorties
 *
 * On reconstitue : stockMagazin = Σ(réceptions) − Σ(envois sortis).
 *
 * Usage :
 *   node scripts/reconstruct-entrepot.js          → DRY-RUN (lecture seule, aucun changement)
 *   node scripts/reconstruct-entrepot.js --apply  → applique la restauration
 *
 * ⚠️ Limite : les ajustements manuels du stock entrepôt (bouton « ajuster »)
 *    ne sont pas tracés → ces produits sont signalés mais non garantis exacts.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Lecture de MONGO_URI depuis backend/.env (sans dépendance dotenv).
function loadEnv() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const envPath = path.join(__dirname, '..', '.env');
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*MONGO_URI\s*=\s*(.+)\s*$/);
    if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
  }
  throw new Error('MONGO_URI introuvable (env ou backend/.env)');
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const uri = loadEnv();
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const products   = db.collection('products');
  const movements  = db.collection('stockmovements');
  const demandes   = db.collection('demandestocks');

  // Total reçu par produit (mouvements de réception).
  const inAgg = await movements.aggregate([
    { $match: { reason: 'reception', type: 'IN' } },
    { $group: { _id: '$productId', total: { $sum: '$quantity' } } },
  ]).toArray();
  const inMap = new Map(inAgg.map(r => [String(r._id), r.total]));

  // Total sorti par produit (envois ayant quitté l'entrepôt : statut envoyé|reçu).
  const outAgg = await demandes.aggregate([
    { $match: { statut: { $in: ['envoyé', 'reçu'] } } },
    { $group: { _id: '$produit', total: { $sum: '$quantiteDemandee' } } },
  ]).toArray();
  const outMap = new Map(outAgg.map(r => [String(r._id), r.total]));

  // Construit le plan de restauration.
  const ids = new Set([...inMap.keys(), ...outMap.keys()]);
  const plan = [];
  for (const id of ids) {
    const totalIn  = inMap.get(id)  || 0;
    const totalOut = outMap.get(id) || 0;
    const reconstructed = Math.max(0, totalIn - totalOut);
    if (reconstructed > 0) plan.push({ id, totalIn, totalOut, reconstructed });
  }
  plan.sort((a, b) => b.reconstructed - a.reconstructed);

  // Noms des produits pour l'affichage.
  const objIds = plan.map(p => new mongoose.Types.ObjectId(p.id));
  const prodDocs = await products.find({ _id: { $in: objIds } }, { projection: { name: 1, stockMagazin: 1, stockMagazinAjuste: 1 } }).toArray();
  const prodMap = new Map(prodDocs.map(p => [String(p._id), p]));

  console.log('\n===== RECONSTITUTION STOCK ENTREPÔT =====');
  console.log(`Mode : ${APPLY ? 'APPLICATION (écriture)' : 'DRY-RUN (lecture seule)'}\n`);
  console.log('Produit'.padEnd(46), 'Reçu'.padStart(7), 'Envoyé'.padStart(8), 'Restauré'.padStart(10));
  console.log('-'.repeat(74));
  let totalUnits = 0;
  for (const p of plan) {
    const doc = prodMap.get(p.id);
    const name = (doc?.name || p.id).slice(0, 44);
    console.log(name.padEnd(46), String(p.totalIn).padStart(7), String(p.totalOut).padStart(8), String(p.reconstructed).padStart(10));
    totalUnits += p.reconstructed;
  }
  console.log('-'.repeat(74));
  console.log(`${plan.length} produit(s) à restaurer · ${totalUnits} unités au total\n`);

  if (APPLY) {
    let ok = 0;
    for (const p of plan) {
      await products.updateOne({ _id: new mongoose.Types.ObjectId(p.id) }, { $set: { stockMagazin: p.reconstructed } });
      ok++;
    }
    console.log(`✅ ${ok} produit(s) mis à jour (stockMagazin restauré).`);
  } else {
    console.log('ℹ️  DRY-RUN : aucune modification. Relancer avec --apply pour restaurer.');
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error('Erreur :', e.message); process.exit(1); });
