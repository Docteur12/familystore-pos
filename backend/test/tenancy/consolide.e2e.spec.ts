/**
 * Rapports consolidés — la seule dérogation qui traverse les boutiques.
 *
 * Chaque test d'isolation est accompagné d'un TÉMOIN : un cas qui prouve que
 * l'assertion regarde au bon endroit. Sans lui, « aucune fuite détectée » et
 * « le test ne détecte rien » se ressemblent trait pour trait — on vient d'en
 * faire la démonstration coûteuse sur la bascule de boutique, où des
 * assertions de sécurité passaient faute de jeton plutôt que par refus.
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

const BONAMOUSSADI = new Types.ObjectId();
const BEPENDA      = new Types.ObjectId();
const LOGPOM       = new Types.ObjectId();   // boutique d'un AUTRE propriétaire

/** Montants distincts : une somme fausse trahit immédiatement son origine. */
const CA = { bonamoussadi: 15_000, bependa: 4_000, logpom: 999_000 };

describe('Rapports consolidés — périmètre borné au jeton signé', () => {
  let app: INestApplication;
  let jwt: JwtService;

  /** Jeton forgé : `boutiques` est ce que le serveur aurait signé au login. */
  const jeton = (tenantId: Types.ObjectId, boutiques: Types.ObjectId[]) =>
    jwt.sign({
      v: 2, sub: new Types.ObjectId().toString(), email: 'proprio@test.cm',
      name: 'Propriétaire', role: 'patron',
      tenantId: String(tenantId), boutiques: boutiques.map(String),
    });

  const rapport = (jetonAcces: string, requete = '') =>
    request(app.getHttpServer())
      .get(`/api/consolide/rapport${requete}`)
      .set('Authorization', `Bearer ${jetonAcces}`);

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);

    const Sale: any     = app.get(getModelToken('Sale'), { strict: false });
    const Settings: any = app.get(getModelToken('Settings'), { strict: false });

    const plans = [
      [BONAMOUSSADI, 'Bonamoussadi', CA.bonamoussadi],
      [BEPENDA,      'Bependa',      CA.bependa],
      [LOGPOM,       'Logpom',       CA.logpom],
    ] as const;

    for (const [tenant, nom, montant] of plans) {
      await runWithTenant(tenant, async () => {
        await Settings.create({ nomMagasin: nom });
        await Sale.create({
          items: [{ name: `Article ${nom}`, quantity: 1, unitPrice: montant }],
          total: montant, subtotal: montant, paymentMethod: 'cash', amountPaid: montant,
        });
      });
    }
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  // ── Le cas nominal ─────────────────────────────────────────────────────────

  it('agrège les boutiques du propriétaire, chacune avec ses propres chiffres', async () => {
    const res = await rapport(jeton(BONAMOUSSADI, [BONAMOUSSADI, BEPENDA]));

    expect(res.status).toBe(200);
    const parNom = Object.fromEntries(res.body.boutiques.map((b: any) => [b.nom, b]));
    expect(Object.keys(parNom).sort()).toEqual(['Bependa', 'Bonamoussadi']);
    expect(parNom['Bonamoussadi'].ca).toBe(CA.bonamoussadi);
    expect(parNom['Bependa'].ca).toBe(CA.bependa);
    expect(res.body.total.ca).toBe(CA.bonamoussadi + CA.bependa);
    expect(res.body.total.ventes).toBe(2);
  });

  // ── Isolation, chaque cas suivi de son témoin ──────────────────────────────

  it("n'inclut PAS une boutique absente de la liste signée", async () => {
    const res = await rapport(jeton(BONAMOUSSADI, [BONAMOUSSADI]));

    expect(res.body.boutiques.map((b: any) => b.nom)).toEqual(['Bonamoussadi']);
    expect(res.body.total.ca).toBe(CA.bonamoussadi);
    expect(JSON.stringify(res.body)).not.toContain('Logpom');
    expect(JSON.stringify(res.body)).not.toContain(String(CA.logpom));
  });

  it('TÉMOIN — la même assertion voit bien Logpom quand il est légitimement dans la liste', async () => {
    // Si ce test échouait, celui du dessus ne prouverait rien : il pourrait
    // « ne pas trouver Logpom » simplement parce qu'il regarde au mauvais
    // endroit, ou parce que la boutique n'a aucune donnée.
    const res = await rapport(jeton(LOGPOM, [LOGPOM]));

    expect(JSON.stringify(res.body)).toContain('Logpom');
    expect(JSON.stringify(res.body)).toContain(String(CA.logpom));
    expect(res.body.total.ca).toBe(CA.logpom);
  });

  it("un identifiant passé en paramètre n'élargit pas le périmètre", async () => {
    const res = await rapport(
      jeton(BONAMOUSSADI, [BONAMOUSSADI]),
      `?boutiques=${LOGPOM}&boutiqueId=${LOGPOM}&tenantId=${LOGPOM}`,
    );

    expect(res.body.boutiques.map((b: any) => b.nom)).toEqual(['Bonamoussadi']);
    expect(res.body.total.ca).toBe(CA.bonamoussadi);
    expect(JSON.stringify(res.body)).not.toContain(String(CA.logpom));
  });

  it('TÉMOIN — ces mêmes paramètres, avec Logpom DANS la liste signée, donnent bien ses chiffres', async () => {
    // Prouve que le test précédent échoue pour la bonne raison : ce n'est pas
    // le paramètre qui est ignoré par accident, c'est la liste qui fait foi.
    const res = await rapport(
      jeton(LOGPOM, [LOGPOM]),
      `?boutiques=${LOGPOM}&boutiqueId=${LOGPOM}&tenantId=${LOGPOM}`,
    );

    expect(res.body.total.ca).toBe(CA.logpom);
  });

  it('une liste signée vide ne donne accès à rien', async () => {
    const res = await rapport(jeton(BONAMOUSSADI, []));

    expect(res.status).toBe(200);
    expect(res.body.boutiques).toEqual([]);
    expect(res.body.total.ca).toBe(0);
  });

  it('TÉMOIN — la détection porte bien sur des données réellement présentes', async () => {
    // Lecture BRUTE, hors de tout contexte tenant : les trois boutiques ont
    // des ventes. Sans ce témoin, « total.ca = 0 » pourrait venir d'une base
    // vide plutôt que d'un périmètre correctement borné.
    const Sale: any = app.get(getModelToken('Sale'), { strict: false });
    const toutes = await Sale.collection.find({}).toArray();
    expect(toutes).toHaveLength(3);
    expect(toutes.map((s: any) => s.total).sort((a: number, b: number) => a - b))
      .toEqual([CA.bependa, CA.bonamoussadi, CA.logpom].sort((a, b) => a - b));
  });

  it('sans jeton, aucun accès', async () => {
    const res = await request(app.getHttpServer()).get('/api/consolide/rapport');
    expect(res.status).toBe(401);
  });

  it("un jeton sans liste de boutiques ne consolide rien", async () => {
    const sansListe = jwt.sign({
      v: 2, sub: new Types.ObjectId().toString(), email: 'x@test.cm',
      name: 'X', role: 'patron', tenantId: String(BONAMOUSSADI),
    });
    const res = await rapport(sansListe);
    expect(res.body.boutiques).toEqual([]);
  });

  // ── La dérogation reste une dérogation ────────────────────────────────────

  it('chaque boutique est lue dans SON contexte : les chiffres ne se mélangent jamais', async () => {
    const res = await rapport(jeton(BONAMOUSSADI, [BONAMOUSSADI, BEPENDA]));
    const parNom = Object.fromEntries(res.body.boutiques.map((b: any) => [b.nom, b]));

    // Une requête unique décloisonnée donnerait la même somme aux deux lignes.
    expect(parNom['Bonamoussadi'].ca).not.toBe(parNom['Bependa'].ca);
    expect(parNom['Bonamoussadi'].ventes).toBe(1);
    expect(parNom['Bependa'].ventes).toBe(1);
  });
});
