import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Paiement, PaiementDocument, ObjetPaiement, EntreeJournal } from './paiement.schema';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider';
import { StatutPaiement, evaluer, estDepasse, estTerminal } from './machine-etats';
import { Proprietaire, ProprietaireDocument } from '../schemas/proprietaire.schema';
import { Boutique, BoutiqueDocument } from '../schemas/boutique.schema';
import { MONTANT_LICENCE_ANNUELLE } from '../schemas/licence.schema';
import { normaliserTelephone, FORMAT_TELEPHONE_ATTENDU } from './telephone';
import { ProvisionnementService } from '../provisionnement.service';

export interface DemandeCreationBoutique {
  nom: string;
  ville?: string;
  patron: { nom: string; email: string; motDePasse: string };
  /**
   * Numéro Mobile Money à débiter.
   *
   * Demandé à chaque paiement plutôt que pris dans la fiche du propriétaire :
   * celui qui règle n'utilise pas forcément le compte MoMo enregistré — un
   * patron peut payer depuis un autre numéro, et le numéro DÉBITÉ doit être
   * celui du payeur, sans quoi l'opérateur renvoie un « solde insuffisant »
   * incompréhensible.
   */
  telephonePayeur?: string;
}

/**
 * Paiements de la plateforme — création de boutique et renouvellement.
 *
 * DEUX PRINCIPES QUI COMMANDENT TOUT LE RESTE
 *
 * 1. **La boutique se crée APRÈS confirmation du paiement, jamais avant.**
 *    Créer d'abord et facturer ensuite paraît plus simple : on aurait un
 *    espace « en attente de paiement » à nettoyer. En pratique ce nettoyage
 *    n'arrive jamais — on hésite à supprimer un magasin où quelqu'un a déjà
 *    saisi des produits — et la plateforme se remplit de boutiques
 *    fantômes qu'il faut distinguer des vraies dans chaque requête. Ici, tant
 *    que le paiement n'est pas confirmé, il n'existe qu'un document
 *    `Paiement` portant ce qu'on créera. Rien à nettoyer.
 *
 * 2. **La réconciliation active fait foi, pas le webhook.** Les webhooks
 *    Mobile Money se perdent. Le webhook n'est qu'un raccourci qui, quand il
 *    arrive, évite d'attendre l'interrogation suivante. Les deux chemins
 *    aboutissent à `annoncer()`, et c'est `annoncer()` qui garantit qu'un
 *    paiement confirmé deux fois ne crée qu'une boutique.
 */
@Injectable()
export class PaiementService {
  private readonly logger = new Logger(PaiementService.name);

  constructor(
    @InjectModel(Paiement.name)     private paiementModel:     Model<PaiementDocument>,
    @InjectModel(Proprietaire.name) private proprietaireModel: Model<ProprietaireDocument>,
    @InjectModel(Boutique.name)     private boutiqueModel:     Model<BoutiqueDocument>,
    private provisionnement: ProvisionnementService,
    @Inject(PAYMENT_PROVIDER) private prestataire: PaymentProvider,
  ) {}

  /** Référence d'idempotence : la nôtre, opaque, non devinable. */
  private nouvelleReference(): string {
    return 'CAM-' + crypto.randomBytes(12).toString('hex').toUpperCase();
  }

  // ── Ouverture d'un paiement ────────────────────────────────────────────

