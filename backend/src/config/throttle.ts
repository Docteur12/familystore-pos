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
 * Connexion — 30 tentatives par minute.
 *
 * Volontairement plus large que les 5/minute d'une limite anti-force-brute
 * classique : il n'a pas été possible de vérifier avec certitude, depuis une
 * seule connexion, que le compteur suit bien l'IP de chaque poste et non
 * celle du proxy Netlify. Si elle était partagée, une limite à 5 bloquerait
 * l'équipe à l'ouverture de la boutique, quand tout le monde se connecte en
 * même temps.
 *
 * 30 essais/minute reste une protection réelle — une attaque par
 * dictionnaire en exige des milliers — tout en laissant passer les sept
 * employés du matin, même dans le pire cas.
 *
 * À resserrer vers 5 une fois confirmé que chaque poste a bien son propre
 * compteur (deux connexions internet distinctes suffisent à le vérifier).
 */
export const ThrottleLogin = () => Throttle({ default: { limit: 30, ttl: MINUTE } });

/**
 * Mot de passe oublié — 3 tentatives par quart d'heure.
 * Chaque appel réussi remplace le mot de passe du compte visé : la limite
 * empêche de harceler un utilisateur en le déconnectant en boucle.
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
