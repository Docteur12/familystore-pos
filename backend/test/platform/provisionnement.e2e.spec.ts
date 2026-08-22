/**
 * Provisionnement d'une boutique et registre plateforme — lot C, bloc 1.
 *
 * Créer une boutique, c'est fabriquer un espace de données neuf. Deux
 * propriétés comptent : les documents initiaux atterrissent dans le BON
 * tenant, et rien ne déborde sur les boutiques voisines.
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ProvisionnementService } from '../../src/platform/provisionnement.service';
import { runWithTenant } from '../../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Provisionnement — une boutique = un espace de données neuf', () => {
  let app: INestApplication;
  let provisionnement: ProvisionnementService;

  const demande = (nom: string, emailProprio = 'proprio@cameleon.cm') => ({
    nom,
    ville: 'Douala',
    proprietaire: { email: emailProprio, nom: 'Valdes' },
    patron: { nom: `Patron ${nom}`, email: `patron.${nom.toLowerCase()}@test.cm`, motDePasse: 'MotDePasse#1' },
  });

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    provisionnement = app.get(ProvisionnementService);
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  it('crée le registre, la licence d’un an, et les documents initiaux DANS le nouveau tenant', async () => {
    const { boutique, licence } = await provisionnement.creerBoutique(demande('Bonamoussadi'));

    expect(boutique.tenantId).toMatch(/^[0-9a-f]{24}$/);
    expect(licence.montant).toBe(120_000);
    expect(licence.devise).toBe('XAF');
    const unAn = new Date(licence.dateDebut);
    unAn.setFullYear(unAn.getFullYear() + 1);
    expect(new Date(licence.dateEcheance).toDateString()).toBe(unAn.toDateString());

    // Les documents initiaux existent — et seulement dans ce tenant.
    const Settings: any = app.get(getModelToken('Settings'), { strict: false });
    const User: any = app.get(getModelToken('User'), { strict: false });

    await runWithTenant(boutique.tenantId, async () => {
      expect((await Settings.findOne().lean())?.nomMagasin).toBe('Bonamoussadi');
      const patron = await User.findOne({ role: 'patron' }).lean();
      expect(patron?.email).toBe('patron.bonamoussadi@test.cm');
      expect(patron?.password).not.toBe('MotDePasse#1'); // haché
    });
  });

  it('deux boutiques du même propriétaire ne partagent aucune donnée', async () => {
    const a = await provisionnement.creerBoutique(demande('Bependa'));
    const b = await provisionnement.creerBoutique(demande('Logpom'));

    expect(a.boutique.tenantId).not.toBe(b.boutique.tenantId);

    const Settings: any = app.get(getModelToken('Settings'), { strict: false });
    const nomDe = (tenantId: string) =>
      runWithTenant(tenantId, async () => (await Settings.findOne().lean())?.nomMagasin);

    expect(await nomDe(a.boutique.tenantId)).toBe('Bependa');
    expect(await nomDe(b.boutique.tenantId)).toBe('Logpom');
  });

  it('rattache au propriétaire existant plutôt que d’en créer un second', async () => {
    const Proprietaire: any = app.get(getModelToken('Proprietaire'), { strict: false });
    const avant = await Proprietaire.countDocuments({ email: 'proprio@cameleon.cm' });
    await provisionnement.creerBoutique(demande('Makepe'));
    expect(await Proprietaire.countDocuments({ email: 'proprio@cameleon.cm' })).toBe(avant);
  });

  it('liste les boutiques d’un propriétaire, et rien pour un e-mail inconnu', async () => {
    const siennes = await provisionnement.boutiquesDuProprietaire('proprio@cameleon.cm');
    expect(siennes.map(b => b.nom).sort()).toEqual(['Bependa', 'Bonamoussadi', 'Logpom', 'Makepe']);
    expect(await provisionnement.boutiquesDuProprietaire('inconnu@test.cm')).toEqual([]);
  });

  it('refuse un mot de passe patron trop court plutôt que de créer une boutique bancale', async () => {
    await expect(
      provisionnement.creerBoutique({ ...demande('Akwa'), patron: { nom: 'X', email: 'x@test.cm', motDePasse: '123' } }),
    ).rejects.toThrow(/mot de passe/i);
  });

  it('une boutique suspendue sort de la liste du propriétaire', async () => {
    const Boutique: any = app.get(getModelToken('Boutique'), { strict: false });
    const cible = await Boutique.findOne({ nom: 'Makepe' });
    await provisionnement.changerStatutBoutique(String(cible._id), 'suspendue');

    const siennes = await provisionnement.boutiquesDuProprietaire('proprio@cameleon.cm');
    expect(siennes.map(b => b.nom)).not.toContain('Makepe');

    await provisionnement.changerStatutBoutique(String(cible._id), 'active');
  });

  it('prolonge sans faire perdre les jours déjà payés', async () => {
    const Boutique: any = app.get(getModelToken('Boutique'), { strict: false });
    const cible = await Boutique.findOne({ nom: 'Bependa' });

    const avant = await provisionnement.licenceCourante(String(cible.tenantId));
    const prolongee = await provisionnement.prolongerLicence(String(cible._id));

    // Le renouvellement anticipé repart de l'échéance, pas d'aujourd'hui.
    const attendu = new Date(avant!.dateEcheance);
    attendu.setFullYear(attendu.getFullYear() + 1);
    expect(new Date(prolongee.dateEcheance).toDateString()).toBe(attendu.toDateString());
  });

  it('la connexion d’un propriétaire liste SES boutiques, depuis le registre', async () => {
    // Compte patron de Bonamoussadi, dont l'e-mail n'est PAS celui du
    // propriétaire : repli sur les boutiques prouvées, comportement d'avant.
    const employe = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'patron.bonamoussadi@test.cm', password: 'MotDePasse#1' });
    const chargeEmploye = JSON.parse(Buffer.from(employe.body.access_token.split('.')[1], 'base64').toString());
    expect(chargeEmploye.boutiques).toHaveLength(1);

    // Le propriétaire, lui, est inscrit au registre : ses boutiques actives.
    const Proprietaire: any = app.get(getModelToken('Proprietaire'), { strict: false });
    expect(await Proprietaire.countDocuments({ email: 'proprio@cameleon.cm' })).toBe(1);
    const siennes = await provisionnement.boutiquesDuProprietaire('proprio@cameleon.cm');
    expect(siennes.length).toBeGreaterThanOrEqual(3);
  });
});
