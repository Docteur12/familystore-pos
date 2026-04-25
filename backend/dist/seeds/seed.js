"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = require("mongoose");
const bcrypt = require("bcrypt");
const UserSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['caissier', 'patron', 'gestionnaire'], default: 'caissier' },
}, { timestamps: true });
const ProductSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    barcode: { type: String, unique: true, sparse: true },
    price: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    alertThreshold: { type: Number, default: 5 },
    category: { type: String },
    unit: { type: String, default: 'pce' },
}, { timestamps: true });
const UserModel = mongoose_1.default.model('User', UserSchema);
const ProductModel = mongoose_1.default.model('Product', ProductSchema);
const USERS = [
    {
        name: 'Admin Patron',
        email: 'admin@familystore.cm',
        password: 'admin123',
        role: 'patron',
    },
    {
        name: 'Caissier Principal',
        email: 'caisse@familystore.cm',
        password: 'caisse123',
        role: 'caissier',
    },
    {
        name: 'Gestionnaire Stock',
        email: 'stock@familystore.cm',
        password: 'stock123',
        role: 'gestionnaire',
    },
];
const PRODUCTS = [
    {
        name: 'Huile Végétale Diamaor 1L',
        barcode: 'FS-0000001',
        price: 1200,
        costPrice: 950,
        stock: 48,
        alertThreshold: 10,
        category: 'Alimentation',
        unit: 'bouteille',
    },
    {
        name: 'Savon Lux Rose 90g',
        barcode: 'FS-0000002',
        price: 350,
        costPrice: 250,
        stock: 120,
        alertThreshold: 20,
        category: 'Hygiène',
        unit: 'pce',
    },
    {
        name: 'Sucre Cristal 1kg',
        barcode: 'FS-0000003',
        price: 750,
        costPrice: 600,
        stock: 60,
        alertThreshold: 15,
        category: 'Alimentation',
        unit: 'kg',
    },
    {
        name: 'Eau Minérale Supermont 1.5L',
        barcode: 'FS-0000004',
        price: 500,
        costPrice: 380,
        stock: 72,
        alertThreshold: 24,
        category: 'Boissons',
        unit: 'bouteille',
    },
    {
        name: 'Farine de Blé Top Flour 1kg',
        barcode: 'FS-0000005',
        price: 650,
        costPrice: 500,
        stock: 35,
        alertThreshold: 10,
        category: 'Alimentation',
        unit: 'kg',
    },
];
async function seed() {
    const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/familystore';
    console.log(`\nConnexion à MongoDB : ${uri}`);
    await mongoose_1.default.connect(uri);
    console.log('Connecté.\n');
    console.log('--- Utilisateurs ---');
    for (const u of USERS) {
        const hashed = await bcrypt.hash(u.password, 10);
        const result = await UserModel.findOneAndUpdate({ email: u.email }, { name: u.name, email: u.email, password: hashed, role: u.role }, { upsert: true, new: true, setDefaultsOnInsert: true });
        console.log(`  [${result.role.padEnd(8)}] ${result.email}`);
    }
    console.log('\n--- Produits ---');
    for (const p of PRODUCTS) {
        const result = await ProductModel.findOneAndUpdate({ barcode: p.barcode }, p, { upsert: true, new: true, setDefaultsOnInsert: true });
        console.log(`  [${result.barcode}] ${result.name.padEnd(35)} ${String(result.price).padStart(6)} FCFA  stock: ${result.stock}`);
    }
    await mongoose_1.default.disconnect();
    console.log('\nSeed terminé avec succes.\n');
}
seed().catch((err) => {
    console.error('Erreur seed :', err.message);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map