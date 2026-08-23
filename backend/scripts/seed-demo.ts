/**
 * Environnement de démonstration Caméléon — trois boutiques, un propriétaire.
 *
 * Sert à essayer le produit comme un commerçant : bascule entre boutiques,
 * rapport consolidé, bandeau de préavis, lecture seule sur licence expirée,
 * et ajout d'une boutique par le bouton « + » (paiement simulé).
 *
 * ═══ CE SCRIPT EFFACE LA BASE QU'IL VISE ═══
 *
 * D'où deux garde-fous, l'un et l'autre bloquants :
 *  1. le nom de la base doit contenir « demo » ;
 *  2. « familystore » et « radiance » sont refusés explicitement.
 *
 * Le second est redondant avec le premier — c'est voulu. Un effacement de
 * base de production ne se rattrape pas, et une seule condition peut se
 * retrouver contournée par une faute de frappe heureuse (`familystore_demo`
 * passerait le contrôle n° 1). La règle est donc : la base de démonstration
 * est une base À PART, jamais une variante du nom d'un client.
 *
 * Les chiffres sont VOLONTAIREMENT très différents d'une boutique à l'autre,
 * et le récapitulatif final imprime le total attendu : si le consolidé
 * affiche autre chose, l'erreur saute aux yeux sans avoir à compter.
 *
 * Usage :
 *   npm run seed:demo
 *   DEMO_MONGO_URI=mongodb://127.0.0.1:27017/ma_demo npm run seed:demo
 */
import * as dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';

// Port et nom de base : demo-config.js, partagé avec les deux lanceurs. Les
// recopier ici les ferait diverger — c'est déjà arrivé.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { URI: URI_DEFAUT, PORT_MONGO } = require('./demo-config');

const MOT_DE_PASSE = 'Cameleon#2026';
const PIN_CAISSE = '1234';

// ── Garde-fous ───────────────────────────────────────────────────────────────

function verifierBase(uri: string): string {
  const nom = (uri.split('/').pop() ?? '').split('?')[0];

  if (/^(familystore|radiance)/i.test(nom)) {
    throw new Error(
      `Base « ${nom} » refusée : ce script EFFACE la base qu'il vise, et ce nom ` +
      `est celui d'un client. La démonstration doit vivre dans une base à part.`,
    );
  }
  if (!/demo/i.test(nom)) {
    throw new Error(
      `Base « ${nom} » refusée : ce script EFFACE la base qu'il vise. Le nom doit ` +
      `contenir « demo » pour qu'aucune confusion ne soit possible.`,
    );
  }
  return nom;
}

// ── Données de démonstration ─────────────────────────────────────────────────

interface ArticleDemo { nom: string; local: string; prix: number; cout: number; stock: number; categorie: string; unite: string }
interface VenteDemo { jour: number; lignes: [string, number][]; paiement: string }

interface BoutiqueDemo {
  nom: string;
  ville: string;
  /** Jours avant échéance de la licence. Négatif = déjà expirée. */
  licenceDans: number;
  attendu: string;
  fournisseur: { nom: string; contact: string; phone: string };
  partenaire: { nom: string; responsable: string; phone: string; ville: string };
  articles: ArticleDemo[];
  ventes: VenteDemo[];
}

/** Vente répétée `n` fois sur des jours consécutifs — évite d'écrire 24 lignes. */
function serie(jours: number[], lignes: [string, number][], paiement = 'cash'): VenteDemo[] {
  return jours.map(jour => ({ jour, lignes, paiement }));
}

