/**
 * Rapport consolidé à types MÉLANGÉS (socle de la gamme, CAMELEON-GAMME.md §2.5).
 *
 * Un propriétaire qui tient une boutique, un snack et un hôtel doit lire ses
 * métiers séparément : chaque ligne porte le type, le total porte un
 * sous-total par type. La source reste `Sale`, boutique par boutique, dans le
 * périmètre du jeton — rien ne change pour un propriétaire mono-type, et le
 * TÉMOIN le prouve : sans type dans Settings, la ligne vaut « commerce ».
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { runWithTenant } from '../../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

const BOUTIQUE = new Types.ObjectId();
const SNACK    = new Types.ObjectId();
const HOTEL    = new Types.ObjectId();
const ANCIENNE = new Types.ObjectId();   // Settings d'avant le socle : pas de typeEtablissement

const CA = { boutique: 10_000, snack: 3_000, hotel: 40_000, ancienne: 500 };

describe('Consolidé — types d’établissement mélangés', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const jeton = (boutiques: Types.ObjectId[]) => jwt.sign({
    v: 2, sub: new Types.ObjectId().toString(), email: 'proprio@test.cm', name: 'Proprio', role: 'patron',
    tenantId: String(boutiques[0]), boutiques: boutiques.map(String),
  });
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);

    const Sale: any = app.get(getModelToken('Sale'), { strict: false });
    const Settings: any = app.get(getModelToken('Settings'), { strict: false });
    const plans: [Types.ObjectId, string, string | undefined, number][] = [
      [BOUTIQUE, 'Boutique Akwa', 'commerce', CA.boutique],
      [SNACK,    'Snack Deido',   'snack',    CA.snack],
      [HOTEL,    'Hôtel Bonanjo', 'hotel',    CA.hotel],
      [ANCIENNE, 'Ancienne',      undefined,  CA.ancienne],
    ];
    for (const [tenant, nom, type, montant] of plans) {
      await runWithTenant(tenant, async () => {
        await Settings.create(type ? { nomMagasin: nom, typeEtablissement: type } : { nomMagasin: nom });
        if (!type) await Settings.updateOne({}, { $unset: { typeEtablissement: '' } }).exec();   // vraiment absent
        await Sale.create({
          items: [{ name: `Article ${nom}`, quantity: 1, unitPrice: montant }],
          total: montant, subtotal: montant, paymentMethod: 'cash', amountPaid: montant,
        });
      });
    }
  }, 120_000);

  afterAll(async () => { await app.close(); await fermerBaseDeTest(); delete process.env.TENANT_MODE; });

  it('chaque ligne porte son type ; le total porte un sous-total exact par type', async () => {
    const res = await api().get('/api/consolide/rapport').set('Authorization', `Bearer ${jeton([BOUTIQUE, SNACK, HOTEL, ANCIENNE])}`);
    expect(res.status).toBe(200);

    const parNom = Object.fromEntries(res.body.boutiques.map((b: any) => [b.nom, b]));
    expect(parNom['Boutique Akwa'].typeEtablissement).toBe('commerce');
    expect(parNom['Snack Deido'].typeEtablissement).toBe('snack');
    expect(parNom['Hôtel Bonanjo'].typeEtablissement).toBe('hotel');
    // TÉMOIN : un Settings d'avant le socle compte comme commerce.
    expect(parNom['Ancienne'].typeEtablissement).toBe('commerce');

    expect(res.body.total.ca).toBe(CA.boutique + CA.snack + CA.hotel + CA.ancienne);
    expect(res.body.total.parType).toEqual({
      commerce: { ca: CA.boutique + CA.ancienne, ventes: 2, boutiques: 2 },
      snack:    { ca: CA.snack, ventes: 1, boutiques: 1 },
      hotel:    { ca: CA.hotel, ventes: 1, boutiques: 1 },
    });
  });

  it('le périmètre reste borné au jeton : hors périmètre, ni ligne ni sous-total', async () => {
    const res = await api().get('/api/consolide/rapport').set('Authorization', `Bearer ${jeton([SNACK])}`);
    expect(res.body.boutiques.map((b: any) => b.nom)).toEqual(['Snack Deido']);
    expect(res.body.total.parType).toEqual({ snack: { ca: CA.snack, ventes: 1, boutiques: 1 } });
    expect(JSON.stringify(res.body)).not.toContain('Bonanjo');
  });

  it('la liste des boutiques du propriétaire porte le type (pour le sélecteur)', async () => {
    const res = await api().get('/api/consolide/boutiques').set('Authorization', `Bearer ${jeton([BOUTIQUE, HOTEL])}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { boutiqueId: String(BOUTIQUE), nom: 'Boutique Akwa', typeEtablissement: 'commerce' },
      { boutiqueId: String(HOTEL),    nom: 'Hôtel Bonanjo', typeEtablissement: 'hotel' },
    ]);
  });
});