  /**
   * Demande de création de boutique.
   *
   * Le mot de passe est haché ICI, avant tout enregistrement : le paiement
   * peut rester en attente une demi-heure, et rien ne justifie qu'un mot de
   * passe en clair traverse cette attente.
   */
  async demanderCreationBoutique(emailProprietaire: string, demande: DemandeCreationBoutique) {
    if (!demande?.nom?.trim()) throw new BadRequestException('Le nom de la boutique est obligatoire');
    if (!demande?.patron?.email?.trim()) throw new BadRequestException("L'e-mail du patron est obligatoire");
    if (!demande?.patron?.motDePasse || demande.patron.motDePasse.length < 6) {
      throw new BadRequestException('Le mot de passe du patron doit compter au moins 6 caractères');
    }

    const proprietaire = await this.proprietaireModel.findOne({ email: emailProprietaire.toLowerCase() });
    if (!proprietaire) throw new NotFoundException('Propriétaire inconnu');

    const payeur = this.telephonePayeur(demande.telephonePayeur, proprietaire.telephone);

    return this.ouvrir({
      objet: 'creation_boutique',
      proprietaire: proprietaire._id as Types.ObjectId,
      boutique: null,
      demandeBoutique: {
        nom: demande.nom.trim(),
        ville: demande.ville?.trim() || 'Douala',
        patronNom: demande.patron.nom.trim(),
        patronEmail: demande.patron.email.toLowerCase().trim(),
        patronMotDePasseHash: await bcrypt.hash(demande.patron.motDePasse, 10),
      },
      description: `Création de la boutique « ${demande.nom.trim()} »`,
      client: { nom: proprietaire.nom, email: proprietaire.email, telephone: payeur },
    });
  }

  /**
   * Numéro à débiter : celui saisi au moment du paiement, à défaut celui de
   * la fiche. Revalidé ici — le contrôle du navigateur sert le confort de
   * l'utilisateur, pas la sûreté du serveur.
   */
  private telephonePayeur(saisi?: string, parDefaut?: string): string {
    const numero = normaliserTelephone(saisi) ?? normaliserTelephone(parDefaut);
    if (!numero) throw new BadRequestException(FORMAT_TELEPHONE_ATTENDU);
    return numero;
  }

  /** Demande de renouvellement de la licence d'une boutique existante. */
  async demanderRenouvellement(emailProprietaire: string, boutiqueId: string, telephonePayeur?: string) {
    const proprietaire = await this.proprietaireModel.findOne({ email: emailProprietaire.toLowerCase() });
    if (!proprietaire) throw new NotFoundException('Propriétaire inconnu');

    const boutique = await this.boutiqueModel.findById(boutiqueId);
    if (!boutique) throw new NotFoundException('Boutique introuvable');
    // Un propriétaire ne renouvelle que SES boutiques : sans ce contrôle,
    // l'identifiant d'une boutique suffirait à agir sur le compte d'autrui.
    if (String(boutique.proprietaire) !== String(proprietaire._id)) {
      throw new ForbiddenException("Cette boutique n'appartient pas à ce propriétaire");
    }

    return this.ouvrir({
      objet: 'renouvellement_licence',
      proprietaire: proprietaire._id as Types.ObjectId,
      boutique: boutique._id as Types.ObjectId,
      demandeBoutique: null,
      description: `Renouvellement de licence — ${boutique.nom}`,
      client: {
        nom: proprietaire.nom, email: proprietaire.email,
        telephone: this.telephonePayeur(telephonePayeur, proprietaire.telephone),
      },
    });
  }

