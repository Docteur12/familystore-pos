/**
 * Connexion en multi-magasin — décision produit du 21/08/2026 : PAS de code
 * boutique. L'utilisateur saisit deux champs, comme aujourd'hui.
 *
 * Règles éprouvées ici :
 *  1. e-mail présent dans un seul magasin  → connexion directe ;
 *  2. e-mail présent dans plusieurs        → mot de passe validé D'ABORD,
 *     puis choix parmi les seules boutiques où le couple est valide ;
 *  3. e-mail inconnu                       → réponse identique au mot de passe
 *     faux (pas d'oracle d'énumération — régression corrigée le 03/08) ;
 *  4. le jeton porte `tenantId` (sans quoi le mode multi ne fonctionne pas) ;
 *  5. on ne peut pas se faire délivrer un jeton pour une boutique où le mot de
 *     passe n'a PAS été validé, même en connaissant son identifiant.
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { runWithTenant } from '../../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

const BOUTIQUE_1 = new Types.ObjectId();
const BOUTIQUE_2 = new Types.ObjectId();
const BOUTIQUE_3 = new Types.ObjectId();

const MDP = 'MotDePasse#2026';
const AUTRE_MDP = 'UnAutreMotDePasse#2026';

describe('Connexion multi-magasin — sans code boutique', () => {
  let app: INestApplication;

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/auth/login').send({ email, password });

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const User: any = app.get(getModelToken('User'), { strict: false });
    const Settings: any = app.get(getModelToken('Settings'), { strict: false });
    const hash = await bcrypt.hash(MDP, 10);
    const autreHash = await bcrypt.hash(AUTRE_MDP, 10);

    // Boutique 1 et 2 : même e-mail, MÊME mot de passe → choix attendu.
    // Boutique 3 : même e-mail, mot de passe DIFFÉRENT → ne doit jamais
    // apparaître dans la liste des boutiques proposées.
    const plans = [
      [BOUTIQUE_1, 'Boutique Une',   hash],
      [BOUTIQUE_2, 'Boutique Deux',  hash],
      [BOUTIQUE_3, 'Boutique Trois', autreHash],
    ] as const;

    for (const [tenant, nom, motDePasse] of plans) {
      await runWithTenant(tenant, async () => {
        await Settings.create({ nomMagasin: nom });
        await User.create({ name: `Patron ${nom}`, email: 'partout@test.cm', password: motDePasse, role: 'patron' });
      });
    }

    // Compte présent dans une seule boutique.
    await runWithTenant(BOUTIQUE_1, async () => {
      await User.create({ name: 'Unique', email: 'unique@test.cm', password: hash, role: 'patron' });
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  it('e-mail dans un seul magasin : connexion directe, jeton portant le tenantId', async () => {
    const res = await login('unique@test.cm', MDP);
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();

    const payload = JSON.parse(Buffer.from(res.body.access_token.split('.')[1], 'base64').toString());
    expect(payload.tenantId).toBe(String(BOUTIQUE_1));
    expect(payload.v).toBe(2);
  });

  it('e-mail dans plusieurs magasins : choix proposé, limité aux boutiques où le mot de passe est valide', async () => {
    const res = await login('partout@test.cm', MDP);
    expect(res.status).toBe(200);
    expect(res.body.choixBoutique).toBe(true);
    expect(res.body.access_token).toBeUndefined();   // pas encore connecté

    const noms = res.body.boutiques.map((b: any) => b.nom).sort();
    expect(noms).toEqual(['Boutique Deux', 'Boutique Une']);
    // Boutique Trois a le même e-mail mais un autre mot de passe : invisible.
    expect(JSON.stringify(res.body)).not.toContain(String(BOUTIQUE_3));
  });

  it('le choix aboutit à un jeton pour la boutique désignée', async () => {
    const premier = await login('partout@test.cm', MDP);
    const cible = premier.body.boutiques.find((b: any) => b.nom === 'Boutique Deux');

    const res = await request(app.getHttpServer())
      .post('/api/auth/login/boutique')
      .send({ selectionToken: premier.body.selectionToken, tenantId: cible.tenantId });

    expect(res.status).toBe(200);
    const payload = JSON.parse(Buffer.from(res.body.access_token.split('.')[1], 'base64').toString());
    expect(payload.tenantId).toBe(String(BOUTIQUE_2));
  });

  it('impossible de réclamer une boutique dont le mot de passe n\'a pas été validé', async () => {
    const premier = await login('partout@test.cm', MDP);
    const res = await request(app.getHttpServer())
      .post('/api/auth/login/boutique')
      .send({ selectionToken: premier.body.selectionToken, tenantId: String(BOUTIQUE_3) });

    expect(res.status).toBe(401);
    expect(res.body.access_token).toBeUndefined();
  });

  it('un jeton de sélection forgé ou absent ne donne aucun accès', async () => {
    for (const selectionToken of ['', 'pas-un-jeton', 'a.b.c']) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login/boutique')
        .send({ selectionToken, tenantId: String(BOUTIQUE_1) });
      expect(res.status).toBe(401);
    }
  });

  it('e-mail inconnu et mot de passe faux sont indiscernables', async () => {
    const inconnu = await login('personne@test.cm', MDP);
    const mauvais = await login('unique@test.cm', 'mauvais-mot-de-passe');

    expect(inconnu.status).toBe(401);
    expect(mauvais.status).toBe(401);
    expect(inconnu.body.message).toBe(mauvais.body.message);
  });
});
