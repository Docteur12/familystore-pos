/**
 * GET /api/sales/divers — la liste des articles à régulariser.
 *
 * Un article « divers » est une ligne vendue SANS produit au catalogue : c'est
 * pour ça qu'on la liste, afin de créer le produit ensuite. Une ligne marquée
 * `divers` qui porte pourtant un produit est déjà référencée — la lister
 * ferait « régulariser » un article qui existe. Défaut relevé le 12/09/2026.
 *
 * Témoin : le vrai divers reste listé, avec ses montants.
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DEFAULT_TENANT_ID, runWithTenant } from '../../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Articles divers à régulariser', () => {
  let app: INestApplication;
  let jeton: string;
  let jetonCaissier: string;
  const tenant = String(DEFAULT_TENANT_ID);
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    delete process.env.TENANT_MODE;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const jwt = app.get(JwtService);
    const signer = (role: string) => jwt.sign({ v: 2, sub: new Types.ObjectId().toString(), email: `${role}@test.cm`, name: role, role, tenantId: tenant, boutiques: [tenant] });
    jeton = signer('patron');
    jetonCaissier = signer('caissier');

    const Product: any = app.get(getModelToken('Product'), { strict: false });
    const Sale: any = app.get(getModelToken('Sale'), { strict: false });
    await runWithTenant(DEFAULT_TENANT_ID, async () => {
      const savon = await Product.create({ name: 'Savon Dove', price: 700, costPrice: 400, stock: 10 });
      await Sale.create({
        items: [
          { name: 'Sachet plastique', quantity: 3, unitPrice: 100, divers: true },                 // VRAI divers : sans produit
          { name: 'Savon Dove', quantity: 1, unitPrice: 700, divers: true, product: savon._id },   // marqué divers mais référencé
          { name: 'Savon Dove', quantity: 2, unitPrice: 700, product: savon._id },                 // ligne ordinaire
        ],
        total: 2400, subtotal: 2400, paymentMethod: 'cash', amountPaid: 2400, cashierName: 'Awa', caisseName: 'Caisse 01',
      });
    });
  }, 120_000);

  afterAll(async () => { await app.close(); await fermerBaseDeTest(); });

  it('TÉMOIN — le vrai divers (sans produit) est listé, avec ses montants', async () => {
    const res = await api().get('/api/sales/divers').set('Authorization', `Bearer ${jeton}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'Sachet plastique', quantity: 3, unitPrice: 100, total: 300, cashierName: 'Awa', caisseName: 'Caisse 01' });
  });

  it('une ligne divers qui porte un produit n’est PAS à régulariser', async () => {
    const res = await api().get('/api/sales/divers').set('Authorization', `Bearer ${jeton}`);
    expect(res.body.map((r: any) => r.name)).not.toContain('Savon Dove');
  });

  it('un caissier n’y a pas accès', async () => {
    expect((await api().get('/api/sales/divers').set('Authorization', `Bearer ${jetonCaissier}`)).status).toBe(403);
  });
});
