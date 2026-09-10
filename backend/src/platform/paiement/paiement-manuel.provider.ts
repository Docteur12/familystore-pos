import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DemandePaiement, EtatDistant, PaiementCree, PaymentProvider, SignalWebhook,
} from './payment-provider';
import { consigneRenouvellement } from '../contact-licence';

/** Message renvoyé à qui tente d'ouvrir un paiement en ligne en mode manuel. */
export function messagePaiementEnLigneIndisponible(env: NodeJS.ProcessEnv = process.env): string {
  return `Le paiement en ligne n'est pas proposé. ${consigneRenouvellement(env)}`;
}

export class PaiementEnLigneIndisponibleError extends BadRequestException {
  constructor() {
    super(messagePaiementEnLigneIndisponible());
  }
}

/**
 * Prestataire « manuel » — il n'encaisse RIEN et ne confirme RIEN.
 *
 * C'est le mode de fonctionnement de Caméléon : le commerçant règle le
 * revendeur (Mobile Money, espèces, virement), et le revendeur, superadmin,
 * enregistre le règlement et prolonge la licence depuis le back-office
 * (`POST /platform/boutiques/:id/prolonger`). Le document `Paiement` est
 * alors créé DÉJÀ confirmé, source « manuel », par `PaiementService`.
 *
 * Ce prestataire n'est donc jamais censé être appelé. S'il l'est :
 *  - `creer` REFUSE, avec le contact à appeler — jamais de transaction
 *    fantôme qu'une réconciliation interrogerait ensuite pour rien ;
 *  - `interroger` répond « en attente » : il ne sait rien, donc il ne décide
 *    rien — surtout pas un échec, qui est terminal ;
 *  - `extraireReference` ne lit aucun webhook : il n'en existe pas.
 */
@Injectable()
export class PaiementManuelProvider implements PaymentProvider {
  readonly nom = 'manuel';

  async creer(_demande: DemandePaiement): Promise<PaiementCree> {
    throw new PaiementEnLigneIndisponibleError();
  }

  async interroger(_reference: string): Promise<EtatDistant> {
    return { statut: 'en_attente' };
  }

  extraireReference(): SignalWebhook | null {
    return null;
  }
}
