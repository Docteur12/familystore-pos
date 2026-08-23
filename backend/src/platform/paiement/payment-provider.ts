import { StatutPaiement } from './machine-etats';

/**
 * Contrat d'un prestataire de paiement.
 *
 * Volontairement écrit AVANT de brancher MyCoolPay, et sans rien lui
 * emprunter. Deux raisons :
 *
 *  - tout le reste — schéma, machine à états, réconciliation, interface —
 *    se développe et se teste sans dépendre d'un compte marchand ni d'une
 *    documentation qu'on n'a pas encore ;
 *  - le jour où l'on change d'opérateur, ou qu'on en ajoute un second pour
 *    une autre monnaie, seul le fichier qui implémente ce contrat bouge.
 *
 * L'implémentation MyCoolPay viendra s'y conformer ; `PaiementSimuleProvider`
 * l'occupe en attendant et sert aux tests.
 */

/** Demande envoyée au prestataire. */
export interface DemandePaiement {
  /** NOTRE clé d'idempotence. Doit voyager jusqu'au prestataire et revenir. */
  reference: string;
  montant: number;
  devise: string;
  description: string;
  client: { nom?: string; email: string; telephone?: string };
}

/** Ce que le prestataire renvoie à la création. */
export interface PaiementCree {
  /** Identifiant de la transaction chez lui. */
  referenceFournisseur: string;
  /** Page de paiement à ouvrir, si l'opérateur en fournit une. */
  urlPaiement?: string;
}

/** Réponse à une interrogation d'état. */
export interface EtatDistant {
  statut: StatutPaiement;
  referenceFournisseur?: string;
  /** Réponse brute, journalisée telle quelle en cas de litige. */
  brut?: unknown;
}

/**
 * Ce qu'on retire d'un webhook : une référence, et rien d'autre.
 *
 * Surtout PAS le statut annoncé. Voir `extraireReference`.
 */
export interface SignalWebhook {
  /** Notre référence (`app_transaction_ref`), quand elle est lisible. */
  reference?: string;
  /**
   * Référence du prestataire (`transaction_ref`).
   *
   * Sert de second chemin de recherche : si l'appel de création a abouti chez
   * le prestataire mais que sa réponse s'est perdue, nous n'avons pas encore
   * enregistré cette référence — mais le webhook, lui, la porte.
   */
  referenceFournisseur?: string;
  /** Conservé pour le journal uniquement — jamais pour décider. */
  brut?: unknown;
}

export interface PaymentProvider {
  readonly nom: string;

  /** Ouvre une transaction chez le prestataire. */
  creer(demande: DemandePaiement): Promise<PaiementCree>;

  /**
   * Demande l'état réel d'un paiement.
   *
   * C'est la pièce maîtresse, pas une roue de secours : **les webhooks
   * Mobile Money se perdent**. Réseau coupé côté opérateur, service
   * redémarré, notification jamais réémise — le client a payé et rien
   * n'arrive. La réconciliation interroge donc activement, et c'est elle qui
   * fait foi.
   *
   * C'est aussi la SEULE autorité : le webhook ne fait que déclencher cet
   * appel (voir `extraireReference`).
   *
   * Règle impérative pour toute implémentation : en cas de doute — réseau
   * indisponible, réponse illisible, **statut inconnu de la liste** —
   * RENVOYER `en_attente`, jamais `echoue`. `echoue` est terminal :
   * l'inscrire à tort condamnerait un paiement réussi. Les chaînes de statut
   * se comparent à l'identique, sans supposition : `SUCCESS` n'est pas
   * `SUCCESSFUL`.
   */
  interroger(reference: string, referenceFournisseur?: string | null): Promise<EtatDistant>;

  /**
   * Extrait la RÉFÉRENCE d'un webhook — et seulement elle.
   *
   * ═══ LE WEBHOOK N'EST PAS UNE SOURCE DE VÉRITÉ ═══
   *
   * Chez MyCoolPay, la signature du webhook s'est révélée NON VÉRIFIABLE :
   * en production sur Tontina Market, 794 200 combinaisons d'algorithmes, de
   * clés et de sérialisations ont été essayées sans jamais retrouver la
   * signature émise. Aucune vérification autoritaire n'est donc possible, et
   * en écrire une qui « marche » reviendrait à valider n'importe quoi.
   *
   * Conséquence, appliquée sans exception : **le webhook est un signal
   * « va vérifier », jamais une annonce à croire.** Le statut, le montant et
   * la devise qu'il transporte sont ignorés pour décider quoi que ce soit —
   * ils ne servent qu'au journal. Le seul élément retenu est la référence,
   * qui n'est qu'un pointeur : elle désigne le paiement à interroger.
   *
   * L'autorité est `interroger()`, appelé serveur à serveur. Un webhook
   * forgé annonçant un succès ne peut donc rien créditer : il ne fait que
   * déclencher une vérification qui, elle, dira la vérité.
   *
   * Renvoie `null` si aucune référence n'est lisible — l'appelant répondra
   * alors 500 pour provoquer un rejeu, plutôt que d'acquitter à tort.
   */
  extraireReference(
    entetes: Record<string, string | string[] | undefined>,
    corpsBrut: Buffer,
  ): SignalWebhook | null;
}

/** Jeton d'injection — l'implémentation est choisie à l'assemblage du module. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