  private async ouvrir(p: {
    objet: ObjetPaiement;
    proprietaire: Types.ObjectId;
    boutique: Types.ObjectId | null;
    demandeBoutique: any;
    description: string;
    client: { nom?: string; email: string; telephone?: string };
    /** Reprise d'une tentative précédente — voir `reessayer`. */
    chaine?: Types.ObjectId;
    tentative?: number;
    paiementPrecedent?: Types.ObjectId;
  }) {
    const reference = this.nouvelleReference();
    // L'identifiant est décidé ici pour qu'une PREMIÈRE tentative soit sa
    // propre racine de chaîne dès l'écriture, sans seconde mise à jour.
    const _id = new Types.ObjectId();

    // Le document est écrit AVANT l'appel au prestataire : si celui-ci
    // aboutit mais que la réponse se perd, la réconciliation retrouvera le
    // paiement par sa référence. L'inverse — appeler puis enregistrer —
    // laisserait une transaction orpheline, payée et invisible.
    const paiement = await this.paiementModel.create({
      _id,
      reference,
      fournisseur: this.prestataire.nom,
      objet: p.objet,
      proprietaire: p.proprietaire,
      boutique: p.boutique,
      demandeBoutique: p.demandeBoutique,
      telephonePayeur: p.client.telephone ?? '',
      chaine: p.chaine ?? _id,
      tentative: p.tentative ?? 1,
      paiementPrecedent: p.paiementPrecedent ?? null,
      montant: MONTANT_LICENCE_ANNUELLE,
      devise: 'XAF',
      statut: 'en_attente',
      journal: [{ le: new Date(), de: 'en_attente', vers: 'en_attente', source: 'creation', detail: p.description }],
    });

    try {
      const cree = await this.prestataire.creer({
        reference,
        montant: paiement.montant,
        devise: paiement.devise,
        description: p.description,
        client: p.client,
      });
      paiement.referenceFournisseur = cree.referenceFournisseur;
      paiement.urlPaiement = cree.urlPaiement ?? null;
      await paiement.save();
    } catch (e: any) {
      // On ne marque PAS le paiement en échec : le prestataire a pu créer la
      // transaction avant de perdre la réponse. La réconciliation tranchera.
      this.logger.warn(`[Paiement] ouverture ${reference} : ${e?.message ?? e}`);
    }

    return this.vue(paiement);
  }

  // ── Annonces de statut ─────────────────────────────────────────────────

  /**
   * Point d'entrée UNIQUE de tout changement de statut : webhook,
   * réconciliation, geste manuel du superadmin.
   *
   * Renvoie `true` si l'effet métier a été appliqué à cette occasion — donc
   * une seule fois pour un paiement donné, quel que soit le nombre
   * d'annonces reçues.
   */
  async annoncer(
    reference: string,
    vers: StatutPaiement,
    source: EntreeJournal['source'],
    detail?: string,
  ): Promise<{ effetApplique: boolean; statut: StatutPaiement }> {
    const paiement = await this.paiementModel.findOne({ reference });
    if (!paiement) throw new NotFoundException('Paiement introuvable');

    const de = paiement.statut;
    const decision = evaluer(de, vers);

    if (!decision.applique) {
      // On journalise quand même : une transition refusée est une
      // information — annonce en retard, ou incohérence chez l'opérateur.
      if (decision.motif === 'refusee') {
        paiement.journal.push({ le: new Date(), de, vers, source, detail: `refusée : ${detail ?? ''}`.trim() });
        await paiement.save();
        this.logger.warn(`[Paiement] ${reference} : transition ${de} → ${vers} refusée (${source})`);
      }
      return { effetApplique: false, statut: de };
    }

    paiement.statut = vers;
    paiement.journal.push({ le: new Date(), de, vers, source, detail });
    await paiement.save();

    if (!decision.declencheEffet) return { effetApplique: false, statut: vers };
    const applique = await this.appliquerEffet(paiement);
    return { effetApplique: applique, statut: vers };
  }

