/**
 * Création du PREMIER superadmin d'une base Caméléon.
 *
 *   Dry-run (défaut) :
 *     npm run creer:superadmin -- --base=cameleon --email=valdes@... --nom="Valdes" --mdp=...
 *   Exécution réelle : ajouter --execute
 *
 * Pourquoi un script : `seed-demo` fabrique un superadmin de démonstration,
 * rien ne le fait pour une base neuve — et sans superadmin, personne ne peut
 * ouvrir une boutique ni activer une licence en mode manuel (LOT-E.md).
 *
 * Où vit ce compte : le superadmin n'appartient à aucune boutique, mais le
 * schéma User est cloisonné par tenant. Il est donc estampillé d'un tenant
 * TECHNIQUE (DEFAULT_TENANT_ID) qui n'est la boutique de personne — les
 * boutiques Caméléon reçoivent chacune un ObjectId neuf à leur création. La
 * connexion cherche l'e-mail dans tous les magasins (skipTenant au login),
 * puis c'est le RÔLE qui traverse.
 *
 * Garde-fous : refuse les bases des clients en mode single (familystore,
 * radiance), idempotent (relancer ne crée aucun doublon), mot de passe fort
 * exigé — ce compte ouvre TOUTES les boutiques de la plateforme.
 */
import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_TENANT_ID } from '../src/tenancy/tenant-context';
import { BASES_PROTEGEES } from './init-boutique';

export interface OptionsSuperadmin {
  nom: string;
  email: string;
  motDePasse: string;
  execute: boolean;
}

export interface RapportSuperadmin {
  base: string;
  superadmin: 'cree' | 'existant';
  email: string;
}

/** Longueur minimale du mot de passe : c'est la clé maîtresse de la plateforme. */
export const LONGUEUR_MIN_MDP = 12;

export function validerOptions(o: OptionsSuperadmin): void {
  if (!o.nom.trim()) throw new Error('Nom manquant.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) throw new Error(`E-mail invalide : « ${o.email} »`);
  if (o.motDePasse.length < LONGUEUR_MIN_MDP) {
    throw new Error(`Mot de passe : ${LONGUEUR_MIN_MDP} caractères minimum — ce compte ouvre toutes les boutiques.`);
  }
  if (!/[a-z]/.test(o.motDePasse) || !/[A-Z]/.test(o.motDePasse) || !/\d/.test(o.motDePasse)) {
    throw new Error('Mot de passe : au moins une minuscule, une majuscule et un chiffre.');
  }
}

/**
 * Fait le travail sur une base ouverte. Exportée pour être testée sur une
 * base en mémoire — le CLI ne fait qu'ouvrir la connexion et afficher.
 */
export async function creerSuperadmin(db: Db, o: OptionsSuperadmin): Promise<RapportSuperadmin> {
  validerOptions(o);
  if (BASES_PROTEGEES.includes(db.databaseName.toLowerCase())) {
    throw new Error(`Refus : « ${db.databaseName} » est la base d'un client en mode single, pas la base Caméléon.`);
  }
  const email = o.email.toLowerCase().trim();
  const users = db.collection('users');

  // Idempotent : un superadmin déjà là (quel que soit son tenant) n'est ni
  // recréé, ni modifié — changer son mot de passe se fait dans l'application.
  const existant = await users.findOne({ email, role: 'superadmin' });
  if (existant) return { base: db.databaseName, superadmin: 'existant', email };

  if (o.execute) {
    const maintenant = new Date();
    await users.insertOne({
      tenant: DEFAULT_TENANT_ID, name: o.nom.trim(), email,
      password: await bcrypt.hash(o.motDePasse, 10),
      role: 'superadmin', phone: '', caisseId: null,
      createdAt: maintenant, updatedAt: maintenant,
    });
  }
  return { base: db.databaseName, superadmin: 'cree', email };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function arg(nom: string): string | undefined {
  const prefixe = `--${nom}=`;
  return process.argv.find(a => a.startsWith(prefixe))?.slice(prefixe.length);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI manquante.');
  const execute = process.argv.includes('--execute');
  const options: OptionsSuperadmin = {
    nom: arg('nom') ?? '', email: arg('email') ?? '', motDePasse: arg('mdp') ?? '', execute,
  };

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(arg('base') || undefined);

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  SUPERADMIN CAMÉLÉON — ${execute ? 'EXÉCUTION RÉELLE' : 'DRY-RUN (aucune écriture)'}`);
  console.log(`  Base : ${db.databaseName}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  const r = await creerSuperadmin(db, options);
  await client.close();

  console.log(`  superadmin  : ${r.superadmin === 'cree' ? (execute ? 'créé' : 'à créer') : 'déjà présent'} (${r.email})`);
  console.log(execute
    ? '\n  ✓ Connectez-vous avec cet e-mail : l’accueil mène à « Boutiques & licences ».'
    : '\n  DRY-RUN terminé. Relancez avec --execute pour appliquer.');
}

if (require.main === module) {
  main().catch(err => { console.error('\nÉCHEC :', err.message ?? err); process.exit(1); });
}
