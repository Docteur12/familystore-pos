/**
 * Base MongoDB locale pour la démonstration — sans rien installer.
 *
 * Réutilise le `mongod` déjà téléchargé par `mongodb-memory-server` pour les
 * tests. La différence avec un usage de test : les données sont écrites dans
 * un DOSSIER (`backend/.demo-db`), pas en mémoire volatile. Elles survivent
 * donc à l'arrêt de ce processus, et l'on retrouve sa démonstration le
 * lendemain sans tout resemer.
 *
 * Écoute sur le port 27018 — délibérément pas 27017 : si vous avez déjà une
 * vraie base MongoDB sur votre poste, la démonstration ne doit pas venir s'y
 * mêler ni disputer le port.
 *
 * Laisser cette fenêtre ouverte pendant toute la démonstration. Ctrl+C arrête
 * la base ; les données restent sur le disque.
 *
 * Usage :  npm run demo:mongo
 */
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { PORT_MONGO: PORT } = require('./demo-config');
const DOSSIER = path.resolve(__dirname, '..', '.demo-db');

async function main() {
  fs.mkdirSync(DOSSIER, { recursive: true });

  const serveur = await MongoMemoryServer.create({
    instance: {
      port: PORT,
      dbPath: DOSSIER,
      // Sans cette ligne, le dossier serait effacé à l'arrêt : la
      // démonstration repartirait de zéro à chaque redémarrage.
      storageEngine: 'wiredTiger',
    },
  });

  console.log('\n=== Base de démonstration Caméléon ===');
  console.log(`URI     : ${serveur.getUri()}`);
  console.log(`Données : ${DOSSIER}`);
  console.log('\nLaissez cette fenêtre OUVERTE. Ctrl+C pour arrêter.\n');

  const arreter = async () => {
    console.log('\nArrêt de la base. Les données restent sur le disque.');
    await serveur.stop({ doCleanup: false, force: false });
    process.exit(0);
  };
  process.on('SIGINT', arreter);
  process.on('SIGTERM', arreter);
}

main().catch(err => {
  console.error('\nÉCHEC du démarrage de la base :', err.message ?? err);
  console.error('Au premier lancement, le binaire mongod (~600 Mo) peut devoir être téléchargé.');
  process.exit(1);
});
