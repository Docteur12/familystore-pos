/*
 * Reconstitution de l'HISTORIQUE des réceptions (collection `receptions`),
 * supprimé par « Réinitialiser le magazin ».
 *
 * Source : les mouvements de stock (stockmovements, reason='reception') qui
 * contiennent productId, quantity, note ("Fournisseur: X"), createdAt.
 * Une réception = plusieurs mouvements créés à la suite (même fournisseur,
 * à quelques secondes d'intervalle) → on les regroupe.
 *
 * Usage :
 *   node scripts/reconstruct-receptions.js          → DRY-RUN (lecture seule)
 *   node scripts/reconstruct-receptions.js --apply  → insère les réceptions
 *
 * Sécurité : refuse d'agir si la collection `receptions` n'est pas vide
 *            (pour ne pas créer de doublons).
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const GAP_MS = 120 * 1000; // mouvements à < 2 min = même réception

function loadEnv() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const txt = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*MONGO_URI\s*=\s*(.+)\s*$/);
    if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
  }
  throw new Error('MONGO_URI introuvable');
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  await mongoose.connect(loadEnv());
  const db = mongoose.connection.db;
  const products  = db.collection('products');
  const movements = db.collection('stockmovements');
  const receptions = db.collection('receptions');
  const users     = db.collection('users');

  const existing = await receptions.countDocuments();
  if (existing > 0 && APPLY) {
    console.log(`⚠️  La collection receptions contient déjà ${existing} fiche(s). Abandon pour éviter les doublons.`);
    await mongoose.disconnect();
    return;
  }

  // Utilisateur à attribuer (creePar requis) : un magazinier de préférence.
  const mag = await users.findOne({ role: 'magazinier' }) || await users.findOne({ role: 'patron' }) || await users.findOne({});
  if (!mag) throw new Error('Aucun utilisateur trouvé pour creePar');

  // Mouvements de réception, triés par date.
  const movs = await movements.find({ reason: 'reception', type: 'IN' }).sort({ createdAt: 1 }).toArray();
  if (movs.length === 0) { console.log('Aucun mouvement de réception trouvé.'); await mongoose.disconnect(); return; }

  // Noms des produits.
  const ids = [...new Set(movs.map(m => String(m.productId)))].map(s => new mongoose.Types.ObjectId(s));
  const prods = await products.find({ _id: { $in: ids } }, { projection: { name: 1 } }).toArray();
  const nameMap = new Map(prods.map(p => [String(p._id), p.name]));
  const fournisseurOf = (note) => (note && note.startsWith('Fournisseur:')) ? note.slice('Fournisseur:'.length).trim() : 'Inconnu';

  // Regroupement : même fournisseur + écart de temps < GAP_MS.
  const groups = [];
  let cur = null;
  for (const m of movs) {
    const f = fournisseurOf(m.note);
    const t = new Date(m.createdAt).getTime();
    if (cur && cur.fournisseur === f && (t - cur.lastT) <= GAP_MS) {
      cur.items.push({ productId: m.productId, productName: nameMap.get(String(m.productId)) || '', quantity: m.quantity });
      cur.lastT = t;
    } else {
      cur = { fournisseur: f, firstT: t, lastT: t, items: [{ productId: m.productId, productName: nameMap.get(String(m.productId)) || '', quantity: m.quantity }] };
      groups.push(cur);
    }
  }

  console.log('\n===== RECONSTITUTION HISTORIQUE RÉCEPTIONS =====');
  console.log(`Mode : ${APPLY ? 'APPLICATION (écriture)' : 'DRY-RUN (lecture seule)'}`);
  console.log(`${movs.length} mouvements → ${groups.length} réception(s) reconstituée(s)\n`);
  for (const g of groups.slice(0, 12)) {
    console.log(`• ${new Date(g.firstT).toLocaleString('fr-FR')} · ${g.fournisseur} · ${g.items.length} article(s)`);
  }
  if (groups.length > 12) console.log(`  … et ${groups.length - 12} autre(s)`);

  if (APPLY) {
    const docs = groups.map(g => ({
      fournisseur: g.fournisseur,
      items: g.items,
      creePar: mag._id,
      note: '(reconstituée automatiquement)',
      createdAt: new Date(g.firstT),
      updatedAt: new Date(g.firstT),
    }));
    const res = await receptions.insertMany(docs, { ordered: false });
    console.log(`\n✅ ${res.insertedCount} réception(s) recréée(s) (attribuées à : ${mag.name || mag.role}).`);
  } else {
    console.log('\nℹ️  DRY-RUN : aucune écriture. Relancer avec --apply.');
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error('Erreur :', e.message); process.exit(1); });
