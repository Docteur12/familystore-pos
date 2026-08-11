import { Throttle } from '@nestjs/throttler';

// Limites de débit nommées, regroupées ici pour rester cohérentes entre
// contrôleurs. La limite par défaut (100 requêtes/minute) est définie dans
// app.module.ts ; ces décorateurs la surchargent route par route.
//
// À savoir : le compteur du ThrottlerGuard est établi par (IP, route). Une
// limite ne se partage donc pas entre deux routes différentes.

export const MINUTE = 60_000;
export const QUINZE_MINUTES = 15 * MINUTE;

/**
 * Connexion — 5 tentatives par minute PAR COMPTE.
 *
 * Le compteur est indexé sur l'email visé, pas sur l'IP (voir
 * AppThrottlerGuard : l'IP derrière les proxys est forgeable via
 * X-Forwarded-For). Conséquences :
 *  - un attaquant qui tourne les IP reste bloqué à 5 essais sur un compte ;
 *  - les caissiers d'une même boutique ne partagent aucun compteur — pas de
 *    blocage collectif à l'ouverture, chacun a le sien.
 */
export const ThrottleLogin = () => Throttle({ default: { limit: 5, ttl: MINUTE } });

/**
 * Mot de passe oublié — 3 tentatives par quart d'heure PAR COMPTE (même
 * indexation par email que la connexion). Chaque appel réussi remplace le
 * mot de passe du compte visé : la limite empêche de harceler un utilisateur
 * en le déconnectant en boucle, quelle que soit l'IP de l'attaquant.
 */
export const ThrottleMotDePasseOublie = () =>
  Throttle({ default: { limit: 3, ttl: QUINZE_MINUTES } });

/**
 * Routes rejouées par la synchronisation hors-ligne — 300 requêtes/minute.
 *
 * Au retour du réseau, une caisse vide sa file d'un seul tenant : une requête
 * par vente en attente, plus une par facture archivée, plus les produits et
 * réceptions saisis hors connexion. Après une journée sans réseau, cela peut
 * représenter plusieurs centaines d'appels en rafale — la limite doit rester
 * large, sous peine de bloquer un rejeu et de faire perdre des ventes.
 */
export const ThrottleSync = () => Throttle({ default: { limit: 300, ttl: MINUTE } });
