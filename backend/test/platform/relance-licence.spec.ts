/**
 * Relances d'échéance par e-mail.
 *
 * Deux risques symétriques : ne pas prévenir (le commerçant découvre le
 * blocage), et harceler (quatre e-mails par jour jusqu'à l'échéance). Les
 * deux sont testés, ainsi que le cas d'une messagerie en panne — un envoi
 * raté ne doit jamais être compté comme fait, sinon le rappel disparaît.
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../../src/app.module';
import { ProvisionnementService } from '../../src/platform/provisionnement.service';
import { RelanceLicenceService } from '../../src/platform/relance-licence.service';
import { MailService } from '../../src/mail/mail.service';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Relances de licence — prévenir sans harceler', () => {
  let app: INestApplication;
  let relance: RelanceLicenceService;
  let mail: MailService;
  let Licence: any;
  let envois: any[];

  const dans = (jours: number) => {
    const d = new Date();
    d.setDate(d.getDate() + jours);
    return d;
  };

  /** Positionne l'échéance et remet le compteur de relances à zéro. */
  async function echeanceDans(jours: number, relancesEnvoyees: number[] = []) {
    await Licence.updateMany({}, { $set: { dateEcheance: dans(jours), relancesEnvoyees } });
    ProvisionnementService.oublierLicence();
  }

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    relance = app.get(RelanceLicenceService);
    mail = app.get(MailService);
    Licence = app.get(getModelToken('Licence'), { strict: false });

    await app.get(ProvisionnementService).creerBoutique({
      nom: 'Bonamoussadi', ville: 'Douala',
      proprietaire: { email: 'proprio@cameleon.cm', nom: 'Valdes' },
      patron: { nom: 'Patron', email: 'patron@test.cm', motDePasse: 'MotDePasse#1' },
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  beforeEach(() => {
    // Messagerie simulée : on observe ce qui PARTIRAIT, sans rien envoyer.
    envois = [];
    jest.spyOn(mail, 'envoyerRelanceLicence').mockImplementation(async params => {
      envois.push(params);
      return true;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('ne relance pas tant que l’échéance est lointaine', async () => {
    await echeanceDans(30);
    expect(await relance.relancer()).toBe(0);
    expect(envois).toHaveLength(0);
  });

  it('relance au premier seuil franchi, avec le montant et la boutique', async () => {
    await echeanceDans(14);
    expect(await relance.relancer()).toBe(1);

    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({
      destinataire: 'proprio@cameleon.cm',   // le propriétaire d'abord
      nomBoutique: 'Bonamoussadi',
      montant: 120_000,
      devise: 'XAF',
    });
    expect(envois[0].joursRestants).toBeGreaterThanOrEqual(14);
  });

  it('ne renvoie PAS le même rappel au passage suivant', async () => {
    await echeanceDans(14);
    await relance.relancer();
    envois = [];

    // La tâche tourne toutes les six heures : elle ne doit rien réenvoyer.
    expect(await relance.relancer()).toBe(0);
    expect(envois).toHaveLength(0);
  });

  it('relance à chaque nouveau seuil, une fois chacun', async () => {
    await echeanceDans(14);
    const seuilsVus: number[] = [];

    for (const jours of [14, 10, 7, 5, 3, 2, 1]) {
      await Licence.updateMany({}, { $set: { dateEcheance: dans(jours) } });
      ProvisionnementService.oublierLicence();
      envois = [];
      await relance.relancer();
      if (envois.length) seuilsVus.push(jours);
    }

    // Un envoi à 14, 7, 3 et 1 — pas aux jours intermédiaires.
    expect(seuilsVus).toEqual([14, 7, 3, 1]);
  });

  it('rattrape un seuil manqué plutôt que de le sauter', async () => {
    // L'application était éteinte à J-14 : à J-10, le rappel part quand même.
    await echeanceDans(10);
    expect(await relance.relancer()).toBe(1);
    expect(envois[0].joursRestants).toBeLessThanOrEqual(11);
  });

  it('un envoi raté n’est pas marqué comme fait — le rappel reste dû', async () => {
    jest.restoreAllMocks();
    const enPanne = jest.spyOn(mail, 'envoyerRelanceLicence').mockResolvedValue(false);

    await echeanceDans(7);
    expect(await relance.relancer()).toBe(0);       // rien de compté
    expect(enPanne).toHaveBeenCalledTimes(1);

    const licence = await Licence.findOne().lean();
    expect(licence.relancesEnvoyees).toEqual([]);   // aucune trace laissée

    // Messagerie rétablie : le rappel part.
    enPanne.mockResolvedValue(true);
    expect(await relance.relancer()).toBe(1);
  });

  it('ne relance plus une licence déjà expirée — le blocage parle de lui-même', async () => {
    await echeanceDans(-3);
    expect(await relance.relancer()).toBe(0);
    expect(envois).toHaveLength(0);
  });

  it('ignore les boutiques suspendues', async () => {
    const Boutique: any = app.get(getModelToken('Boutique'), { strict: false });
    await Boutique.updateMany({}, { $set: { statut: 'suspendue' } });
    await echeanceDans(7);

    expect(await relance.relancer()).toBe(0);

    await Boutique.updateMany({}, { $set: { statut: 'active' } });
  });
});
