/**
 * Catalogue produits (PDF) — QUI peut le télécharger, et qu'il se génère.
 *
 * Le catalogue expose des données commerciales sensibles (prix d'achat via le
 * reste du produit, stocks, fournisseurs implicites) : la route est réservée
 * au patron par la couche HTTP (`@Roles('patron')` sur le contrôleur). Un test
 * de service ne verrait pas ce contrôle — il appelle la méthode directement.
 *
 * Chaque refus est doublé d'un TÉMOIN : le même appel, par un patron, doit
 * réussir ET rendre un vrai PDF. Sans lui, un 403 dû à une route absente ou à
 * un plantage passerait pour un contrôle d'accès qui fonctionne.
 */
import '../helpers/env';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';
import { runWithTenant } from '../../src/tenancy/tenant-context';

/** Rassemble le corps binaire de la réponse (supertest ne le fait pas seul). */
const parseurBinaire = (res: any, cb: (err: Error | null, body: Buffer) => void) => {
  const morceaux: Buffer[] = [];
  res.on('data', (c: Buffer) => morceaux.push(Buffer.from(c)));
  res.on('end', () => cb(null, Buffer.concat(morceaux)));
};

describe('Catalogue produits (PDF) — réservé au patron', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let Product: any;

  const tenantId = new Types.ObjectId().toString();
  let jetonPatron = '';
  let jetonCaissier = '';
  let jetonGestionnaire = '';

  const jetonPour = (role: string) => jwt.sign({
    v: 2, sub: new Types.ObjectId().toString(),
    email: `${role}@test.cm`, name: role, role, tenantId, boutiques: [tenantId],
  });

  const catalogue = (jeton?: string) => {
    const req = request(app.getHttpServer()).get('/api/reports/catalogue/pdf');
    if (jeton) req.set('Authorization', `Bearer ${jeton}`);
    return req.buffer().parse(parseurBinaire);
  };

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwt     = app.get(JwtService);
    Product = app.get(getModelToken('Product'), { strict: false });

    jetonPatron       = jetonPour('patron');
    jetonCaissier     = jetonPour('caissier');
    jetonGestionnaire = jetonPour('gestionnaire');

    // Deux produits du magasin — le plugin fail-closed exige le contexte tenant.
    await runWithTenant(tenantId, async () => {
      await Product.create({ tenant: tenantId, name: 'savon dove', price: 500, costPrice: 300, stock: 12, category: 'Cosmétique / Hygiène', subCategory: 'Hygiène corporelle' });
      await Product.create({ tenant: tenantId, name: 'riz 5 kg',   price: 8000, costPrice: 6000, stock: 20, category: 'Alimentation / Boissons', subCategory: 'Épicerie' });
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  it('un CAISSIER ne peut pas télécharger le catalogue', async () => {
    const res = await catalogue(jetonCaissier);
    expect(res.status).toBe(403);
  });

  it('un GESTIONNAIRE ne peut pas télécharger le catalogue', async () => {
    const res = await catalogue(jetonGestionnaire);
    expect(res.status).toBe(403);
  });

  it('sans jeton, la route est fermée', async () => {
    const res = await catalogue();
    expect(res.status).toBe(401);
  });

  // TÉMOIN — sans lui, les refus ci-dessus passeraient au vert même si la route
  // n'existait pas ou plantait.
  it('témoin — le PATRON télécharge un vrai PDF', async () => {
    const res = await catalogue(jetonPatron);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('catalogue-produits');
    // Vrais octets de PDF, pas un JSON d'erreur déguisé.
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
    expect(res.body.length).toBeGreaterThan(1000);
  });
});
