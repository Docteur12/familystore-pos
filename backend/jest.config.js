/**
 * Configuration Jest — tests du backend.
 *
 * Les tests utilisent une vraie base MongoDB en mémoire
 * (mongodb-memory-server) : aucun risque pour les données de production,
 * aucun serveur à lancer. Au tout premier `npm test`, le binaire mongod
 * (~80 Mo) est téléchargé puis mis en cache — les exécutions suivantes
 * démarrent en quelques secondes.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Démarrage de la base en mémoire + téléchargement éventuel du binaire :
  // large marge pour ne jamais échouer sur un poste lent ou un premier run.
  testTimeout: 60_000,
  // Chaque fichier de test a sa propre base : pas d'état partagé, mais on
  // limite le parallélisme pour ne pas lancer plusieurs mongod d'un coup.
  maxWorkers: 2,
};
