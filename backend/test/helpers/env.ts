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

/**
 * Prestataire de paiement simulé.
 *
 * MyCoolPay n'a pas d'environnement d'essai : aucun test ne peut l'appeler.
 * Le mode simulé est refusé en production (`choisirPrestataire`), et
 * `NODE_ENV=test` suffit à écarter ce refus ici.
 *
 * Sans cette ligne, le démarrage de l'application échouerait sous test — ce
 * qui est le comportement VOULU : viser MyCoolPay sans l'avoir branché doit
 * lever, jamais se replier en silence sur un prestataire qui n'encaisse rien.
 */
process.env.PAIEMENT_FOURNISSEUR ??= 'simule';

export {};
