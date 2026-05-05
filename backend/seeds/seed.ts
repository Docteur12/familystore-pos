import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

// ── Schemas inline (évite d'importer NestJS) ─────────────────────────────────

const CaisseSchema = new mongoose.Schema({
  nom:   { type: String, required: true },
  code:  { type: String, required: true, unique: true, uppercase: true },
  pin:   { type: String, required: true },
  ville: { type: String, default: 'Douala' },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['caissier', 'patron', 'gestionnaire', 'magazinier'], default: 'caissier' },
  phone:    { type: String, default: '' },
  caisseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Caisse', default: null },
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  barcode:        { type: String, unique: true, sparse: true },
  price:          { type: Number, required: true },
  costPrice:      { type: Number, required: true },
  stock:          { type: Number, default: 0 },
  alertThreshold: { type: Number, default: 5 },
  category:       { type: String },
  unit:           { type: String, default: 'pce' },
}, { timestamps: true });

const CaisseModel  = mongoose.model('Caisse',  CaisseSchema);
const UserModel    = mongoose.model('User',    UserSchema);
const ProductModel = mongoose.model('Product', ProductSchema);

// ── Données ───────────────────────────────────────────────────────────────────

const CAISSES_SEED = [
  { nom: 'Caisse 01', code: 'C01', pin: '1111', ville: 'Akwa, Douala' },
  { nom: 'Caisse 02', code: 'C02', pin: '2222', ville: 'Akwa, Douala' },
  { nom: 'Caisse 03', code: 'C03', pin: '3333', ville: 'Akwa, Douala' },
  { nom: 'Caisse 04', code: 'C04', pin: '4444', ville: 'Akwa, Douala' },
];

// Chaque caissier est associé à sa caisse via le champ `caisse`.
// Son mot de passe de connexion (password) est distinct du PIN de la caisse.
// Convention : password = PIN de la caisse (simplifie l'onboarding en démo).
const USERS_SEED: {
  name: string; email: string; password: string;
  role: 'patron' | 'caissier' | 'gestionnaire' | 'magazinier';
  phone?: string;
  caisse: string | null; // code caisse (C01…) ou null
}[] = [
  {
    name:     'Admin Patron',
    email:    'admin@familystore.cm',
    password: 'admin123',
    role:     'patron',
    caisse:   null,
  },
  {
    name:     'Aïcha Nguemo',
    email:    'aicha@familystore.cm',
    password: '1111',
    role:     'caissier',
    phone:    '+237 690 11 11 11',
    caisse:   'C01',
  },
  {
    name:     'Marie Tchapda',
    email:    'marie@familystore.cm',
    password: '2222',
    role:     'caissier',
    phone:    '+237 690 22 22 22',
    caisse:   'C02',
  },
  {
    name:     'Jean Domkam',
    email:    'jean@familystore.cm',
    password: '3333',
    role:     'caissier',
    phone:    '+237 690 33 33 33',
    caisse:   'C03',
  },
  {
    name:     'Fatou Kouassi',
    email:    'fatou@familystore.cm',
    password: '4444',
    role:     'caissier',
    phone:    '+237 690 44 44 44',
    caisse:   'C04',
  },
  {
    name:     'Gestionnaire Stock',
    email:    'stock@familystore.cm',
    password: 'stock123',
    role:     'gestionnaire',
    caisse:   null,
  },
  {
    name:     'Magazinier Principal',
    email:    'magazinier@familystore.cm',
    password: 'magazin123',
    role:     'magazinier',
    caisse:   null,
  },
];