const BOUTIQUES: BoutiqueDemo[] = [
  {
    nom: 'Bonamoussadi',
    ville: 'Douala',
    licenceDans: 300,
    attendu: 'licence valide — rien ne doit alerter',
    fournisseur: { nom: 'Cosmetics Cameroun SARL', contact: 'M. Ndongo', phone: '677112233' },
    partenaire: { nom: 'Grossiste Marché Central', responsable: 'Mme Abena', phone: '699445566', ville: 'Douala' },
    articles: [
      { nom: 'ISANA PARIS DEOSPRAY', local: 'déo bleu',     prix: 3500, cout: 2200, stock: 48, categorie: 'Hygiène',    unite: 'pce' },
      { nom: 'NIVEA SOFT CREME',    local: 'pot blanc',     prix: 4200, cout: 2800, stock: 32, categorie: 'Soins',      unite: 'pce' },
      { nom: 'DOVE SAVON BEAUTE',   local: 'savon dove',    prix: 1200, cout: 700,  stock: 96, categorie: 'Hygiène',    unite: 'pce' },
      { nom: 'HUILE PALME 5L',      local: 'bidon rouge',   prix: 8500, cout: 6800, stock: 24, categorie: 'Alimentaire', unite: 'bidon' },
      { nom: 'RIZ PARFUME 25KG',    local: 'sac riz',       prix: 21000, cout: 18500, stock: 12, categorie: 'Alimentaire', unite: 'sac' },
      { nom: 'LAIT CONCENTRE',      local: 'boîte lait',    prix: 900,  cout: 620,  stock: 120, categorie: 'Alimentaire', unite: 'pce' },
    ],
    ventes: [
      ...serie([1, 2, 3, 4, 5, 6, 7, 8], [['ISANA PARIS DEOSPRAY', 2], ['DOVE SAVON BEAUTE', 3]]),
      ...serie([1, 3, 5, 7], [['RIZ PARFUME 25KG', 1], ['HUILE PALME 5L', 1]], 'mtn_momo'),
      ...serie([2, 4, 6, 8], [['NIVEA SOFT CREME', 2], ['LAIT CONCENTRE', 6]], 'orange_money'),
      ...serie([1, 2, 3, 4, 5, 6, 7, 8], [['LAIT CONCENTRE', 4], ['DOVE SAVON BEAUTE', 2]]),
    ],
  },
  {
    nom: 'Bependa',
    ville: 'Douala',
    licenceDans: 5,
    attendu: 'licence à 5 jours — le bandeau de préavis doit apparaître',
    fournisseur: { nom: 'Distrib Littoral', contact: 'M. Ekwalla', phone: '655778899' },
    partenaire: { nom: 'Boutique Ndogpassi', responsable: 'M. Tchamba', phone: '691223344', ville: 'Douala' },
    articles: [
      { nom: 'SUCRE EN POUDRE 1KG', local: 'paquet sucre', prix: 1100, cout: 850,  stock: 60, categorie: 'Alimentaire', unite: 'pce' },
      { nom: 'SAVON DE MARSEILLE',  local: 'savon jaune',  prix: 800,  cout: 480,  stock: 84, categorie: 'Hygiène',     unite: 'pce' },
      { nom: 'SPAGHETTI 500G',      local: 'pâtes',        prix: 650,  cout: 420,  stock: 150, categorie: 'Alimentaire', unite: 'pce' },
      { nom: 'EAU MINERALE 1.5L',   local: 'bouteille',    prix: 500,  cout: 300,  stock: 200, categorie: 'Boissons',    unite: 'pce' },
    ],
    ventes: [
      ...serie([1, 3, 5, 7], [['SUCRE EN POUDRE 1KG', 2], ['SPAGHETTI 500G', 4]]),
      ...serie([2, 4, 6], [['SAVON DE MARSEILLE', 5], ['EAU MINERALE 1.5L', 6]], 'mtn_momo'),
      ...serie([1, 4, 7], [['EAU MINERALE 1.5L', 12]]),
    ],
  },
  {
    nom: 'Logpom',
    ville: 'Douala',
    licenceDans: -12,
    attendu: 'licence EXPIRÉE — lecture seule, toute saisie neuve refusée en 402',
    fournisseur: { nom: 'Ets Nyalla Provisions', contact: 'Mme Njoya', phone: '678334455' },
    partenaire: { nom: 'Kiosque Logpom', responsable: 'M. Mbappe', phone: '696887766', ville: 'Douala' },
    articles: [
      { nom: 'ALLUMETTES', local: 'boîte',        prix: 100, cout: 55,  stock: 300, categorie: 'Divers',      unite: 'pce' },
      { nom: 'BISCUIT SEC', local: 'paquet',      prix: 350, cout: 210, stock: 90,  categorie: 'Alimentaire', unite: 'pce' },
      { nom: 'SEL FIN 1KG', local: 'sachet sel',  prix: 400, cout: 250, stock: 70,  categorie: 'Alimentaire', unite: 'pce' },
    ],
    ventes: [
      ...serie([2, 5], [['BISCUIT SEC', 3], ['ALLUMETTES', 5]]),
      ...serie([3, 6], [['SEL FIN 1KG', 2]]),
    ],
  },
];

