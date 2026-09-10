/**
 * Variante de `env.ts` pour les tests du MODE MANUEL : force
 * PAIEMENT_FOURNISSEUR=manuel AVANT le chargement d'AppModule.
 *
 * `env.ts` pose « simule » par `??=` ; on doit donc écrire la valeur avant
 * de l'importer — et comme les imports sont hissés, ce fichier existe pour
 * garantir l'ordre.
 */
process.env.PAIEMENT_FOURNISSEUR = 'manuel';
process.env.CONTACT_LICENCE = '+237 6 00 00 00 00';
import './env';

export {};
