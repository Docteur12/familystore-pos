/**
 * Limitation de débit — test e2e de la SPÉCIFICATION, pas de l'implémentation.
 *
 * Spécification d'origine (correctifs de sécurité) :
 *   - POST /api/auth/login          : 5 tentatives / minute, puis 429 ;
 *   - POST /api/auth/forgot-password : 3 tentatives / 15 minutes, puis 429 ;
 *   - un compte ne doit jamais être bloqué parce qu'un AUTRE a épuisé sa
 *     limite (les caissiers d'une boutique partagent souvent la même IP).
 *
 * Le point dur : derrière les proxys (Netlify, Render), l'identité « IP »
 * vient de l'en-tête X-Forwarded-For, que le client peut forger. Un limiteur
 * correct doit donc bloquer un attaquant MÊME s'il présente une IP différente
 * à chaque requête. C'est exactement ce que rejouent ces tests.
 *
 * La configuration réseau reproduit main.ts à l'identique :
 * trust proxy = TRUST_PROXY_HOPS (défaut 2), préfixe /api, garde globale.
 */
import './helpers/env'; // JWT_SECRET — AVANT tout import d'AppModule
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ouvrirBaseDeTest, fermerBaseDeTest } from './helpers/db';

describe('Limitation de débit — POST /api/auth/login et /forgot-password', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // La base en mémoire DOIT être prête avant la compilation du module :
    // MongooseModule.forRootAsync lit MONGO_URI à l'initialisation.
    process.env.MONGO_URI = await ouvrirBaseDeTest();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // ── Réplique exacte de main.ts ────────────────────────────────────────
    const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 2);
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
    app.setGlobalPrefix('api');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
  });

  function tentativeLogin(email: string, xForwardedFor?: string) {
    let req = request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'mauvais-mot-de-passe' });
    if (xForwardedFor) req = req.set('X-Forwarded-For', xForwardedFor);
    return req;
  }

  // ──────────────────────────────────────────────────────────────────────────

  it('bloque à partir de la 6e tentative sur le même compte (10 essais → 5×401 puis 5×429)', async () => {
    const codes: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const res = await tentativeLogin('cible@boutique.cm');
      codes.push(res.status);
    }
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes.slice(5)).toEqual([429, 429, 429, 429, 429]);
  });

  it("bloque un attaquant MÊME s'il forge une IP différente à chaque requête (X-Forwarded-For)", async () => {
    const codes: number[] = [];
    for (let i = 1; i <= 10; i++) {
      // Chaque tentative se présente avec une adresse IP différente —
      // c'est trivial à faire avec curl, donc un vrai attaquant le fera.
      const res = await tentativeLogin('patron@boutique.cm', `203.0.113.${i}`);
      codes.push(res.status);
    }
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes.slice(5)).toEqual([429, 429, 429, 429, 429]);
  });

  it("ne bloque PAS un 2e compte quand un 1er a épuisé sa limite (caissiers derrière la même IP)", async () => {
    // La caissière n°1 épuise sa limite…
    for (let i = 1; i <= 6; i++) {
      await tentativeLogin('caissiere1@boutique.cm');
    }
    // …la caissière n°2, depuis la même adresse, doit pouvoir se connecter :
    // 401 (mauvais mot de passe) et surtout PAS 429.
    const res = await tentativeLogin('caissiere2@boutique.cm');
    expect(res.status).toBe(401);
  });

  it('forgot-password : 3 tentatives puis 429, insensible aux IP forgées', async () => {
    const codes: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .set('X-Forwarded-For', `198.51.100.${i}`)
        .send({ email: 'victime@boutique.cm' });
      codes.push(res.status);
    }
    // Réponse neutre (200) que le compte existe ou non — puis blocage.
    expect(codes.slice(0, 3)).toEqual([200, 200, 200]);
    expect(codes.slice(3)).toEqual([429, 429]);
  });
});