const PRODUCTS_SEED = [
  {
    name: 'Huile Végétale Diamaor 1L', barcode: 'FS-0000001',
    price: 1200, costPrice: 950, stock: 48, alertThreshold: 10,
    category: 'Alimentation', unit: 'bouteille',
  },
  {
    name: 'Savon Lux Rose 90g', barcode: 'FS-0000002',
    price: 350, costPrice: 250, stock: 120, alertThreshold: 20,
    category: 'Hygiène', unit: 'pce',
  },
  {
    name: 'Sucre Cristal 1kg', barcode: 'FS-0000003',
    price: 750, costPrice: 600, stock: 60, alertThreshold: 15,
    category: 'Alimentation', unit: 'kg',
  },
  {
    name: 'Eau Minérale Supermont 1.5L', barcode: 'FS-0000004',
    price: 500, costPrice: 380, stock: 72, alertThreshold: 24,
    category: 'Boissons', unit: 'bouteille',
  },
  {
    name: 'Farine de Blé Top Flour 1kg', barcode: 'FS-0000005',
    price: 650, costPrice: 500, stock: 35, alertThreshold: 10,
    category: 'Alimentation', unit: 'kg',
  },
  {
    name: 'Jus Pamplemousse 33cl', barcode: 'FS-0000006',
    price: 500, costPrice: 350, stock: 90, alertThreshold: 20,
    category: 'Boissons', unit: 'canette',
  },
  {
    name: 'Savon AZUR 200g', barcode: 'FS-0000007',
    price: 300, costPrice: 200, stock: 150, alertThreshold: 30,
    category: 'Hygiène', unit: 'pce',
  },
];

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/familystore';
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║        Family Store POS — Seed           ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`\nConnexion : ${uri.replace(/:([^@]+)@/, ':****@')}`);
  await mongoose.connect(uri);
  console.log('✓ Connecté à MongoDB\n');

  // ── 1. Caisses ──────────────────────────────────────────────────────────────
  console.log('┌─ CAISSES ─────────────────────────────────');
  const caisseMap = new Map<string, mongoose.Types.ObjectId>(); // code → _id

  for (const c of CAISSES_SEED) {
    const doc = await CaisseModel.findOneAndUpdate(
      { code: c.code },
      { $set: c },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    caisseMap.set(doc.code, doc._id as mongoose.Types.ObjectId);
    console.log(`│  [${doc.code}] ${doc.nom.padEnd(12)}  PIN: ${doc.pin}  (${doc.ville})`);
  }
  console.log(`└── ${CAISSES_SEED.length} caisse(s) initialisée(s)\n`);

  // ── 2. Utilisateurs ─────────────────────────────────────────────────────────
  console.log('┌─ UTILISATEURS ────────────────────────────');
  const emails = USERS_SEED.map(u => u.email);
  const { deletedCount } = await UserModel.deleteMany({ email: { $in: emails } });
  console.log(`│  ${deletedCount} ancien(s) compte(s) supprimé(s)`);

  for (const u of USERS_SEED) {
    const hashed   = await bcrypt.hash(u.password, 10);
    const caisseId = u.caisse ? (caisseMap.get(u.caisse) ?? null) : null;
    const doc      = await UserModel.create({
      name: u.name, email: u.email,
      password: hashed, role: u.role,
      phone: u.phone ?? '',
      caisseId,
    });

    const caisseLabel = caisseId
      ? ` → ${CAISSES_SEED.find(c => c.code === u.caisse)?.nom ?? u.caisse}`
      : '';
    console.log(`│  [${doc.role.padEnd(12)}]  ${doc.email.padEnd(30)} ${caisseLabel}`);
  }
  console.log(`└── ${USERS_SEED.length} utilisateur(s) créé(s)\n`);

  // ── 3. Produits ─────────────────────────────────────────────────────────────
  console.log('┌─ PRODUITS ────────────────────────────────');
  for (const p of PRODUCTS_SEED) {
    const doc = await ProductModel.findOneAndUpdate(
      { barcode: p.barcode },
      { $set: p },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(
      `│  [${doc.barcode}]  ${doc.name.padEnd(32)}  ${String(doc.price).padStart(6)} XAF  stock: ${doc.stock}`,
    );
  }
  console.log(`└── ${PRODUCTS_SEED.length} produit(s) initialisé(s)\n`);

  // ── Résumé ──────────────────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Seed terminé avec succès ✓              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('\nComptes de test :');
  for (const u of USERS_SEED) {
    const caisseInfo = u.caisse
      ? `  [${u.caisse} · PIN ${CAISSES_SEED.find(c => c.code === u.caisse)?.pin}]`
      : '';
    console.log(`  ${u.role.padEnd(12)}  ${u.email.padEnd(30)}  mdp: ${u.password}${caisseInfo}`);
  }
  console.log('');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('\n✗ Erreur seed :', err.message);
  process.exit(1);
});
