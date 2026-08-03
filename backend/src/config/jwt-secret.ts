// Source unique du secret JWT.
//
// Aucune valeur par défaut : un secret de repli codé en dur permettrait à
// quiconque connaît le code de forger un jeton « patron » si la variable
// venait à manquer au déploiement. L'application refuse donc de démarrer
// plutôt que de tourner avec un secret devinable.
//
// Appelée au chargement de AuthModule (donc avant bootstrap) : l'erreur
// survient au démarrage, jamais à la première connexion d'un utilisateur.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      'JWT_SECRET est absente ou vide. ' +
        "L'application ne peut pas démarrer sans secret de signature des jetons. " +
        'Définissez JWT_SECRET dans les variables d\'environnement ' +
        '(Render → Environment, ou backend/.env en local). ' +
        'Générer une valeur : openssl rand -hex 32',
    );
  }
  return secret;
}