  /**
   * Applique l'effet métier — exactement une fois.
   *
   * La décision de la machine à états ne suffit pas : le webhook et la
   * réconciliation peuvent arriver dans la même seconde, chacun ayant lu un
   * paiement encore `en_attente`. C'est l'écriture atomique ci-dessous qui
   * départage — un seul des deux obtient le verrou.
   *
   * En cas d'échec de l'effet, le verrou est RELÂCHÉ. Sans cela, une panne
   * passagère (base indisponible, e-mail déjà pris) laisserait un client
   * payé sans boutique et sans possibilité de reprise automatique.
   */
  private async appliquerEffet(paiement: PaiementDocument): Promise<boolean> {
    // Le verrou est pris sur la RACINE DE LA CHAÎNE, pas sur la tentative.
    // Une référence neuve à chaque essai (exigence de MyCoolPay) crée un
    // document par tentative ; verrouiller la tentative laisserait une
    // confirmation tardive de l'essai n° 1 créer une SECONDE boutique après
    // que l'essai n° 2 a déjà abouti. La racine existe toujours et est
    // unique : elle fait un mutex parfait pour toute la chaîne.
    const verrou = await this.paiementModel.findOneAndUpdate(
      { _id: paiement.chaine, effetApplique: false },
      { $set: { effetApplique: true, effetLe: new Date() } },
      { new: true },
    );
    if (!verrou) return false;   // un autre chemin, ou une autre tentative, s'en est chargé

    try {
      if (paiement.objet === 'creation_boutique') {
        const d = paiement.demandeBoutique!;
        const proprietaire = await this.proprietaireModel.findById(paiement.proprietaire).lean();
        const resultat = await this.provisionnement.creerBoutique({
          nom: d.nom,
          ville: d.ville,
          proprietaire: { email: proprietaire!.email, nom: proprietaire!.nom },
          patron: { nom: d.patronNom, email: d.patronEmail, motDePasseHash: d.patronMotDePasseHash },
        });
        await this.paiementModel.updateOne(
          { _id: paiement._id },
          {
            $set: { boutique: new Types.ObjectId(resultat.boutique.id) },
            // Le mot de passe haché n'a plus d'utilité une fois le compte
            // créé : on ne conserve pas un secret dont on n'a plus besoin.
            $unset: { demandeBoutique: '' },
            $push: { journal: { le: new Date(), de: 'confirme', vers: 'confirme', source: 'reconciliation', detail: `Boutique « ${resultat.boutique.nom} » créée` } },
          },
        );
        this.logger.log(`[Paiement] ${paiement.reference} : boutique « ${resultat.boutique.nom} » créée`);
      } else {
        await this.provisionnement.prolongerLicence(String(paiement.boutique));
        await this.paiementModel.updateOne(
          { _id: paiement._id },
          { $push: { journal: { le: new Date(), de: 'confirme', vers: 'confirme', source: 'reconciliation', detail: 'Licence prolongée d’un an' } } },
        );
        this.logger.log(`[Paiement] ${paiement.reference} : licence prolongée`);
      }
      return true;
    } catch (e: any) {
      // Le verrou est relâché sur la RACINE, là où il a été pris.
      await this.paiementModel.updateOne(
        { _id: paiement.chaine },
        { $set: { effetApplique: false, effetLe: null } },
      );
      await this.paiementModel.updateOne(
        { _id: paiement._id },
        { $push: { journal: { le: new Date(), de: 'confirme', vers: 'confirme', source: 'reconciliation', detail: `ÉCHEC de l'effet : ${e?.message ?? e}` } } },
      );
      this.logger.error(`[Paiement] ${paiement.reference} : effet non appliqué — ${e?.message ?? e}`);
      return false;
    }
  }

  // ── Webhook ────────────────────────────────────────────────────────────

