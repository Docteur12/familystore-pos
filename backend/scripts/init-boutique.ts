/**
 * Initialisation d'une boutique NEUVE — mode single, base vide.
 *
 *   Dry-run (défaut) :
 *     npm run init:boutique -- --base=hervan --identite=hervan \
 *       --patron-nom="Nom Patron" --patron-email=patron@hervan.cm --patron-mdp=... \
 *       --caisses="C01:Caisse 01:1234,C02:Caisse 02:5678"
 *   Exécution réelle : ajouter --execute
 *
 * Pourquoi un script dédié : `seeds/seed.ts` est un jeu de DÉMONSTRATION
 * Family Store (comptes fictifs, PIN en clair — refusés par le code actuel).
 * Une boutique réelle a besoin de quatre choses, ni plus ni moins :
 *   1. son document Settings (identité de la marque, langue, modules) ;
 *   2. son compte patron (mot de passe bcrypt) ;
 *   3. ses caisses, PIN HACHÉ (PBKDF2, le contrat de config/pin.ts) ;
 *   4. sa taxonomie de départ (modifiable ensuite dans l'application).
 * Tout est estampillé DEFAULT_TENANT_ID : c'est ce que lit le plugin de
 * cloisonnement en mode single.
 *
 * Garde-fous : refuse les bases des clients existants (familystore, radiance),
 * idempotent (relancer ne crée aucun doublon), dry-run par défaut, compte rendu
 * chiffré. Un mot de passe patron court est refusé : c'est une clé maîtresse.
 */
import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_TENANT_ID } from '../src/tenancy/tenant-context';
import { deriverPin, nouveauSelPin } from '../src/config/pin';
import { IDENTITES } from './migrate-settings-identite';

/** Bases de clients EN PRODUCTION : jamais une « boutique neuve ». */
export const BASES_PROTEGEES = ['familystore', 'radiance'];

/** Taxonomie de départ d'une boutique de mode enfant — éditable dans l'app. */
export const CATEGORIES_HERVAN: Record<string, string[]> = {
  'Vêtements Fille':   ['Robes', 'Jupes', 'Hauts & T-shirts', 'Pantalons & Leggings', 'Ensembles', 'Vestes & Manteaux'],
  'Vêtements Garçon':  ['Chemises & Polos', 'T-shirts', 'Pantalons & Shorts', 'Ensembles', 'Vestes & Blousons'],
  'Bébé (0-24 mois)':  ['Bodies', 'Pyjamas & Grenouillères', 'Ensembles Naissance', 'Bonnets & Chaussons'],
  'Chaussures':        ['Baskets', 'Sandales', 'Chaussures de Ville', 'Chaussons'],
  'Accessoires':       ['Casquettes & Chapeaux', 'Sacs & Cartables', 'Ceintures', 'Bijoux Enfant', 'Lunettes'],
  'Cérémonie & Fêtes': ['Tenues de Cérémonie', 'Costumes', 'Robes de Soirée', 'Déguisements'],
  'Sous-vêtements':    ['Sous-vêtements', 'Chaussettes & Collants'],
  'École':             ['Uniformes', 'Tenues de Sport'],
};

export interface CaisseInit { nom: string; code: string; pin: string; ville?: string }

export interface OptionsInit {
  identite: string;
  patron: { nom: string; email: string; motDePasse: string };
  caisses: CaisseInit[];
  categories?: Record<string, string[]>;
  /** Logo PNG à embarquer dans Settings.logoUrl (data URL) — optionnel. */
  logoPng?: Buffer;
  execute: boolean;
}

export interface RapportInit {
  base: string;
  settings:   'cree' | 'existant';
  patron:     'cree' | 'existant';
  caisses:    { creees: number; existantes: number };
  categories: { creees: number; existantes: number };
}

const TENANT = DEFAULT_TENANT_ID;

