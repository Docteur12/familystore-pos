/**
 * Variables d'environnement des tests — importé EN PREMIER par les fichiers
 * de test e2e.
 *
 * Nécessaire parce que AuthModule lit JWT_SECRET au chargement du module
 * (JwtModule.register({ secret: getJwtSecret() })) : la variable doit exister
 * avant le premier import d'AppModule, sinon le chargement échoue — c'est le
 * comportement voulu en production, qu'on satisfait ici.
 */
process.env.JWT_SECRET ??= 'secret-de-test-uniquement';
process.env.JWT_EXPIRES_IN ??= '1h';

export {};
