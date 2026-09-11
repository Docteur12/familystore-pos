/**
 * Product.stockSuivi — le seul changement du socle dans le noyau de vente
 * (CAMELEON-GAMME.md §2.3).
 *
 * Un plat, une nuitée, une boisson au verre se vendent sans stock : la vente
 * ne vérifie ni ne décrémente, n'écrit aucun mouvement — comme une ligne
 * « divers » — mais garde le produit sur la ligne (marge). Défaut `true` :
 * un produit ordinaire se comporte exactement comme avant, ce que ce test
 * prouve côte à côte, y compris à l'annulation.
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

describe('Vente — produits à stock non suivi', () => {
  let app: INestApplication;
  let jeton: string;
  let Product: any;
  let Movement: any;
  let plat: string;
  let boisson: string;
  const tenant = String(DEFAULT_TENANT_ID);

  const api = () => request(app.getHttpServer());
  // Une Query Mongoose est paresseuse : on l'AWAIT à l'intérieur du contexte,
  // sinon elle s'exécute après en être sortie et le plugin lève (CLAUDE.md).
  const dans = (fn: () => Promise<any>): Promise<any> => runWithTenant(DEFAULT_TENANT_ID, async () => await fn()) as Promise<any>;

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    delete process.env.TENANT_MODE;   // single : le tenant par défaut, comme les clients existants
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const jwt = app.get(JwtService);
    jeton = jwt.sign({ v: 2, sub: new Types.ObjectId().toString(), email: 'patron@test.cm', name: 'Patron', role: 'patron', tenantId: tenant, boutiques: [tenant] });
    Product = app.get(getModelToken('Product'), { strict: false });
    Movement = app.get(getModelToken('StockMovement'), { strict: false });

    await dans(async () => {
      const p = await Product.create({ name: 'Poulet DG', price: 5000, costPrice: 2500, stock: 0, stockSuivi: false });
      const b = await Product.create({ name: 'Coca 33cl', price: 600, costPrice: 350, stock: 10 });
      plat = String(p._id); boisson = String(b._id);
    });
  }, 120_000);

  afterAll(async () => { await app.close(); await fermerBaseDeTest(); });

  const vendre = (items: any[], cle: string) => api().post('/api/sales').set('Authorization', `Bearer ${jeton}`).send({
    items, total: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    subtotal: 0, paymentMethod: 'cash', amountPaid: 100_000, idempotencyKey: cle,
  });

  it('défaut stockSuivi = true : un produit existant n’a pas changé de comportement', async () => {
    const b = await dans(() => Product.findById(boisson).lean());
    expect(b.stockSuivi).toBe(true);
  });

  it('un plat à stock 0 se vend : ni refus, ni décrément, ni mouvement — le produit reste sur la ligne', async () => {
    const res = await vendre([
      { product: plat, name: 'Poulet DG', quantity: 2, unitPrice: 5000 },
      { product: boisson, name: 'Coca 33cl', quantity: 3, unitPrice: 600 },
    ], 'k-mixte');
    expect(res.status).toBe(201);

    const [p, b] = await dans(() => Promise.all([Product.findById(plat).lean(), Product.findById(boisson).lean()]));
    expect(p.stock).toBe(0);      // non suivi : intact
    expect(b.stock).toBe(7);      // suivi : 10 − 3

    const mouvements = await dans(() => Movement.find({ reason: 'sale' }).lean());
    expect(mouvements.map((m: any) => String(m.productId))).toEqual([boisson]);

    // La ligne du plat garde son produit : la marge (costPrice) reste calculable.
    expect(res.body.sale.items.find((i: any) => i.name === 'Poulet DG').product).toBe(plat);
  });

  it('le produit suivi, lui, est toujours refusé quand le stock manque', async () => {
    const res = await vendre([{ product: boisson, name: 'Coca 33cl', quantity: 50, unitPrice: 600 }], 'k-rupture');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Stock insuffisant/);
  });

  it('à l’annulation, seul le stock suivi est restitué', async () => {
    const vente = await vendre([
      { product: plat, name: 'Poulet DG', quantity: 1, unitPrice: 5000 },
      { product: boisson, name: 'Coca 33cl', quantity: 2, unitPrice: 600 },
    ], 'k-annulee');
    expect(vente.status).toBe(201);
    expect((await dans(() => Product.findById(boisson).lean())).stock).toBe(5);

    const suppression = await api().delete(`/api/sales/${vente.body.sale._id}`).set('Authorization', `Bearer ${jeton}`).send({ motif: 'Erreur de saisie' });
    expect(suppression.status).toBe(200);

    const [p, b] = await dans(() => Promise.all([Product.findById(plat).lean(), Product.findById(boisson).lean()]));
    expect(p.stock).toBe(0);
    expect(b.stock).toBe(7);
    const retours = await dans(() => Movement.find({ reason: 'annulation_vente' }).lean());
    expect(retours.map((m: any) => String(m.productId))).toEqual([boisson]);
  });
});
