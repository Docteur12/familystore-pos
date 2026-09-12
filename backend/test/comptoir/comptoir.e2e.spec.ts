/**
 * Profil Snack-bar — contrôle d'accès et câblage HTTP du module.
 *
 * Le module est monté SEUL (phase 1 : `app.module.ts` est un fichier partagé,
 * `ComptoirModule` n'y est pas encore importé), avec les mêmes pièces que
 * l'application réelle : plugin tenant sur la connexion, `TenancyModule`,
 * `PlatformModule` et `AuthModule` (gardes), `AuditModule`, `ValidationPipe`
 * en `whitelist`.
 *
 * Pour chaque groupe de routes, le 403 d'un rôle exclu ET un témoin 200/201
 * d'un rôle admis — sans témoin, un 403 généralisé (garde mal câblée)
 * passerait « au vert ».
 */
import '../helpers/env';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as request from 'supertest';

import { ComptoirModule } from '../../src/comptoir/comptoir.module';
import { TenancyModule } from '../../src/tenancy/tenancy.module';
import { tenantPlugin } from '../../src/tenancy/tenant.plugin';
import { DEFAULT_TENANT_ID, runWithTenant } from '../../src/tenancy/tenant-context';
import { AuditModule } from '../../src/audit/audit.module';
import { PlatformModule } from '../../src/platform/platform.module';
import { CATEGORIE_DEPENSE_CONSIGNE, ROLES_COMPTOIR, ROLES_RESERVE } from '../../src/comptoir/motifs';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Snack — routes /api/snack : rôles, validation, tenant', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let Product: any;
  let Expense: any;
  let AuditLog: any;
  let Conditionnement: any;
  let produitId: string;

  const jeton = (role: string) => jwt.sign({
    v: 2, sub: new Types.ObjectId().toString(), email: `${role}@snack.cm`, name: `Test ${role}`, role,
    tenantId: String(DEFAULT_TENANT_ID), boutiques: [String(DEFAULT_TENANT_ID)],
  });

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'single';
    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({
            uri,
            connectionFactory: (connection: Connection) => { connection.plugin(tenantPlugin); return connection; },
          }),
        }),
        PlatformModule,   // global — AuthService en dépend (registre des boutiques, licence)
        TenancyModule,
        AuditModule,
        ComptoirModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwt             = app.get(JwtService);
    Product         = app.get(getModelToken('Product'),              { strict: false });
    Expense         = app.get(getModelToken('Expense'),              { strict: false });
    AuditLog        = app.get(getModelToken('AuditLog'),             { strict: false });
    Conditionnement = app.get(getModelToken('ConditionnementSnack'), { strict: false });

    const p = await runWithTenant(DEFAULT_TENANT_ID, async () => Product.create({
      name: 'castel 65cl', price: 700, costPrice: 500, stock: 24, alertThreshold: 6, unit: 'bouteille', category: 'bières',
    }));
    produitId = String(p._id);
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  const api = () => request(app.getHttpServer());
  const en  = (role: string) => `Bearer ${jeton(role)}`;

  it('sans jeton : 401 partout', async () => {
    expect((await api().get('/api/comptoir/reserve')).status).toBe(401);
    expect((await api().post('/api/comptoir/consignes/retours').send({})).status).toBe(401);
  });

  // ── Conditionnements ──────────────────────────────────────────────────────

  it('définir un conditionnement : 403 pour le caissier et le commercial, 200 pour le magasinier (témoin)', async () => {
    const corps = { bouteillesParCasier: 24, consigne: 200 };
    expect((await api().put(`/api/comptoir/conditionnements/${produitId}`).set('Authorization', en('caissier')).send(corps)).status).toBe(403);
    expect((await api().put(`/api/comptoir/conditionnements/${produitId}`).set('Authorization', en('commercial')).send(corps)).status).toBe(403);

    const ok = await api().put(`/api/comptoir/conditionnements/${produitId}`).set('Authorization', en('magazinier')).send(corps);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ bouteillesParCasier: 24, consigne: 200, videsEnReserve: 0 });

    // Le document porte le tenant posé par le plugin — en mode single, celui par défaut.
    const doc = await runWithTenant(DEFAULT_TENANT_ID, async () => Conditionnement.findOne({}).lean());
    expect(String(doc.tenant)).toBe(String(DEFAULT_TENANT_ID));
  });

  it('lire les conditionnements : le caissier y a accès (il vend), le commercial non', async () => {
    const ok = await api().get('/api/comptoir/conditionnements').set('Authorization', en('caissier'));
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveLength(1);
    expect((await api().get('/api/comptoir/conditionnements').set('Authorization', en('commercial'))).status).toBe(403);
  });

  it('validation : champs hors DTO ignorés, valeurs impossibles refusées (400)', async () => {
    const r1 = await api().put(`/api/comptoir/conditionnements/${produitId}`).set('Authorization', en('patron'))
      .send({ bouteillesParCasier: 0, consigne: 200 });
    expect(r1.status).toBe(400);
    const r2 = await api().put(`/api/comptoir/conditionnements/${produitId}`).set('Authorization', en('patron'))
      .send({ bouteillesParCasier: 12, consigne: -5 });
    expect(r2.status).toBe(400);
    const r3 = await api().post('/api/comptoir/reserve/receptions').set('Authorization', en('patron'))
      .send({ productId: 'pas-un-id', casiers: 1 });
    expect(r3.status).toBe(400);
  });

  // ── Réserve ───────────────────────────────────────────────────────────────

  it('réserve : 403 pour le caissier, 200 pour chaque rôle de la réserve (témoins)', async () => {
    expect((await api().get('/api/comptoir/reserve').set('Authorization', en('caissier'))).status).toBe(403);
    for (const role of ROLES_RESERVE) {
      const r = await api().get('/api/comptoir/reserve').set('Authorization', en(role));
      expect(r.status).toBe(200);
      expect(r.body[0]).toMatchObject({ productId: produitId, nomProduit: 'Castel 65cl', casiersPleins: 1, bouteillesSeules: 0 });
    }
  });

  it('réception de casiers : 403 caissier, 201 gestionnaire, stock crédité, audit journalisé', async () => {
    const corps = { productId: produitId, casiers: 2, note: 'Livreur', idempotencyKey: 'e2e-rec-1' };
    expect((await api().post('/api/comptoir/reserve/receptions').set('Authorization', en('caissier')).send(corps)).status).toBe(403);

    const r = await api().post('/api/comptoir/reserve/receptions').set('Authorization', en('gestionnaire')).send(corps);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ rejeu: false, stock: 72 });
    expect(r.body.reception).toMatchObject({ casiers: 2, bouteilles: 48, auteurNom: 'Test gestionnaire' });

    const rejeu = await api().post('/api/comptoir/reserve/receptions').set('Authorization', en('gestionnaire')).send(corps);
    expect(rejeu.status).toBe(201);
    expect(rejeu.body.rejeu).toBe(true);

    const liste = await api().get('/api/comptoir/reserve/receptions').set('Authorization', en('patron'));
    expect(liste.status).toBe(200);
    expect(liste.body).toHaveLength(1);

    const journal = await runWithTenant(DEFAULT_TENANT_ID, async () => AuditLog.find({ module: 'snack', type: 'reception_casier' }).lean());
    expect(journal).toHaveLength(1);   // le rejeu n'est pas journalisé deux fois
    expect(journal[0].detail).toContain('2 casier(s)');
  });

  it('casse : 403 caissier, 201 magasinier, stock débité', async () => {
    const corps = { productId: produitId, bouteilles: 2, note: 'tombée' };
    expect((await api().post('/api/comptoir/reserve/casse').set('Authorization', en('caissier')).send(corps)).status).toBe(403);
    const r = await api().post('/api/comptoir/reserve/casse').set('Authorization', en('magazinier')).send(corps);
    expect(r.status).toBe(201);
    expect(r.body.stock).toBe(70);
  });

  // ── Consignes ─────────────────────────────────────────────────────────────

  it('retour de vide : 403 pour le magasinier et le commercial, 201 pour chaque rôle du comptoir (témoins), dépense créée', async () => {
    expect((await api().post('/api/comptoir/consignes/retours').set('Authorization', en('magazinier')).send({ productId: produitId, quantite: 1 })).status).toBe(403);
    expect((await api().post('/api/comptoir/consignes/retours').set('Authorization', en('commercial')).send({ productId: produitId, quantite: 1 })).status).toBe(403);

    for (const role of ROLES_COMPTOIR) {
      const r = await api().post('/api/comptoir/consignes/retours').set('Authorization', en(role)).send({ productId: produitId, quantite: 1 });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ montant: 200, rejeu: false });
      expect(r.body.mouvement).toMatchObject({ sens: 'rendue', auteurNom: `Test ${role}` });
    }
    const depenses = await runWithTenant(DEFAULT_TENANT_ID, async () => Expense.find({ category: CATEGORIE_DEPENSE_CONSIGNE }).lean());
    expect(depenses).toHaveLength(ROLES_COMPTOIR.length);
    expect(depenses.every((d: any) => d.amount === 200)).toBe(true);
  });

  it('rapport des consignes du jour : 403 caissier, 200 patron, rendues = 3 × 200', async () => {
    expect((await api().get('/api/comptoir/consignes/jour').set('Authorization', en('caissier'))).status).toBe(403);
    const r = await api().get('/api/comptoir/consignes/jour').set('Authorization', en('patron'));
    expect(r.status).toBe(200);
    expect(r.body.rendues).toEqual({ quantite: 3, montant: 600 });
    expect(r.body.encaissees).toEqual({ quantite: 0, montant: 0 });
    expect(r.body.solde).toBe(-600);
    expect((await api().get('/api/comptoir/consignes/jour?date=2026-13-45').set('Authorization', en('patron'))).status).toBe(400);
  });
});