  /**
   * Webhook — un signal « va vérifier », jamais une annonce à croire.
   *
   * ═══ POURQUOI RIEN N'EST CRU ═══
   * La signature des webhooks MyCoolPay n'est pas vérifiable : 794 200
   * combinaisons essayées en production sur Tontina Market, aucune
   * correspondance. Faute de pouvoir authentifier l'émetteur, on ne croit
   * RIEN de ce qu'il raconte — ni le statut, ni le montant. Seule la
   * référence est retenue, et uniquement comme pointeur.
   *
   * L'autorité est l'appel `interroger()`, serveur à serveur. Un webhook
   * forgé annonçant un succès ne fait donc que déclencher une vérification,
   * laquelle répondra « toujours en attente » — et rien ne sera crédité.
   *
   * ═══ POURQUOI RÉPONDRE 500 ═══
   * `conclu: false` fait répondre 500 au prestataire, ce qui provoque le
   * rejeu. On ne peut pas conclure dans trois cas : référence illisible,
   * interrogation impossible (réseau), ou API du prestataire encore en
   * retard sur son propre webhook — cas courant. Acquitter par un 200 dans
   * ces situations perdrait la notification DÉFINITIVEMENT : elle ne serait
   * jamais réémise, et il ne resterait que la réconciliation périodique pour
   * rattraper, beaucoup plus tard.
   */
  async traiterWebhook(
    entetes: Record<string, string | string[] | undefined>,
    corpsBrut: Buffer,
  ): Promise<{ conclu: boolean; statut?: StatutPaiement; motif?: string }> {
    const signal = this.prestataire.extraireReference(entetes, corpsBrut);
    if (!signal || (!signal.reference && !signal.referenceFournisseur)) {
      this.logger.warn('[Paiement] webhook sans référence lisible — 500 pour rejeu');
      return { conclu: false, motif: 'référence illisible' };
    }

    // Recherche par NOTRE référence d'abord, par celle du prestataire ensuite :
    // si sa réponse de création s'est perdue, nous n'avons pas encore la
    // sienne, mais le webhook la porte.
    const critere = signal.reference
      ? { reference: signal.reference }
      : { referenceFournisseur: signal.referenceFournisseur };
    const paiement = await this.paiementModel.findOne(critere);
    if (!paiement) {
      // Référence inconnue : rejouer n'y changera rien, et un 500 ferait
      // boucler le prestataire indéfiniment. On acquitte sans rien faire.
      this.logger.warn(`[Paiement] webhook pour une référence inconnue : ${signal.reference ?? signal.referenceFournisseur}`);
      return { conclu: true, motif: 'référence inconnue' };
    }

    // ACQUITTEMENT RAPIDE, AVANT TOUT APPEL RÉSEAU.
    // Les rejeux arrivent en rafale — 202 requêtes pour 2 paiements ont été
    // observées, dont 85 en délai dépassé. Répondre lentement AGGRAVE la
    // tempête : le prestataire croit le message perdu et le renvoie encore.
    // On tranche donc sur la base locale (~10 ms) avant de parler à qui que
    // ce soit.
    if (paiement.statut === 'confirme' || estTerminal(paiement.statut)) {
      return { conclu: true, statut: paiement.statut, motif: 'déjà tranché' };
    }

    // Référence du prestataire pas encore connue de nous : on retient celle
    // du webhook pour pouvoir l'interroger. Elle n'est pas crue pour autant —
    // le prestataire vérifiera que la transaction porte bien NOTRE référence
    // applicative.
    const refFournisseur = paiement.referenceFournisseur ?? signal.referenceFournisseur ?? null;

    let distant;
    try {
      distant = await this.prestataire.interroger(paiement.reference, refFournisseur);
    } catch (e: any) {
      this.logger.warn(`[Paiement] ${signal.reference} : vérification impossible (${e?.message ?? e}) — 500 pour rejeu`);
      return { conclu: false, motif: 'vérification impossible' };
    }

    if (distant.statut === 'en_attente') {
      // L'API est en retard sur son propre webhook : on refuse d'acquitter
      // pour qu'il revienne.
      this.logger.log(`[Paiement] ${signal.reference} : vérification non concluante — 500 pour rejeu`);
      return { conclu: false, motif: 'non concluant' };
    }

    const r = await this.annoncer(paiement.reference, distant.statut, 'webhook', 'confirmé par vérification serveur');
    return { conclu: true, statut: r.statut };
  }

  // ── Nouvelle tentative ─────────────────────────────────────────────────

