import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  DemandePaiement, EtatDistant, PaiementCree, PaymentProvider, SignalWebhook,
} from './payment-provider';
import { StatutPaiement } from './machine-etats';
import { normaliserTelephone, FORMAT_TELEPHONE_ATTENDU } from './telephone';

/**
 * MyCoolPay — encaissement Mobile Money (MTN MoMo, Orange Money) et carte.
 *
 * Tout ce fichier suit le retour d'expérience de Tontina Market, EN
 * PRODUCTION au Cameroun, et s'écarte volontairement de la documentation
 * officielle là où celle-ci s'est révélée fausse. Chaque écart est daté et
 * justifié sur place : ce sont des constats, pas des préférences.
 *
 * Particularité de l'API : **aucun en-tête d'authentification**. La clé
 * publique est un segment de l'URL. La clé privée ne sert qu'à la signature
 * des webhooks — laquelle ne se vérifie pas (voir `extraireReference`).
 */
@Injectable()
export class MyCoolPayProvider implements PaymentProvider {
  readonly nom = 'mycoolpay';

  private readonly logger = new Logger(MyCoolPayProvider.name);

  private static readonly BASE = 'https://my-coolpay.com/api';

  /**
   * Statuts de paiement — CHAÎNES EXACTES, comparées à l'identique.
   *
   * `SUCCESS` est ce que le webhook envoie réellement (constaté le
   * 29/07/2026 sur un paiement MTN de 1 000 F) ; `SUCCESSFUL` apparaît dans
   * la documentation et certains SDK. N'en accepter qu'une seule revient à
   * traiter tout paiement réussi comme un échec : argent prélevé, service
   * jamais rendu. On accepte les deux, et de même pour l'échec.
   */
  private static readonly REUSSIS = new Set(['SUCCESS', 'SUCCESSFUL']);
  private static readonly ECHOUES = new Set(['FAILED', 'FAILURE']);

  /** Délai d'un appel sortant. Au-delà, on ne conclut pas — on ne suppose rien. */
  private static readonly DELAI_MS = 15_000;

  private get clePublique(): string {
    const cle = process.env.COOLPAY_PUBLIC_KEY;
    if (!cle) throw new Error('COOLPAY_PUBLIC_KEY manquante');
    return cle;
  }

  // ── Création ────────────────────────────────────────────────────────────

  /**
   * Ouvre un paiement par PAGE HÉBERGÉE (`paylink`).
   *
   * Le mode `payin` (sans redirection) existe mais reste écarté : le
   * 01/08/2026, le code USSD renvoyé pour MTN était `*126#`, c'est-à-dire le
   * menu MoMo générique et non un raccourci vers la transaction. Le client
   * n'avait rien à valider et la transaction expirait en échec. La page
   * hébergée, elle, encaisse.
   */
  async creer(demande: DemandePaiement): Promise<PaiementCree> {
    const telephone = MyCoolPayProvider.normaliserTelephone(demande.client.telephone);
    if (!telephone) {
      // Message actionnable : un numéro absent ou mal formé produirait chez
      // MyCoolPay un « solde insuffisant » incompréhensible pour le client.
      throw new Error(FORMAT_TELEPHONE_ATTENDU);
    }

    const corps = {
      transaction_amount: Math.round(demande.montant),   // entier XAF, pas de centimes
      transaction_currency: demande.devise,
      transaction_reason: demande.description,
      app_transaction_ref: demande.reference,
      customer_phone_number: telephone,
      customer_name: demande.client.nom ?? demande.client.email,
      customer_email: demande.client.email,
      customer_lang: 'fr',
    };

    const reponse = await this.appeler('POST', `${MyCoolPayProvider.BASE}/${this.clePublique}/paylink`, corps);

    // `status` de l'ENVELOPPE : « la requête API a abouti ». À ne pas
    // confondre avec `transaction_status`, qui dit si le paiement a réussi.
    if (reponse?.status !== 'success' || !reponse?.payment_url || !reponse?.transaction_ref) {
      throw new Error(`Ouverture du paiement refusée par MyCoolPay (${reponse?.status ?? 'réponse illisible'})`);
    }

    return {
      referenceFournisseur: String(reponse.transaction_ref),
      urlPaiement: String(reponse.payment_url),
    };
  }

  // ── Interrogation : LA SEULE AUTORITÉ ───────────────────────────────────

  /**
   * `checkStatus`, serveur à serveur.
   *
   * Deux garde-fous :
   *
   *  - **on ne conclut jamais dans le doute.** Réseau, enveloppe non
   *    `success`, statut hors des listes connues : on renvoie `en_attente`.
   *    Un `echoue` est terminal chez nous ; l'inscrire à tort condamnerait un
   *    paiement réussi ;
   *  - **on vérifie que la transaction porte NOTRE référence applicative.**
   *    Sans ce contrôle, une transaction réelle appartenant à quelqu'un
   *    d'autre pourrait être rejouée pour faire confirmer notre paiement.
   */
  async interroger(reference: string, referenceFournisseur?: string | null): Promise<EtatDistant> {
    if (!referenceFournisseur) {
      // L'appel de création n'a pas abouti, ou sa réponse s'est perdue :
      // `checkStatus` s'interroge par la référence MyCoolPay, que nous
      // n'avons pas. Rien à conclure.
      return { statut: 'en_attente' };
    }

    let reponse: any;
    try {
      reponse = await this.appeler(
        'GET', `${MyCoolPayProvider.BASE}/${this.clePublique}/checkStatus/${encodeURIComponent(referenceFournisseur)}`,
      );
    } catch (e: any) {
      this.logger.warn(`[MyCoolPay] checkStatus ${referenceFournisseur} injoignable : ${e?.message ?? e}`);
      return { statut: 'en_attente' };
    }

    if (reponse?.status !== 'success') {
      // Référence inconnue de MyCoolPay. On ne déclare pas d'échec pour
      // autant : une transaction tout juste créée peut ne pas encore y être.
      this.logger.warn(`[MyCoolPay] transaction ${referenceFournisseur} inconnue de l'API`);
      return { statut: 'en_attente', brut: reponse };
    }

    const refApp = reponse?.app_transaction_ref;
    if (refApp && String(refApp) !== reference) {
      this.logger.error(
        `[MyCoolPay] référence applicative incohérente : l'API rattache ${referenceFournisseur} ` +
        `à « ${refApp} », attendu « ${reference} » — rien n'est conclu`,
      );
      return { statut: 'en_attente', brut: reponse };
    }

    return {
      statut: MyCoolPayProvider.versStatut(reponse?.transaction_status),
      referenceFournisseur: reponse?.transaction_ref ? String(reponse.transaction_ref) : undefined,
      brut: reponse,
    };
  }

