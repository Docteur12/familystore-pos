/**
 * Pré-vol du lot E — état CHIFFRÉ d'une base avant bascule. Lecture seule.
 *
 *   npm run verifier:lot-e                        (base de MONGO_URI)
 *   npm run verifier:lot-e -- --base=familystore_lotE   (autre base du même cluster)
 *
 * N'écrit rien. La base visée est celle de MONGO_URI, ou celle de --base — une COPIE pour la
 * répétition, la production le jour J (c'est la « vérification chiffrée » de
 * la règle n° 3 : des comptes, pas une impression d'écran).
 *
 * Le code Caméléon n'exige AUCUNE migration de données pour les deux clients
 * existants : ses nouveaux champs ont tous une valeur par défaut, et les
 * anciens documents sont lus tels quels. Ce que ce script vérifie, c'est que
 * les migrations DÉJÀ requises par le code en production (tenant, identité,
 * PIN haché) ont bien été appliquées, et que rien ne tombera dans un défaut
 * neuf qui ne lui convient pas :
 *
 *   BLOQUANT  — la bascule ne doit pas partir tant que ce n'est pas réglé
 *   À DÉCIDER — un choix humain, consigné dans LOT-E.md (A1, A3)
 *   INFO      — pour le compte rendu
 *
 * Sort en erreur (code 1) s'il reste un point bloquant.
 */
import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';
import { INDEX_CONFIGS, collectionsAEstampiller } from './migrate-tenant-lib';

type Niveau = 'BLOQUANT' | 'À DÉCIDER' | 'INFO' | 'OK';
const constats: { niveau: Niveau; texte: string }[] = [];
const note = (niveau: Niveau, texte: string) => constats.push({ niveau, texte });

async function verifierSettings(db: Db) {
  const docs = await db.collection('settings').find({}).toArray();
  if (docs.length !== 1) {
    note('BLOQUANT', `settings : ${docs.length} document(s) — il en faut exactement 1 en mode single`);
    return;
  }
  const s: any = docs[0];
  const nom = String(s.nomMagasin ?? '').trim();
  nom ? note('OK', `settings.nomMagasin = « ${nom} »`)
      : note('BLOQUANT', 'settings.nomMagasin VIDE — le repli n’est plus une enseigne, les tickets sortiraient sans en-tête (A2)');

  // Identité imprimée (phase 2) : absente = migrate:settings jamais passée.
  const identite = ['slogan', 'mentionsLegales', 'telephonesTicket'] as const;
  const manquants = identite.filter(k => {
    const v = s[k];
    return Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim();
  });
  manquants.length === 0
    ? note('OK', `identité imprimée présente (${identite.join(', ')})`)
    : note('À DÉCIDER', `identité imprimée incomplète : ${manquants.join(', ')} — vérifier si voulu ou si migrate:settings a manqué`);

  // A1 — pied de ticket : le défaut est désormais VIDE ; un document qui n'a
  // jamais porté le champ hériterait du vide au premier enregistrement.
  const message = String(s.offreFacture?.message ?? '').trim();
  message
    ? note('OK', `offreFacture.message présent (${message.length} car.) : « ${message.slice(0, 50)}… »`)
    : note('À DÉCIDER', 'offreFacture ABSENT ou vide — A1 : restaurer depuis sauvegarde si ce client en avait un');

  note('INFO', `langue = ${s.langue ?? '(absent → fr)'} · couleurPrincipale = ${s.couleurPrincipale ?? '(absent)'} · manuelUrl = ${s.manuelUrl ? 'renseigné' : 'VIDE (A3 : l’entrée de menu disparaîtra)'}`);
  if (!s.couleurPrincipale) note('À DÉCIDER', 'couleurPrincipale absente : le défaut est passé de #FF0000 au vert Caméléon — ce client sortirait en vert');
}

async function verifierCaisses(db: Db) {
  const col = db.collection('caisses');
  const total = await col.countDocuments({});
  const hachees = await col.countDocuments({ pinKdf: { $exists: true, $ne: '' } });
  const enClair = await col.countDocuments({ pin: { $exists: true } });
  if (total === 0) { note('INFO', 'caisses : aucune'); return; }
  hachees === total
    ? note('OK', `caisses : ${hachees}/${total} avec PIN haché`)
    : note('BLOQUANT', `caisses : ${total - hachees}/${total} SANS pinKdf — migrate:pin n’a pas été appliquée, ces caisses ne pourront plus se déverrouiller`);
  enClair === 0
    ? note('OK', 'caisses : aucun PIN en clair')
    : note('BLOQUANT', `caisses : ${enClair} PIN encore EN CLAIR — la purge (migrate:pin --purge) n’a pas été faite`);
}

