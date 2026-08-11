/**
 * Assise commune des tests : une base MongoDB réelle en mémoire.
 *
 * Chaque fichier de test appelle `ouvrirBaseDeTest()` dans beforeAll et
 * `fermerBaseDeTest()` dans afterAll. Entre deux tests, `viderCollections()`
 * remet la base à zéro sans redémarrer le serveur (rapide).
 *
 * Pourquoi une vraie base et pas des mocks : le chantier multi-tenant va
 * reposer sur des hooks Mongoose (plugin de filtrage par tenant). Des mocks
 * de modèles ne les exécuteraient pas — ces tests doivent traverser la vraie
 * pile Mongoose pour garder leur valeur de filet de sécurité.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let serveur: MongoMemoryServer | null = null;

/** Démarre la base en mémoire et renvoie son URI de connexion. */
export async function ouvrirBaseDeTest(): Promise<string> {
  serveur = await MongoMemoryServer.create();
  return serveur.getUri();
}

/** Arrête la base en mémoire (à appeler après la fermeture du module Nest). */
export async function fermerBaseDeTest(): Promise<void> {
  if (serveur) {
    await serveur.stop();
    serveur = null;
  }
}

/** Vide toutes les collections d'une connexion — état neuf entre deux tests. */
export async function viderCollections(connection: mongoose.Connection): Promise<void> {
  const collections = await connection.db.collections();
  await Promise.all(collections.map(c => c.deleteMany({})));
}