const PROPRIETAIRE = { nom: 'Valdes Tatcheu', email: 'valdes@cameleon.cm', telephone: '690000000' };
const SUPERADMIN = { nom: 'Support Caméléon', email: 'support@cameleon.cm' };

// ── Mise en place ────────────────────────────────────────────────────────────

const jourDansLeMois = (recul: number): Date => {
  // Reculs bornés au mois EN COURS : le rapport consolidé prend par défaut du
  // 1er du mois à aujourd'hui. Une vente datée du mois précédent n'y
  // apparaîtrait pas et laisserait croire à une erreur d'agrégation.
  const d = new Date();
  const plancher = new Date(d.getFullYear(), d.getMonth(), 1, 9, 0, 0, 0);
  d.setDate(d.getDate() - recul);
  d.setHours(10 + (recul % 8), 15, 0, 0);
  return d < plancher ? plancher : d;
};

async function main() {
  const uri = process.env.DEMO_MONGO_URI ?? URI_DEFAUT;
  const nomBase = verifierBase(uri);

  console.log(`\n=== Environnement de démonstration Caméléon ===`);
  console.log(`Base : ${nomBase}  (${uri})\n`);

  // Effacement AVANT le démarrage de l'application : Mongoose recrée ensuite
  // ses index proprement. Effacer après aurait supprimé les index posés à
  // l'initialisation, dont ceux d'unicité.
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch {
    // « ECONNREFUSED » ne dit pas quoi faire. Ici, il n'y a qu'une cause.
    throw new Error(
      `Base injoignable sur le port ${PORT_MONGO}.\n` +
      `         Lancez-la d'abord, dans une AUTRE fenêtre :\n` +
      `             cd /d ${process.cwd()}\n` +
      `             npm run demo:mongo\n` +
      `         Laissez cette fenêtre ouverte, puis relancez « npm run seed:demo » ici.`,
    );
  }
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('Base vidée.');

  process.env.MONGO_URI = uri;
  process.env.TENANT_MODE = 'multi';
  process.env.PAIEMENT_FOURNISSEUR = 'simule';
  process.env.NODE_ENV ??= 'development';
  process.env.JWT_SECRET ??= 'secret-de-demonstration';

  // Import tardif : AppModule lit l'environnement au chargement.
  const { AppModule } = await import('../src/app.module');
  const { ProvisionnementService } = await import('../src/platform/provisionnement.service');
  const { runWithTenant } = await import('../src/tenancy/tenant-context');
  const { deriverPin, nouveauSelPin } = await import('../src/config/pin');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const provisionnement = app.get(ProvisionnementService);

  const modele = (nom: string) => app.get(getModelToken(nom), { strict: false }) as any;
  const Licence = modele('Licence');
  const User = modele('User');
  const Product = modele('Product');
  const Sale = modele('Sale');
  const Fournisseur = modele('Fournisseur');
  const Partenaire = modele('Partenaire');
  const Caisse = modele('Caisse');

  const recap: { nom: string; ventes: number; ca: number; licence: string }[] = [];

  for (const b of BOUTIQUES) {
    // Le compte patron porte l'e-mail du PROPRIÉTAIRE dans les trois
    // boutiques : c'est ce qui permet une seule identité humaine et fait
    // apparaître l'écran « quelle boutique ? » à la connexion.
    const { boutique, licence: licenceCreee } = await provisionnement.creerBoutique({
      nom: b.nom,
      ville: b.ville,
      proprietaire: { email: PROPRIETAIRE.email, nom: PROPRIETAIRE.nom, telephone: PROPRIETAIRE.telephone },
      patron: { nom: PROPRIETAIRE.nom, email: PROPRIETAIRE.email, motDePasse: MOT_DE_PASSE },
    });

    // Licence positionnée pour la démonstration.
    //
    // On RELIT ce qui a été écrit au lieu de le supposer : sans ce contrôle,
    // une échéance non appliquée passerait inaperçue et les trois boutiques
    // paraîtraient valides — c'est-à-dire que la démonstration montrerait
    // exactement le contraire de ce qu'on veut vérifier.
    // On reprend la licence par SON identifiant, rendu par le
    // provisionnement : la chercher par boutique obligerait à refaire un
    // filtre, alors que l'appelant vient de nous donner la réponse.
    const echeance = new Date();
    echeance.setDate(echeance.getDate() + b.licenceDans);
    const licence = await Licence.findById(licenceCreee.id);
    if (!licence) throw new Error(`Licence introuvable pour ${b.nom} (${licenceCreee.id})`);
    licence.dateEcheance = echeance;
    licence.relancesEnvoyees = [];
    await licence.save();

    const relu = await Licence.findById(licence._id).lean();
    const ecart = Math.abs(new Date(relu.dateEcheance).getTime() - echeance.getTime());
    if (ecart > 1000) {
      throw new Error(
        `Échéance non appliquée sur ${b.nom} : attendu ${echeance.toISOString().slice(0, 10)}, ` +
        `lu ${new Date(relu.dateEcheance).toISOString().slice(0, 10)}`,
      );
    }

    const tenantId = boutique.tenantId;
    let ventesCreees = 0;
    let ca = 0;

    await runWithTenant(tenantId, async () => {
      // Les schémas métier nomment ces champs `name`, pas `nom`.
      await Fournisseur.create({
        name: b.fournisseur.nom, contact: b.fournisseur.contact, phone: b.fournisseur.phone,
        email: '', adresse: b.ville, conditionsPaiement: '30j', note: 4,
      });
      await Partenaire.create({
        name: b.partenaire.nom, responsable: b.partenaire.responsable, phone: b.partenaire.phone,
        ville: b.partenaire.ville, lieu: b.partenaire.ville, quartier: b.nom,
        type: 'structure', email: '',
      });

      // Le PIN n'est jamais stocké en clair : le sel et la dérivation sont
      // calculés AVANT la création, `pinKdf` étant requis par le schéma.
      const sel = nouveauSelPin();
      await Caisse.create({
        nom: 'Caisse 01', code: 'C01', ville: b.ville,
        pinSalt: sel, pinKdf: deriverPin(PIN_CAISSE, sel),
      });

      await User.create({
        name: `Caissier ${b.nom}`,
        email: `caisse@${b.nom.toLowerCase()}.cm`,
        password: await bcrypt.hash(MOT_DE_PASSE, 10),
        role: 'caissier',
      });

      const parNom = new Map<string, any>();
      for (const a of b.articles) {
        const p = await Product.create({
          name: a.nom, localName: a.local, price: a.prix, costPrice: a.cout,
          stock: a.stock, initialStock: a.stock, category: a.categorie, unit: a.unite,
          alertThreshold: 5, fournisseur: b.fournisseur.nom, stockMagazin: Math.round(a.stock / 2),
        });
        parNom.set(a.nom, p);
      }

      for (const v of b.ventes) {
        const items = v.lignes.map(([nomArticle, qte]) => {
          const p = parNom.get(nomArticle);
          return { product: p._id, name: p.name, quantity: qte, unitPrice: p.price, discount: 0, originalPrice: 0, divers: false };
        });
        const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const quand = jourDansLeMois(v.jour);

        // `save({ timestamps: false })` : sans cette option, Mongoose écrase
        // `createdAt` par l'instant présent — toutes les ventes tomberaient
        // aujourd'hui et la répartition par jour n'existerait pas.
        const vente = new Sale({
          items, total, subtotal: total, offrePct: 0, offreAmt: 0,
          paymentMethod: v.paiement, amountPaid: total, change: 0,
          cashierName: `Caissier ${b.nom}`, cashierEmail: `caisse@${b.nom.toLowerCase()}.cm`,
          caisseName: 'Caisse 01', createdAt: quand, dateVente: quand,
        });
        await vente.save({ timestamps: false });

        for (const i of items) {
          await Product.updateOne({ _id: i.product }, { $inc: { stock: -i.quantity } });
        }
        ventesCreees++;
        ca += total;
      }
    });

    recap.push({ nom: b.nom, ventes: ventesCreees, ca, licence: b.attendu });
    console.log(`  ${b.nom.padEnd(16)} ${String(ventesCreees).padStart(3)} ventes   ${String(ca).padStart(9)} FCFA`);
  }

  // Superadmin — créé dans la première boutique ; la connexion cherche
  // l'e-mail dans tous les magasins, son rôle traverse ensuite.
  const premier = await app.get(ProvisionnementService).listerBoutiques();
  await runWithTenant(premier[0].tenantId, async () => {
    await User.create({
      name: SUPERADMIN.nom, email: SUPERADMIN.email,
      password: await bcrypt.hash(MOT_DE_PASSE, 10), role: 'superadmin',
    });
  });

  const totalCa = recap.reduce((s, r) => s + r.ca, 0);
  const totalVentes = recap.reduce((s, r) => s + r.ventes, 0);

  console.log(`\n─────────────────────────────────────────────────────────────`);
  console.log(`ATTENDU DANS LE RAPPORT CONSOLIDÉ (mois en cours)`);
  for (const r of recap) {
    console.log(`  ${r.nom.padEnd(16)} ${String(r.ventes).padStart(3)} ventes   ${String(r.ca).padStart(9)} FCFA`);
  }
  console.log(`  ${'TOTAL'.padEnd(16)} ${String(totalVentes).padStart(3)} ventes   ${String(totalCa).padStart(9)} FCFA`);
  console.log(`  Panier moyen ${Math.round(totalCa / totalVentes)} FCFA`);
  console.log(`─────────────────────────────────────────────────────────────`);
  console.log(`\nLICENCES`);
  for (const r of recap) console.log(`  ${r.nom.padEnd(16)} ${r.licence}`);
  console.log(`\nCONNEXION`);
  console.log(`  Propriétaire  ${PROPRIETAIRE.email}   ${MOT_DE_PASSE}`);
  console.log(`                (les 3 boutiques → l'écran « quelle boutique ? » s'affiche)`);
  console.log(`  Superadmin    ${SUPERADMIN.email}   ${MOT_DE_PASSE}`);
  console.log(`  PIN caisse    ${PIN_CAISSE}  (Caisse 01, dans chaque boutique)\n`);

  await app.close();
}

if (require.main === module) {
  main()
    // Sortie explicite : le contexte applicatif garde des ressources ouvertes
    // (connexions, minuteries) dont on n'a plus l'usage une fois les données
    // écrites. Sans cela, le script reste suspendu plusieurs secondes.
    .then(() => process.exit(0))
    .catch(err => { console.error('\nÉCHEC :', err.message ?? err); process.exit(1); });
}
