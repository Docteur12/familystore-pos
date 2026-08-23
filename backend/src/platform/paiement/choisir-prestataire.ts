import { PaymentProvider } from './payment-provider';

/**
 * Choix du prestataire de paiement, et VERROU sur le mode simulé.
 *
 * MyCoolPay n'offre pas d'environnement d'essai : impossible de dérouler un
 * parcours de bout en bout sans encaisser réellement. Le prestataire simulé
 * tient donc ce rôle en développement et dans les tests.
 *
 * D'où le danger : un mode qui confirme les paiements sans qu'un franc soit
 * versé n'a rien à faire en production. Il suffirait d'une variable
 * d'environnement oubliée sur Render pour que les licences se renouvellent
 * gratuitement, sans que rien ne le signale — les boutiques marcheraient,
 * simplement personne ne paierait.
 *
 * Le verrou ci-dessous fait donc **échouer le démarrage** plutôt que de
 * laisser l'application tourner dans cet état. Une application qui ne démarre
 * pas se voit tout de suite ; un mode simulé actif en production, non.
 */

export type NomPrestataire = 'mycoolpay' | 'simule';

export class ModeSimuleInterditError extends Error {
  constructor() {
    super(
      'PAIEMENT_FOURNISSEUR=simule est INTERDIT en production : les paiements ' +
      'seraient confirmés sans encaissement. Retirez la variable ou mettez-la ' +
      'à « mycoolpay ».',
    );
    this.name = 'ModeSimuleInterditError';
  }
}

/** Prestataire demandé par la configuration. `mycoolpay` par défaut. */
export function nomPrestataireDemande(env: NodeJS.ProcessEnv = process.env): NomPrestataire {
  const brut = (env.PAIEMENT_FOURNISSEUR ?? '').trim().toLowerCase();
  return brut === 'simule' ? 'simule' : 'mycoolpay';
}

/**
 * Est-on en production ?
 *
 * On ne se fie pas au seul `NODE_ENV` : sur Render il est parfois laissé à
 * vide alors que le service sert de vrais clients. La présence d'une URI de
 * base de production est un second signe, volontairement pessimiste — en cas
 * de doute, on considère qu'on est en production, ce qui interdit le mode
 * simulé. Se tromper dans ce sens ne coûte qu'un démarrage refusé.
 */
export function estProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'test') return false;
  if (env.NODE_ENV === 'production') return true;
  if (env.NODE_ENV === 'development') return false;
  return /mongodb(\+srv)?:\/\/[^/]*\/(familystore|radiance)(\?|$)/i.test(env.MONGO_URI ?? '');
}

/**
 * Rend le prestataire à employer, ou lève si la combinaison est interdite.
 *
 * `mycoolpay` peut être absent tant que l'implémentation n'est pas écrite :
 * on lève alors un message explicite plutôt que d'injecter silencieusement le
 * simulé — ce serait exactement le glissement que ce fichier existe pour
 * empêcher.
 */
export function choisirPrestataire(
  disponibles: { mycoolpay?: PaymentProvider; simule: PaymentProvider },
  env: NodeJS.ProcessEnv = process.env,
): PaymentProvider {
  const demande = nomPrestataireDemande(env);

  if (demande === 'simule') {
    if (estProduction(env)) throw new ModeSimuleInterditError();
    return disponibles.simule;
  }

  if (!disponibles.mycoolpay) {
    throw new Error(
      'PAIEMENT_FOURNISSEUR=mycoolpay mais aucune implémentation MyCoolPay n’est ' +
      'enregistrée. Pour développer sans prestataire, poser PAIEMENT_FOURNISSEUR=simule ' +
      '(refusé en production).',
    );
  }
  return disponibles.mycoolpay;
}