  /**
   * Recommence un paiement — avec une référence NEUVE.
   *
   * MyCoolPay refuse une référence déjà employée (409, « Duplicate
   * transaction reference ») : réessayer impose donc d'ouvrir une nouvelle
   * transaction. Le lien avec la tentative précédente est conservé
   * (`chaine`, `paiementPrecedent`), ce qui sert à deux choses : retrouver ce
   * que le client a tenté en cas de réclamation, et surtout garantir qu'une
   * seule boutique naîtra de la chaîne, même si deux tentatives finissent
   * par être confirmées.
   */
  async reessayer(reference: string, emailProprietaire: string, telephonePayeur?: string) {
    const precedent = await this.paiementModel.findOne({ reference });
    if (!precedent) throw new NotFoundException('Paiement introuvable');

    const proprietaire = await this.proprietaireModel.findById(precedent.proprietaire).lean();
    if (proprietaire?.email?.toLowerCase() !== emailProprietaire.toLowerCase()) {
      throw new ForbiddenException('Ce paiement ne vous appartient pas');
    }

    // Si l'effet de la chaîne est déjà appliqué, il n'y a rien à repayer —
    // et surtout rien à créer une seconde fois.
    const racine = await this.paiementModel.findById(precedent.chaine).lean();
    if (racine?.effetApplique) {
      throw new BadRequestException('Ce paiement a déjà abouti — rien à recommencer');
    }
    if (precedent.statut === 'confirme') {
      throw new BadRequestException('Ce paiement est confirmé — rien à recommencer');
    }

    return this.ouvrir({
      objet: precedent.objet,
      proprietaire: precedent.proprietaire,
      boutique: precedent.boutique,
      demandeBoutique: precedent.demandeBoutique,
      description: precedent.objet === 'creation_boutique'
        ? `Création de la boutique « ${precedent.demandeBoutique?.nom ?? ''} » (tentative ${precedent.tentative + 1})`
        : `Renouvellement de licence (tentative ${precedent.tentative + 1})`,
      client: {
        nom: proprietaire!.nom, email: proprietaire!.email,
        // Le numéro de la tentative précédente est repris par défaut ; on
        // ne le redemande pas. Il reste remplaçable : un essai a pu échouer
        // précisément parce que le numéro n'était pas le bon.
        telephone: this.telephonePayeur(
          telephonePayeur, precedent.telephonePayeur || proprietaire!.telephone,
        ),
      },
      chaine: precedent.chaine,
      tentative: precedent.tentative + 1,
      paiementPrecedent: precedent._id as Types.ObjectId,
    });
  }

  // ── Consultation ───────────────────────────────────────────────────────

  async parReference(reference: string, emailProprietaire?: string) {
    const paiement = await this.paiementModel.findOne({ reference });
    if (!paiement) throw new NotFoundException('Paiement introuvable');
    if (emailProprietaire) {
      const proprietaire = await this.proprietaireModel.findById(paiement.proprietaire).lean();
      if (proprietaire?.email?.toLowerCase() !== emailProprietaire.toLowerCase()) {
        throw new ForbiddenException('Ce paiement ne vous appartient pas');
      }
    }
    return this.vue(paiement);
  }

  /**
   * Numéro enregistré du propriétaire, pour pré-remplir le champ de paiement.
   *
   * Renvoyé normalisé, ou vide s'il n'est pas exploitable — mieux vaut un
   * champ à remplir qu'un numéro faux présenté comme sûr.
   */
  async telephoneParDefaut(emailProprietaire: string): Promise<{ telephone: string }> {
    const proprietaire = await this.proprietaireModel
      .findOne({ email: emailProprietaire.toLowerCase() }).lean();
    return { telephone: normaliserTelephone(proprietaire?.telephone) ?? '' };
  }

  async listerPour(emailProprietaire: string) {
    const proprietaire = await this.proprietaireModel.findOne({ email: emailProprietaire.toLowerCase() }).lean();
    if (!proprietaire) return [];
    const paiements = await this.paiementModel
      .find({ proprietaire: proprietaire._id }).sort({ createdAt: -1 }).limit(50);
    return paiements.map(p => this.vue(p));
  }

  /**
   * Vue exposée au client — jamais le document brut : il porte le hachage du
   * mot de passe du futur patron.
   */
  private vue(p: PaiementDocument) {
    return {
      reference: p.reference,
      objet: p.objet,
      statut: p.statut,
      montant: p.montant,
      devise: p.devise,
      urlPaiement: p.urlPaiement,
      boutiqueId: p.boutique ? String(p.boutique) : null,
      nomBoutique: p.demandeBoutique?.nom ?? null,
      tentative: p.tentative,
      depasse: estDepasse((p as any).createdAt ?? new Date()),
      cree: (p as any).createdAt ?? null,
    };
  }
}
