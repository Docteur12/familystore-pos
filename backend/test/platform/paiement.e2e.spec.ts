/**
 * Paiements — les deux règles de conception, éprouvées de bout en bout.
 *
 *  1. **La boutique se crée APRÈS confirmation, jamais avant.** On compte les
 *     boutiques à chaque étape : ouvrir un paiement n'en crée aucune.
 *  2. **La réconciliation active rattrape les webhooks perdus.** Le scénario
 *     décisif n'envoie AUCUN webhook : le paiement passe quand même, parce
 *     qu'on est allé chercher l'état chez le prestataire.
 *
 * S'y ajoute ce qui coûterait le plus cher en production : la double
 * création, l'encaissement sans service, et le webhook contrefait.
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../../src/app.module';
import { PaiementService } from '../../src/platform/paiement/paiement.service';
 import { PaiementController } from '../../src/platform/paiement/paiement.controller';
import { ReconciliationService } from '../../src/platform/paiement/reconciliation.service';
import { PaiementSimuleProvider } from '../../src/platform/paiement/paiement-simule.provider';
import { ProvisionnementService } from '../../src/platform/provisionnement.service';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Paiements — création après confirmation, réconciliation active', () => {
  let app: INestApplication;
  let paiements: PaiementService;
  let controleur: PaiementController;
  let reconciliation: ReconciliationService;
  let prestataire: PaiementSimuleProvider;
  let provisionnement: ProvisionnementService;
  let Boutique: any;
  let Licence: any;
  let Paiement: any;

  const EMAIL_PROPRIO = 'proprio@cameleon.cm';

  const nbBoutiques = () => Boutique.countDocuments();

  /** Ouvre une demande de création et rend sa référence. */
  async function demanderBoutique(nom: string) {
    const r = await paiements.demanderCreationBoutique(EMAIL_PROPRIO, {
      nom,
      ville: 'Douala',
      patron: { nom: 'Patron ' + nom, email: `patron.${nom.toLowerCase()}@test.cm`, motDePasse: 'MotDePasse#1' },
      telephonePayeur: '690000000',
    });
    return r.reference;
  }

  /**
   * Fait avancer l'horloge plutôt que vieillir le document.
   *
   * Antidater `createdAt` ne fonctionne pas : Mongoose le rend IMMUABLE dès
   * que `timestamps` est actif, et retire silencieusement le champ des mises
   * à jour — le test passait alors au vert sans rien avoir vieilli. La
   * réconciliation accepte un « maintenant », précisément pour ça.
   */
  const plusTard = (minutes: number) => new Date(Date.now() + minutes * 60_000);

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    paiements      = app.get(PaiementService);
    controleur     = app.get(PaiementController);
    reconciliation = app.get(ReconciliationService);
    prestataire    = app.get(PaiementSimuleProvider);
    provisionnement = app.get(ProvisionnementService);
    Boutique = app.get(getModelToken('Boutique'), { strict: false });
    Licence  = app.get(getModelToken('Licence'),  { strict: false });
    Paiement = app.get(getModelToken('Paiement'), { strict: false });

    // Une première boutique, qui crée aussi le propriétaire.
    await provisionnement.creerBoutique({
      nom: 'Bonamoussadi', ville: 'Douala',
      proprietaire: { email: EMAIL_PROPRIO, nom: 'Valdes' },
      patron: { nom: 'Patron', email: 'patron@test.cm', motDePasse: 'MotDePasse#1' },
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  afterEach(() => prestataire.oublier());

  // ── Règle 1 : rien avant le paiement ───────────────────────────────────

  describe('la boutique se crée APRÈS confirmation, jamais avant', () => {
    it("ouvrir un paiement ne crée AUCUNE boutique", async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Bependa');

      expect(await nbBoutiques()).toBe(avant);          // rien de créé
      const p = await Paiement.findOne({ reference }).lean();
      expect(p.statut).toBe('en_attente');
      expect(p.boutique).toBeNull();
      // Ce qu'on créera est en attente dans le paiement, pas dans le registre.
      expect(p.demandeBoutique.nom).toBe('Bependa');
    });

    it('le mot de passe du futur patron n’est JAMAIS conservé en clair', async () => {
      const reference = await demanderBoutique('Akwa');
      const p = await Paiement.findOne({ reference }).lean();
      expect(p.demandeBoutique.patronMotDePasseHash).toMatch(/^\$2[aby]\$/);   // hachage bcrypt
      expect(JSON.stringify(p)).not.toContain('MotDePasse#1');
    });

    it('la confirmation crée la boutique, une seule fois', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Deido');

      const r = await paiements.annoncer(reference, 'confirme', 'webhook');
      expect(r.effetApplique).toBe(true);
      expect(await nbBoutiques()).toBe(avant + 1);

      const p = await Paiement.findOne({ reference }).lean();
      expect(p.boutique).not.toBeNull();
      // Le hachage disparaît une fois le compte créé : on ne garde pas un
      // secret dont on n'a plus l'usage.
      expect(p.demandeBoutique).toBeUndefined();
    });

    it('un paiement échoué ne crée rien', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Ndogpassi');
      await paiements.annoncer(reference, 'echoue', 'webhook');
      expect(await nbBoutiques()).toBe(avant);
    });
  });

  // ── Idempotence ────────────────────────────────────────────────────────

  describe('idempotence — deux annonces ne valent qu’une', () => {
    it('confirmer deux fois ne crée qu’une boutique', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Logpom');

      const premier = await paiements.annoncer(reference, 'confirme', 'webhook');
      const second  = await paiements.annoncer(reference, 'confirme', 'reconciliation');

      expect(premier.effetApplique).toBe(true);
      expect(second.effetApplique).toBe(false);        // répétition : sans effet
      expect(await nbBoutiques()).toBe(avant + 1);
    });

    it('webhook et réconciliation qui arrivent ENSEMBLE ne créent qu’une boutique', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Makepe');

      // Le cas que la garde en base doit couvrir : les deux chemins lisent un
      // paiement encore « en attente », puis écrivent.
      const [a, b] = await Promise.all([
        paiements.annoncer(reference, 'confirme', 'webhook'),
        paiements.annoncer(reference, 'confirme', 'reconciliation'),
      ]);

      expect([a.effetApplique, b.effetApplique].filter(Boolean)).toHaveLength(1);
      expect(await nbBoutiques()).toBe(avant + 1);
    });

    it('un renouvellement confirmé deux fois ne prolonge qu’une fois', async () => {
      const boutique = await Boutique.findOne({ nom: 'Bonamoussadi' }).lean();
      const avant = await Licence.findOne({ boutique: boutique._id, statut: 'active' })
        .sort({ dateEcheance: -1 }).lean();

      const r = await paiements.demanderRenouvellement(EMAIL_PROPRIO, String(boutique._id), '690000000');
      await paiements.annoncer(r.reference, 'confirme', 'webhook');
      await paiements.annoncer(r.reference, 'confirme', 'reconciliation');

      const licences = await Licence.countDocuments({ boutique: boutique._id, statut: 'active' });
      const apres = await Licence.findOne({ boutique: boutique._id, statut: 'active' })
        .sort({ dateEcheance: -1 }).lean();

      expect(licences).toBe(2);                        // l'ancienne + UNE nouvelle
      expect(new Date(apres.dateEcheance).getFullYear())
        .toBe(new Date(avant.dateEcheance).getFullYear() + 1);
    });
  });

  // ── Règle 2 : réconciliation active ────────────────────────────────────

  describe('réconciliation active — les webhooks se perdent', () => {
    it('un paiement confirmé SANS webhook est rattrapé, et la boutique est créée', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Bonaberi');

      // L'opérateur a encaissé. Aucun webhook n'arrivera jamais.
      prestataire.programmer(reference, 'confirme');
      expect(await nbBoutiques()).toBe(avant);         // toujours rien

      const changes = await reconciliation.reconcilier();

      expect(changes).toBeGreaterThanOrEqual(1);
      expect(await nbBoutiques()).toBe(avant + 1);
      const p = await Paiement.findOne({ reference }).lean();
      expect(p.statut).toBe('confirme');
      expect(p.journal.some((e: any) => e.source === 'reconciliation')).toBe(true);
    });

    it('un paiement resté en attente trop longtemps passe en expiré', async () => {
      const reference = await demanderBoutique('Yassa');

      await reconciliation.reconcilier(plusTard(45));  // au-delà du délai

      const p = await Paiement.findOne({ reference }).lean();
      expect(p.statut).toBe('expire');
    });

    it('ENCAISSEMENT SANS SERVICE : une confirmation tardive crée quand même la boutique', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Japoma');
      await reconciliation.reconcilier(plusTard(45));
      expect((await Paiement.findOne({ reference }).lean()).statut).toBe('expire');
      expect(await nbBoutiques()).toBe(avant);

      // L'opérateur finit par confirmer, une heure plus tard.
      prestataire.programmer(reference, 'confirme');
      await reconciliation.reconcilier(plusTard(60));

      expect(await nbBoutiques()).toBe(avant + 1);
      expect((await Paiement.findOne({ reference }).lean()).statut).toBe('confirme');
    });

    it('une panne du prestataire ne transforme PAS un paiement en échec', async () => {
      const reference = await demanderBoutique('Ngodi');
      const panne = jest.spyOn(prestataire, 'interroger')
        .mockRejectedValue(new Error('réseau indisponible'));

      await reconciliation.reconcilier();

      expect(panne).toHaveBeenCalled();
      const p = await Paiement.findOne({ reference }).lean();
      expect(p.statut).toBe('en_attente');             // surtout pas « echoue »
      panne.mockRestore();
    });

    it('un échec est définitif : une confirmation postérieure est refusée', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Kotto');
      await paiements.annoncer(reference, 'echoue', 'webhook');

      const r = await paiements.annoncer(reference, 'confirme', 'reconciliation');

      expect(r.effetApplique).toBe(false);
      expect(r.statut).toBe('echoue');
      expect(await nbBoutiques()).toBe(avant);
    });
  });

  // ── Webhook : un signal, jamais une source de vérité ───────────────────

  describe('webhook — signal « va vérifier », jamais une annonce à croire', () => {
    /** Corps imitant MyCoolPay, qui annonce un succès. */
    const corps = (reference: string) =>
      Buffer.from(JSON.stringify({ app_transaction_ref: reference, status: 'SUCCESS' }), 'utf8');

    it('un webhook FORGÉ annonçant un succès ne crédite RIEN', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Bali');

      // Personne n'a payé : le prestataire, interrogé, dira « en attente ».
      // Le webhook, lui, affirme SUCCESS — et n'est pas cru.
      const r = await paiements.traiterWebhook({}, corps(reference));

      expect(r.conclu).toBe(false);                    // non concluant → 500, rejeu
      expect(await nbBoutiques()).toBe(avant);         // rien créé
      expect((await Paiement.findOne({ reference }).lean()).statut).toBe('en_attente');
    });

    // TÉMOIN : sans lui, le test précédent passerait au vert même si le
    // webhook ne servait à rien du tout.
    it('témoin — le MÊME webhook crée la boutique quand la vérification confirme', async () => {
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Cite');
      prestataire.programmer(reference, 'confirme');   // l'opérateur a bien encaissé

      const r = await paiements.traiterWebhook({}, corps(reference));

      expect(r.conclu).toBe(true);
      expect(r.statut).toBe('confirme');
      expect(await nbBoutiques()).toBe(avant + 1);
    });

    it('référence illisible → non conclu, pour que le prestataire rejoue', async () => {
      const r = await paiements.traiterWebhook({}, Buffer.from('ceci n’est pas du JSON', 'utf8'));
      expect(r.conclu).toBe(false);
    });

    it('prestataire injoignable → non conclu, JAMAIS un acquittement', async () => {
      const reference = await demanderBoutique('Bonapriso');
      const panne = jest.spyOn(prestataire, 'interroger').mockRejectedValue(new Error('réseau'));

      const r = await paiements.traiterWebhook({}, corps(reference));

      expect(r.conclu).toBe(false);
      expect((await Paiement.findOne({ reference }).lean()).statut).toBe('en_attente');
      panne.mockRestore();
    });

    it('référence inconnue → acquitté sans effet (rejouer n’y changerait rien)', async () => {
      const r = await paiements.traiterWebhook({}, corps('CAM-INEXISTANT'));
      expect(r.conclu).toBe(true);
    });

    it('le contrôleur traduit « non conclu » en 500 — c’est ce qui force le rejeu', async () => {
      const reference = await demanderBoutique('Nyalla');
      const requete: any = { rawBody: corps(reference) };

      await expect(controleur.webhook(requete, {})).rejects.toMatchObject({
        status: 500,
      });

      // Et 200 quand on a conclu.
      prestataire.programmer(reference, 'confirme');
      await expect(controleur.webhook(requete, {})).resolves.toMatchObject({ recu: true });
    });

    it('RAFALE de rejeux : 30 livraisons du même webhook, une seule boutique', async () => {
      // Observé en production : 202 requêtes pour 2 paiements. L'idempotence
      // n'est pas une précaution théorique, elle sera sollicitée.
      const avant = await nbBoutiques();
      const reference = await demanderBoutique('Bepanda');
      prestataire.programmer(reference, 'confirme');
      const c = corps(reference);

      const reponses = await Promise.all(
        Array.from({ length: 30 }, () => paiements.traiterWebhook({}, c)),
      );

      expect(reponses.every(r => r.conclu)).toBe(true);   // aucun rejeu inutile réclamé
      expect(await nbBoutiques()).toBe(avant + 1);        // UNE boutique
    });
  });

  // ── Nouvelle tentative ─────────────────────────────────────────────────

  describe('nouvelle tentative — référence fraîche, chaîne conservée', () => {
    it('réessayer produit une référence NEUVE et garde le lien', async () => {
      const reference = await demanderBoutique('Village');
      await paiements.annoncer(reference, 'echoue', 'webhook');

      const seconde = await paiements.reessayer(reference, EMAIL_PROPRIO);

      expect(seconde.reference).not.toBe(reference);      // MyCoolPay refuse un doublon
      expect(seconde.tentative).toBe(2);

      const [a, b] = await Promise.all([
        Paiement.findOne({ reference }).lean(),
        Paiement.findOne({ reference: seconde.reference }).lean(),
      ]);
      expect(String(b.chaine)).toBe(String(a.chaine));    // même chaîne
      expect(String(b.paiementPrecedent)).toBe(String(a._id));
      expect(b.demandeBoutique.nom).toBe('Village');      // la demande est reprise
    });

    it('DEUX tentatives confirmées ne créent qu’UNE boutique', async () => {
      // Le piège de la référence fraîche : la tentative n° 1, déclarée
      // expirée, peut être confirmée tardivement APRÈS que la n° 2 a abouti.
      const avant = await nbBoutiques();
      const premiere = await demanderBoutique('Ngangue');
      await paiements.annoncer(premiere, 'expire', 'reconciliation');

      const seconde = await paiements.reessayer(premiere, EMAIL_PROPRIO);
      await paiements.annoncer(seconde.reference, 'confirme', 'webhook');
      expect(await nbBoutiques()).toBe(avant + 1);

      // Confirmation tardive de la première.
      const tardive = await paiements.annoncer(premiere, 'confirme', 'reconciliation');

      expect(tardive.statut).toBe('confirme');            // le paiement est bien confirmé
      expect(tardive.effetApplique).toBe(false);          // mais sans second effet
      expect(await nbBoutiques()).toBe(avant + 1);        // toujours UNE boutique
    });

    it('on ne recommence pas un paiement déjà abouti', async () => {
      const reference = await demanderBoutique('Bwanga');
      await paiements.annoncer(reference, 'confirme', 'webhook');

      await expect(paiements.reessayer(reference, EMAIL_PROPRIO)).rejects.toThrow(/déjà abouti|confirmé/i);
    });
  });

  // ── Appartenance ───────────────────────────────────────────────────────

  describe('appartenance', () => {
    it("un propriétaire ne peut pas renouveler la boutique d'un autre", async () => {
      // Une boutique appartenant à quelqu'un d'autre.
      const autre = await provisionnement.creerBoutique({
        nom: 'Boutique tierce', ville: 'Yaoundé',
        proprietaire: { email: 'autre@cameleon.cm', nom: 'Autre' },
        patron: { nom: 'Patron', email: 'patron.tiers@test.cm', motDePasse: 'MotDePasse#1' },
      });

      await expect(
        paiements.demanderRenouvellement(EMAIL_PROPRIO, autre.boutique.id, '690000000'),
      ).rejects.toThrow(/n'appartient pas/i);
    });

    it('un numéro de payeur mal formé est refusé AVANT tout appel au prestataire', async () => {
      const boutique = await Boutique.findOne({ nom: 'Bonamoussadi' }).lean();
      await expect(
        paiements.demanderRenouvellement(EMAIL_PROPRIO, String(boutique._id), '12345'),
      ).rejects.toThrow(/9 chiffres commençant par 6/);
    });

    it('une nouvelle tentative reprend le numéro de la précédente', async () => {
      const reference = await demanderBoutique('Bomono');
      await paiements.annoncer(reference, 'echoue', 'webhook');

      // Aucun numéro fourni : celui de la tentative précédente est repris,
      // sans qu'on ait à le redemander au commerçant.
      const seconde = await paiements.reessayer(reference, EMAIL_PROPRIO);

      const doc = await Paiement.findOne({ reference: seconde.reference }).lean();
      expect(doc.telephonePayeur).toBe('690000000');
    });

    it("un paiement n'est consultable que par son propriétaire", async () => {
      const reference = await demanderBoutique('Ndokoti');
      await expect(paiements.parReference(reference, 'autre@cameleon.cm'))
        .rejects.toThrow(/ne vous appartient pas/i);
      await expect(paiements.parReference(reference, EMAIL_PROPRIO)).resolves.toBeDefined();
    });
  });
});