async function verifierUtilisateurs(db: Db) {
  const col = db.collection('users');
  const total = await col.countDocuments({});
  const sansEmail = await col.countDocuments({ $or: [{ email: { $exists: false } }, { email: '' }] });
  const parRole = await col.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]).toArray();
  note('INFO', `users : ${total} — ${parRole.map(r => `${r._id} ${r.n}`).join(', ')}`);
  sansEmail === 0
    ? note('OK', 'users : tous ont un e-mail (identifiant de connexion)')
    : note('BLOQUANT', `users : ${sansEmail} compte(s) SANS e-mail — l’e-mail est requis par le schéma, ces comptes ne passeront pas la validation`);
  const fabriques = await col.countDocuments({ email: /@familystore\.cm$/i });
  if (fabriques > 0) note('INFO', `users : ${fabriques} adresse(s) @familystore.cm (probablement fabriquées par l’ancien formulaire — fonctionnent, mais à signaler au client)`);
}

/** Collections plateforme : hors cloisonnement PAR CONCEPTION (`skipTenant`). */
const PLATEFORME = new Set(['proprietaires', 'boutiques', 'licences', 'paiements']);

async function verifierCloisonnement(db: Db) {
  let total = 0, avec = 0;
  const trous: string[] = [];
  // Les collections plateforme ne portent pas de tenant, et ne doivent pas :
  // les compter ici produirait un BLOQUANT sur une base Caméléon saine.
  const metier = (await collectionsAEstampiller(db)).filter(n => !PLATEFORME.has(n));
  for (const nom of metier) {
    const c = db.collection(nom);
    const t = await c.countDocuments({});
    const a = await c.countDocuments({ tenant: { $exists: true } });
    total += t; avec += a;
    if (a < t) trous.push(`${nom} ${t - a}/${t}`);
  }
  avec === total
    ? note('OK', `cloisonnement : ${avec}/${total} documents portent le champ tenant`)
    : note('BLOQUANT', `cloisonnement : ${total - avec} document(s) SANS tenant (${trous.join(', ')}) — le plugin fail-closed les rendra invisibles`);

  const memeCle = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
  let composites = 0, attendus = 0;
  for (const cfg of INDEX_CONFIGS) {
    if (!(await db.listCollections({ name: cfg.collection }).hasNext())) continue;
    attendus++;
    const idx = await db.collection(cfg.collection).indexes();
    if (idx.some(i => memeCle(i.key, cfg.newKey))) composites++;
  }
  composites === attendus
    ? note('OK', `index composites {tenant, clé} : ${composites}/${attendus}`)
    : note('BLOQUANT', `index composites : ${composites}/${attendus} — une copie faite sans copy-db.js perd les index partiels (idempotence, code-barres)`);
}

async function verifierNouveautes(db: Db) {
  // Ce que le nouveau code AJOUTE — attendu absent avant bascule, sans gravité.
  const existantes = new Set((await db.listCollections().toArray()).map(c => c.name));
  const plateforme = ['proprietaires', 'boutiques', 'licences', 'paiements'].filter(n => existantes.has(n));
  note('INFO', plateforme.length
    ? `collections plateforme déjà présentes : ${plateforme.join(', ')} (inattendu en single — vérifier)`
    : 'collections plateforme absentes — normal en mode single, elles n’existent que pour Caméléon');
  const corrigees = existantes.has('sales') ? await db.collection('sales').countDocuments({ 'modifications.0': { $exists: true } }) : 0;
  note('INFO', `ventes déjà corrigées (champ modifications) : ${corrigees}`);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');
  const client = new MongoClient(uri);
  await client.connect();
  // --base=<nom> : vise une autre base du même cluster, sans retoucher l'URI —
  // la répétition lit familystore_lotE et radiance_lotE avec une seule URI.
  const baseArg = process.argv.find(a => a.startsWith('--base='))?.slice('--base='.length);
  const db = client.db(baseArg || undefined);
  const nom = db.databaseName;

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  PRÉ-VOL LOT E — base : ${nom}   (lecture seule)`);
  if (/^(familystore|radiance)$/i.test(nom)) {
    console.log('  ⚠  BASE DE PRODUCTION — ce script ne fait que lire, mais vérifiez');
    console.log('     que c’est bien voulu (jour J) et pas la répétition.');
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  await verifierSettings(db);
  await verifierCaisses(db);
  await verifierUtilisateurs(db);
  await verifierCloisonnement(db);
  await verifierNouveautes(db);
  await client.close();

  const ordre: Niveau[] = ['BLOQUANT', 'À DÉCIDER', 'OK', 'INFO'];
  for (const n of ordre) {
    for (const c of constats.filter(x => x.niveau === n)) console.log(`  [${n.padEnd(9)}] ${c.texte}`);
  }
  const bloquants = constats.filter(c => c.niveau === 'BLOQUANT').length;
  const aDecider = constats.filter(c => c.niveau === 'À DÉCIDER').length;
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(bloquants
    ? `  ✗ ${bloquants} point(s) BLOQUANT(S) — la bascule ne doit pas partir.`
    : `  ✓ Aucun point bloquant.${aDecider ? ` ${aDecider} décision(s) à consigner dans LOT-E.md.` : ''}`);
  process.exit(bloquants ? 1 : 0);
}

if (require.main === module) {
  main().catch(err => { console.error('\nÉCHEC :', err.message ?? err); process.exit(1); });
}
