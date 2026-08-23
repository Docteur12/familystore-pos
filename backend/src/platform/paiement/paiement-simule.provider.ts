import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  DemandePaiement, EtatDistant, SignalWebhook, PaiementCree, PaymentProvider,
} from './payment-provider';
import { StatutPaiement } from './machine-etats';

/**
 * Prestataire simulé — occupe le contrat en attendant MyCoolPay.
 *
 * Il n'est pas un bouchon vide : il calcule et vérifie une vraie signature
 * HMAC-SHA256, de sorte que le chemin du webhook — y compris son REJET quand
 * la signature est fausse — est éprouvé pour de bon. Le jour où MyCoolPay
 * arrive, c'est l'algorithme qui change, pas la mécanique autour.
 *
 * En développement, il permet aussi de dérouler un parcours complet sans
 * compte marchand : `programmer(reference, 'confirme')` fait répondre
 * l'interrogation comme le ferait l'opérateur.
 */
@Injectable()
export class PaiementSimuleProvider implements PaymentProvider {
  readonly nom = 'simule';

  private readonly logger = new Logger(PaiementSimuleProvider.name);

  /** États programmés, par référence. Absent = `en_attente`. */
  private readonly etats = new Map<string, StatutPaiement>();

  private get secret(): string {
    return process.env.PAIEMENT_SIMULE_SECRET ?? 'secret-de-test';
  }

  async creer(demande: DemandePaiement): Promise<PaiementCree> {
    // Référence distante déterministe : rejouer la même demande ne fabrique
    // pas deux transactions, exactement comme le doit un vrai prestataire
    // recevant deux fois la même clé d'idempotence.
    const referenceFournisseur = 'SIM-' + crypto
      .createHash('sha256').update(demande.reference).digest('hex').slice(0, 16).toUpperCase();
    this.logger.log(`[Paiement simulé] ${demande.reference} → ${referenceFournisseur} (${demande.montant} ${demande.devise})`);
    return { referenceFournisseur, urlPaiement: `https://paiement.simule.local/${referenceFournisseur}` };
  }

  async interroger(reference: string): Promise<EtatDistant> {
    return { statut: this.etats.get(reference) ?? 'en_attente' };
  }

  /**
   * Extrait la référence, et RIEN d'autre.
   *
   * Le statut éventuellement présent dans le corps est délibérément ignoré :
   * le simulé se comporte comme MyCoolPay, dont les webhooks ne sont pas
   * authentifiables et dont on ne croit donc aucune affirmation. C'est ce qui
   * permet aux tests de prouver qu'un webhook forgé ne crédite rien.
   */
  extraireReference(
    _entetes: Record<string, string | string[] | undefined>,
    corpsBrut: Buffer,
  ): SignalWebhook | null {
    try {
      const corps = JSON.parse(corpsBrut.toString('utf8'));
      const reference = corps?.reference ?? corps?.app_transaction_ref;
      if (!reference) return null;
      return { reference: String(reference), brut: corps };
    } catch {
      return null;   // corps illisible : l'appelant répondra 500 pour rejeu
    }
  }

  /** Programme la réponse de l'interrogation — développement et tests. */
  programmer(reference: string, statut: StatutPaiement): void {
    this.etats.set(reference, statut);
  }

  /** Remet le prestataire à zéro entre deux scénarios. */
  oublier(): void {
    this.etats.clear();
  }
}
