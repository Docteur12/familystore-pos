/**
 * Back-office plateforme — `superadmin`, le seul rôle qui traverse les boutiques.
 *
 * Même exigence que pour le consolidé : la dérogation doit être bornée et
 * démontrée. Un patron, fût-il propriétaire de plusieurs boutiques, ne doit
 * pas voir le registre des autres clients.
 *
 * Chaque refus est doublé d'un TÉMOIN prouvant que la route répond bien
 * quand le rôle convient — sinon un 403 pourrait venir d'une route absente.
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ProvisionnementService } from '../../src/platform/provisionnement.service';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Back-office plateforme — réservé au superadmin', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let provisionnement: ProvisionnementService;
  let idBoutique: string;
  let tenantBoutique: string;

  const jetonRole = (role: string) =>
    jwt.sign({
      v: 2, sub: new Types.ObjectId().toString(), email: `${role}@test.cm`,
      name: role, role, tenantId: new Types.ObjectId().toString(), boutiques: [],
    });

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);
    provisionnement = app.get(ProvisionnementService);

    const cree = await provisionnement.creerBoutique({
      nom: 'Bonamoussadi', ville: 'Douala',
      proprietaire: { email: 'proprio@cameleon.cm', nom: 'Valdes' },
      patron: { nom: 'Patron', email: 'patron@test.cm', motDePasse: 'MotDePasse#1' },
    });
    idBoutique = cree.boutique.id;
    tenantBoutique = cree.boutique.tenantId;
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  const get = (chemin: string, jeton: string) =>
    request(app.getHttpServer()).get(chemin).set('Authorization', `Bearer ${jeton}`);

  // ── Refus ─────────────────────────────────────────────────────────────────

  it.each(['patron', 'gestionnaire', 'caissier', 'magazinier', 'commercial'])(
    'un %s ne voit pas le registre des boutiques',
    async role => {
      const res = await get('/api/platform/boutiques', jetonRole(role));
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain('Bonamoussadi');
    },
  );

  it('un patron ne peut ni créer, ni suspendre, ni prolonger', async () => {
    const jeton = jetonRole('patron');
    const creation = await request(app.getHttpServer())
      .post('/api/platform/boutiques').set('Authorization', `Bearer ${jeton}`)
      .send({ nom: 'Pirate', proprietaire: { email: 'x@test.cm', nom: 'X' }, patron: { nom: 'X', email: 'y@test.cm', motDePasse: 'MotDePasse#1' } });
    expect(creation.status).toBe(403);

    const suspension = await request(app.getHttpServer())
      .patch(`/api/platform/boutiques/${idBoutique}/statut`).set('Authorization', `Bearer ${jeton}`)
      .send({ statut: 'suspendue' });
    expect(suspension.status).toBe(403);

    const prolongation = await request(app.getHttpServer())
      .post(`/api/platform/boutiques/${idBoutique}/prolonger`).set('Authorization', `Bearer ${jeton}`).send({});
    expect(prolongation.status).toBe(403);

    // La boutique n'a pas bougé.
    const registre = await get('/api/platform/boutiques', jetonRole('superadmin'));
    expect(registre.body.find((b: any) => b.id === idBoutique).statut).toBe('active');
  });

  it('sans jeton, aucun accès', async () => {
    const res = await request(app.getHttpServer()).get('/api/platform/boutiques');
    expect(res.status).toBe(401);
  });

  // ── Témoin : la route existe et répond pour le bon rôle ───────────────────

  it('TÉMOIN — le superadmin, lui, obtient le registre complet', async () => {
    const res = await get('/api/platform/boutiques', jetonRole('superadmin'));

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('Bonamoussadi');
    const ligne = res.body.find((b: any) => b.id === idBoutique);
    expect(ligne.tenantId).toBe(tenantBoutique);
    expect(ligne.proprietaire.email).toBe('proprio@cameleon.cm');
    expect(ligne.licence.montant).toBe(120_000);
    expect(ligne.licence.expiree).toBe(false);
    expect(ligne.licence.joursRestants).toBeGreaterThan(360);
  });

  it('le superadmin suspend, réactive et prolonge', async () => {
    const jeton = jetonRole('superadmin');

    const suspendue = await request(app.getHttpServer())
      .patch(`/api/platform/boutiques/${idBoutique}/statut`).set('Authorization', `Bearer ${jeton}`)
      .send({ statut: 'suspendue' });
    expect(suspendue.status).toBe(200);
    expect(suspendue.body.statut).toBe('suspendue');

    // Une boutique suspendue disparaît du périmètre de son propriétaire.
    expect(await provisionnement.boutiquesDuProprietaire('proprio@cameleon.cm')).toEqual([]);

    const reactivee = await request(app.getHttpServer())
      .patch(`/api/platform/boutiques/${idBoutique}/statut`).set('Authorization', `Bearer ${jeton}`)
      .send({ statut: 'active' });
    expect(reactivee.body.statut).toBe('active');

    const avant = await provisionnement.licenceCourante(tenantBoutique);
    const prolongation = await request(app.getHttpServer())
      .post(`/api/platform/boutiques/${idBoutique}/prolonger`).set('Authorization', `Bearer ${jeton}`).send({});
    // 201 : la prolongation CRÉE une nouvelle licence, elle ne modifie pas l'ancienne.
    expect(prolongation.status).toBe(201);
    expect(new Date(prolongation.body.dateEcheance).getTime())
      .toBeGreaterThan(new Date(avant!.dateEcheance).getTime());
  });

  it('la création par le back-office provisionne un vrai espace de données', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/platform/boutiques').set('Authorization', `Bearer ${jetonRole('superadmin')}`)
      .send({
        nom: 'Bependa', ville: 'Douala',
        proprietaire: { email: 'proprio@cameleon.cm' },
        patron: { nom: 'Patron Bependa', email: 'patron.bependa@test.cm', motDePasse: 'MotDePasse#1' },
      });

    expect(res.status).toBe(201);
    expect(res.body.boutique.tenantId).not.toBe(tenantBoutique);
    expect(res.body.licence.montant).toBe(120_000);

    const Settings: any = app.get(getModelToken('Settings'), { strict: false });
    const { runWithTenant } = await import('../../src/tenancy/tenant-context');
    const nom = await runWithTenant(res.body.boutique.tenantId, async () =>
      (await Settings.findOne().lean())?.nomMagasin,
    );
    expect(nom).toBe('Bependa');
  });
});
