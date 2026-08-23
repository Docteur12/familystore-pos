/**
 * Réglages de l'environnement de démonstration — UNE seule source.
 *
 * Le port a d'abord vécu à trois endroits (la base, le seed, le backend). Il
 * a suffi d'en changer un pour que le seed cherche une base sur 27017 pendant
 * qu'elle écoutait sur 27018 : « ECONNREFUSED », sans rien qui indique
 * laquelle des deux valeurs est la bonne. Un réglage recopié finit toujours
 * par diverger — il n'est donc plus écrit qu'ici.
 */

/** 27018, délibérément pas 27017 : une vraie base MongoDB locale garde sa place. */
const PORT_MONGO = 27018;

/** 3004 : le port que le proxy du serveur de développement Vite relaie. */
const PORT_API = 3004;

const NOM_BASE = 'cameleon_demo';

const URI = process.env.DEMO_MONGO_URI ?? `mongodb://127.0.0.1:${PORT_MONGO}/${NOM_BASE}`;

module.exports = { PORT_MONGO, PORT_API, NOM_BASE, URI };
