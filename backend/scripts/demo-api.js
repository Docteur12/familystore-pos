/**
 * Démarre le backend SUR LA BASE DE DÉMONSTRATION.
 *
 * Existe pour une raison précise : la `.env` locale vise une base de test, et
 * sous PowerShell on ne peut pas préfixer une commande par des variables
 * d'environnement comme sous un shell POSIX. Poser MONGO_URI à la main avant
 * chaque lancement est le genre de geste qu'on finit par oublier — et
 * l'oublier, ici, c'est démarrer la démonstration sur la mauvaise base.
 *
 * Fixe donc explicitement :
 *   MONGO_URI            la base de démonstration (port 27018)
 *   TENANT_MODE=multi    sans quoi il n'y a pas de multi-boutique à montrer
 *   PAIEMENT_FOURNISSEUR=simule   pour essayer le bouton « + » sans payer
 *
 * Usage :  npm run demo:api
 */
const { spawn } = require('child_process');
const path = require('path');

const { URI, PORT_API } = require('./demo-config');

if (/\/(familystore|radiance)/i.test(URI)) {
  console.error(`\nRefusé : « ${URI} » vise une base client. La démonstration a la sienne.\n`);
  process.exit(1);
}

const env = {
  ...process.env,
  MONGO_URI: URI,
  TENANT_MODE: 'multi',
  PAIEMENT_FOURNISSEUR: 'simule',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  JWT_SECRET: process.env.JWT_SECRET ?? 'secret-de-demonstration',
  // Port relayé par le serveur de développement Vite — voir demo-config.js.
  PORT: process.env.PORT ?? String(PORT_API),
};

console.log('\n=== Backend Caméléon — mode démonstration ===');
console.log(`Base       : ${URI}`);
console.log(`Paiements  : simulé (aucun encaissement réel)`);
console.log(`API        : http://localhost:${env.PORT}/api\n`);

const nest = path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'nest.cmd' : 'nest');
const enfant = spawn(nest, ['start', '--watch'], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

enfant.on('exit', code => process.exit(code ?? 0));