  /** Traduction d'un `transaction_status`. Tout inconnu reste « en attente ». */
  static versStatut(brut: unknown): StatutPaiement {
    const valeur = typeof brut === 'string' ? brut : '';
    if (MyCoolPayProvider.REUSSIS.has(valeur)) return 'confirme';
    if (MyCoolPayProvider.ECHOUES.has(valeur)) return 'echoue';
    return 'en_attente';
  }

  // ── Webhook ─────────────────────────────────────────────────────────────

  /**
   * Extrait les références du webhook — et rien d'autre.
   *
   * ═══ LA SIGNATURE N'EST PAS VÉRIFIABLE ═══
   * Elle n'est pas dans un en-tête HTTP mais dans le champ `signature` du
   * corps, et vaut en théorie
   * `md5(transaction_ref + transaction_type + transaction_amount +
   *      transaction_currency + operator + COOLPAY_PRIVATE_KEY)`.
   *
   * En pratique, le 28/07/2026, sur une transaction réelle et signée, aucune
   * des 794 200 combinaisons de champs et d'algorithmes essayées n'a
   * reproduit la signature reçue. **Bloquer dessus aurait rejeté 100 % des
   * paiements légitimes.** Aucune vérification autoritaire par signature
   * n'est donc implémentée — en écrire une qui « passe » reviendrait à
   * valider n'importe quoi.
   *
   * L'autorité est `interroger()`. Ce que le webhook raconte — statut,
   * montant, opérateur — n'est jamais cru.
   */
  extraireReference(
    _entetes: Record<string, string | string[] | undefined>,
    corpsBrut: Buffer,
  ): SignalWebhook | null {
    let corps: any;
    try {
      corps = JSON.parse(corpsBrut.toString('utf8'));
    } catch {
      return null;   // corps illisible : l'appelant répondra 500 pour rejeu
    }

    const reference = typeof corps?.app_transaction_ref === 'string' ? corps.app_transaction_ref : undefined;
    const referenceFournisseur = typeof corps?.transaction_ref === 'string' ? corps.transaction_ref : undefined;
    if (!reference && !referenceFournisseur) return null;

    // Diagnostic seulement. Le jour où MyCoolPay corrigera sa signature, cet
    // avertissement cessera d'apparaître — et il n'aura jamais rien bloqué.
    this.signalerSignatureDiscordante(corps);

    return { reference, referenceFournisseur, brut: corps };
  }

  /** Journalise si la signature ne concorde pas. Ne bloque rien, par conception. */
  private signalerSignatureDiscordante(corps: any): void {
    const privee = process.env.COOLPAY_PRIVATE_KEY;
    if (!privee || !corps?.signature) return;
    // Le SDK officiel envoie `transaction_operator` ; `operator` est un repli
    // défensif au cas où le champ changerait.
    const operateur = corps.transaction_operator ?? corps.operator ?? '';
    const attendue = crypto.createHash('md5').update(
      String(corps.transaction_ref ?? '') +
      String(corps.transaction_type ?? '') +
      String(corps.transaction_amount ?? '') +
      String(corps.transaction_currency ?? '') +
      String(operateur) +
      privee,
    ).digest('hex');
    if (attendue !== corps.signature) {
      this.logger.warn(
        '[MyCoolPay] signature non concordante — sans effet : ' +
        'la vérification fait foi via checkStatus',
      );
    }
  }

  // ── Utilitaires ─────────────────────────────────────────────────────────

  /** Règle partagée — voir `telephone.ts`, miroir du contrôle côté client. */
  static normaliserTelephone(brut?: string): string | null {
    return normaliserTelephone(brut);
  }

  /**
   * Appel HTTP.
   *
   * Le corps d'erreur n'est JAMAIS remonté tel quel : il contient la réponse
   * brute de MyCoolPay (par exemple `{"status":"error",...}` sur un 409), qui
   * n'a aucun sens pour un commerçant et divulgue le détail de l'intégration.
   * On journalise le détail, on lève un message générique.
   */
  private async appeler(methode: 'GET' | 'POST', url: string, corps?: unknown): Promise<any> {
    const arret = new AbortController();
    const minuterie = setTimeout(() => arret.abort(), MyCoolPayProvider.DELAI_MS);
    try {
      const res = await fetch(url, {
        method: methode,
        headers: corps ? { 'Content-Type': 'application/json' } : undefined,
        body: corps ? JSON.stringify(corps) : undefined,
        signal: arret.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.error(`[MyCoolPay] ${methode} ${url} → ${res.status} ${detail}`);
        throw new Error(`MyCoolPay a refusé la demande (${res.status})`);
      }
      return await res.json();
    } finally {
      clearTimeout(minuterie);
    }
  }
}
