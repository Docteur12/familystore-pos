import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Paiement, PaiementDocument } from './paiement.schema';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider';
import { PaiementService } from './paiement.service';
import { aInterroger, estDepasse, SUIVI_APRES_EXPIRATION_HEURES } from './machine-etats';

/**
 * Réconciliation active — on va CHERCHER l'état des paiements.
 *
 * POURQUOI CE SERVICE EXISTE
 * Les webhooks Mobile Money se perdent. Réseau coupé chez l'opérateur,
 * service redémarré au mauvais moment, notification jamais réémise : le
 * client a payé, son téléphone affiche le débit, et rien n'arrive chez nous.
 * S'en remettre au webhook, c'est accepter qu'un client sur cent paie sans
 * rien recevoir — et ce client-là appelle, à juste titre.
 *
 * Le webhook reste utile : il évite d'attendre l'interrogation suivante quand
 * il arrive. Mais c'est ce service qui fait foi.
 *
 * DEUX PRÉCAUTIONS
 *  - **on n'invente jamais un échec.** Réseau indisponible, réponse
 *    illisible : le paiement reste `en_attente`, et sera repris. Seul le
 *    prestataire peut déclarer un échec ;
 *  - **on continue d'interroger après expiration**, pendant
 *    `SUIVI_APRES_EXPIRATION_HEURES`. C'est le filet contre le pire cas :
 *    encaisser sans rendre le service. Une confirmation tardive crée la
 *    boutique le lendemain, sans que personne ait à intervenir.
 */
@Injectable()
export class ReconciliationService implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectModel(Paiement.name) private paiementModel: Model<PaiementDocument>,
    private paiements: PaiementService,
    @Inject(PAYMENT_PROVIDER) private prestataire: PaymentProvider,
  ) {}

  /**
   * Passage toutes les trente secondes.
   *
   * C'est fréquent, mais le balayage ne coûte que si des paiements sont en
   * jeu : l'espacement des interrogations est décidé paiement par paiement
   * (`aInterroger`), serré tant que le client attend devant son écran, puis
   * relâché. Sans passage rapproché, un client resterait bloqué sur
   * « en attente » alors que son paiement est déjà passé.
   */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;   // pas de minuterie sous test
    const passage = () => this.reconcilier().catch(e => this.logger.error(e.message));
    setTimeout(passage, 15_000);
    setInterval(passage, 30_000).unref?.();
  }

  /** Un passage complet. Renvoie le nombre de paiements dont l'état a changé. */
  async reconcilier(maintenant = new Date()): Promise<number> {
    const limite = new Date(maintenant.getTime() - SUIVI_APRES_EXPIRATION_HEURES * 3_600_000);
    const candidats = await this.paiementModel
      .find({ statut: { $in: ['en_attente', 'expire'] }, createdAt: { $gte: limite } })
      .sort({ derniereVerification: 1 })
      .limit(100);

    let changes = 0;
    for (const p of candidats) {
      const creeLe: Date = (p as any).createdAt ?? new Date();
      if (!aInterroger({
        statut: p.statut,
        tentativesReconciliation: p.tentativesReconciliation,
        derniereVerification: p.derniereVerification ?? undefined,
        creeLe,
      }, maintenant)) continue;

      if (await this.verifier(p, creeLe, maintenant)) changes++;
    }
    return changes;
  }

  private async verifier(p: PaiementDocument, creeLe: Date, maintenant: Date): Promise<boolean> {
    // Le compteur est incrémenté AVANT l'appel : un prestataire qui répond
    // toujours en erreur ne doit pas être réinterrogé toutes les cinq
    // secondes indéfiniment.
    await this.paiementModel.updateOne(
      { _id: p._id },
      { $set: { derniereVerification: maintenant }, $inc: { tentativesReconciliation: 1 } },
    );

    let statut;
    try {
      const distant = await this.prestataire.interroger(p.reference, p.referenceFournisseur);
      statut = distant.statut;
      if (distant.referenceFournisseur && !p.referenceFournisseur) {
        await this.paiementModel.updateOne(
          { _id: p._id }, { $set: { referenceFournisseur: distant.referenceFournisseur } },
        );
      }
    } catch (e: any) {
      // Panne d'interrogation : surtout PAS un échec de paiement.
      this.logger.warn(`[Réconciliation] ${p.reference} injoignable : ${e?.message ?? e}`);
      return false;
    }

    if (statut !== 'en_attente') {
      const r = await this.paiements.annoncer(p.reference, statut, 'reconciliation');
      return r.statut !== p.statut;
    }

    // Toujours en attente et délai dépassé : on le marque expiré pour que
    // l'interface cesse de faire patienter. Le suivi continue malgré tout —
    // `expire → confirme` reste permis.
    if (p.statut === 'en_attente' && estDepasse(creeLe, maintenant)) {
      const r = await this.paiements.annoncer(p.reference, 'expire', 'reconciliation', 'délai d’attente dépassé');
      return r.statut === 'expire';
    }
    return false;
  }
}