export function validerOptions(o: OptionsInit): void {
  if (!IDENTITES[o.identite]) throw new Error(`Identité inconnue « ${o.identite} » — attendu : ${Object.keys(IDENTITES).join(' | ')}`);
  if (!o.patron.nom.trim()) throw new Error('Nom du patron manquant.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.patron.email)) throw new Error(`E-mail du patron invalide : « ${o.patron.email} »`);
  // Le compte patron ouvre TOUT le magasin : pas de mot de passe court.
  if (o.patron.motDePasse.length < 8) throw new Error('Mot de passe du patron : 8 caractères minimum.');
  if (o.caisses.length === 0) throw new Error('Au moins une caisse est requise.');
  for (const c of o.caisses) {
    if (!/^[A-Z0-9]{2,6}$/i.test(c.code)) throw new Error(`Code de caisse invalide : « ${c.code} » (2 à 6 lettres/chiffres)`);
    if (!/^\d{4,6}$/.test(c.pin)) throw new Error(`PIN de la caisse ${c.code} : 4 à 6 chiffres.`);
  }
  const codes = o.caisses.map(c => c.code.toUpperCase());
  if (new Set(codes).size !== codes.length) throw new Error('Codes de caisse en double.');
}

/**
 * Fait le travail sur une base ouverte. Exportée pour être testée sur une
 * base en mémoire — le CLI ne fait qu'ouvrir la connexion et afficher.
 */
export async function initialiserBoutique(db: Db, o: OptionsInit): Promise<RapportInit> {
  validerOptions(o);
  if (BASES_PROTEGEES.includes(db.databaseName.toLowerCase())) {
    throw new Error(`Refus : « ${db.databaseName} » est la base d'un client en production, pas une boutique neuve.`);
  }
  const identite = IDENTITES[o.identite];
  const rapport: RapportInit = {
    base: db.databaseName, settings: 'existant', patron: 'existant',
    caisses: { creees: 0, existantes: 0 }, categories: { creees: 0, existantes: 0 },
  };
  const maintenant = new Date();

  // 1. Settings — un seul document par boutique en mode single.
  const settings = db.collection('settings');
  if (!(await settings.findOne({ tenant: TENANT }))) {
    rapport.settings = 'cree';
    // Le logo voyage en data URL (Settings.logoUrl accepte « base64 ou URL ») :
    // pas de stockage de fichiers à mettre en place pour ouvrir une boutique.
    const logo = o.logoPng ? { logoUrl: `data:image/png;base64,${o.logoPng.toString('base64')}` } : {};
    if (o.execute) await settings.insertOne({ tenant: TENANT, ...identite, ...logo, createdAt: maintenant, updatedAt: maintenant });
  }

  // 2. Patron — e-mail unique par tenant (index composite du schéma User).
  const users = db.collection('users');
  const email = o.patron.email.toLowerCase().trim();
  if (!(await users.findOne({ tenant: TENANT, email }))) {
    rapport.patron = 'cree';
    if (o.execute) {
      await users.insertOne({
        tenant: TENANT, name: o.patron.nom.trim(), email,
        password: await bcrypt.hash(o.patron.motDePasse, 10),
        role: 'patron', phone: '', caisseId: null,
        createdAt: maintenant, updatedAt: maintenant,
      });
    }
  }

  // 3. Caisses — PIN dérivé (PBKDF2), jamais en clair.
  const caisses = db.collection('caisses');
  for (const c of o.caisses) {
    const code = c.code.toUpperCase().trim();
    if (await caisses.findOne({ tenant: TENANT, code })) { rapport.caisses.existantes++; continue; }
    rapport.caisses.creees++;
    if (o.execute) {
      const pinSalt = nouveauSelPin();
      await caisses.insertOne({
        tenant: TENANT, nom: c.nom.trim(), code,
        pinKdf: deriverPin(c.pin, pinSalt), pinSalt,
        ville: c.ville?.trim() || String(identite.ville ?? 'Douala'),
        createdAt: maintenant, updatedAt: maintenant,
      });
    }
  }

  // 4. Taxonomie — une ligne racine (sous-catégorie vide) + une ligne par
  //    sous-catégorie, comme le fait CategoriesService.add().
  const categories = db.collection('categories');
  const arbre = o.categories ?? (o.identite === 'hervan' ? CATEGORIES_HERVAN : {});
  const lignes = Object.entries(arbre).flatMap(([category, subs]) =>
    [{ category, subCategory: '' }, ...subs.map(subCategory => ({ category, subCategory }))]);
  for (const l of lignes) {
    if (await categories.findOne({ tenant: TENANT, category: l.category, subCategory: l.subCategory })) {
      rapport.categories.existantes++; continue;
    }
    rapport.categories.creees++;
    if (o.execute) await categories.insertOne({ tenant: TENANT, ...l, createdAt: maintenant, updatedAt: maintenant });
  }

  return rapport;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function arg(nom: string): string | undefined {
  const prefixe = `--${nom}=`;
  return process.argv.find(a => a.startsWith(prefixe))?.slice(prefixe.length);
}

/** « C01:Caisse 01:1234,C02:Caisse 02:5678 » → CaisseInit[] */
export function parserCaisses(texte: string): CaisseInit[] {
  return texte.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [code, nom, pin, ville] = s.split(':').map(x => x.trim());
    if (!code || !nom || !pin) throw new Error(`Caisse mal formée : « ${s} » — attendu CODE:Nom:PIN[:Ville]`);
    return { code, nom, pin, ville };
  });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');
  const execute = process.argv.includes('--execute');
  // --logo=<chemin.png> : embarqué dans Settings.logoUrl (data URL, ≤ 300 Ko).
  const cheminLogo = arg('logo');
  let logoPng: Buffer | undefined;
  if (cheminLogo) {
    logoPng = require('node:fs').readFileSync(cheminLogo) as Buffer;
    if (logoPng.length > 300 * 1024) throw new Error(`Logo trop lourd (${Math.round(logoPng.length / 1024)} Ko) : 300 Ko maximum en data URL.`);
  }
  const options: OptionsInit = {
    identite: arg('identite') ?? 'hervan',
    patron: { nom: arg('patron-nom') ?? '', email: arg('patron-email') ?? '', motDePasse: arg('patron-mdp') ?? '' },
    caisses: parserCaisses(arg('caisses') ?? ''),
    logoPng,
    execute,
  };

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(arg('base') || undefined);

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  INITIALISATION BOUTIQUE — ${execute ? 'EXÉCUTION RÉELLE' : 'DRY-RUN (aucune écriture)'}`);
  console.log(`  Base : ${db.databaseName} · Identité : ${options.identite}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  const r = await initialiserBoutique(db, options);
  await client.close();

  const etat = (s: string) => (s === 'cree' ? (execute ? 'créé' : 'à créer') : 'déjà présent');
  console.log(`  settings    : ${etat(r.settings)}`);
  console.log(`  patron      : ${etat(r.patron)} (${options.patron.email})`);
  console.log(`  caisses     : ${r.caisses.creees} ${execute ? 'créée(s)' : 'à créer'}, ${r.caisses.existantes} déjà présente(s)`);
  console.log(`  catégories  : ${r.categories.creees} ${execute ? 'créée(s)' : 'à créer'}, ${r.categories.existantes} déjà présente(s)`);
  console.log(execute ? '\n  ✓ Boutique initialisée. Connectez-vous avec le compte patron et complétez Paramètres (logo, téléphones, mentions).'
                      : '\n  DRY-RUN terminé. Relancez avec --execute pour appliquer.');
}

if (require.main === module) {
  main().catch(err => { console.error('\nÉCHEC :', err.message ?? err); process.exit(1); });
}
