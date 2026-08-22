/**
 * Suite d'isolation deux tenants — balayage de TOUTES les routes (lot 7).
 *
 * C'est le filet qui manquait : les autres suites vérifient le MÉCANISME
 * (plugin, populate, câblage) sur des schémas jetables. Celle-ci démarre
 * l'application réelle en mode `multi`, plante des données dans deux magasins
 * A et B, puis interroge chaque route au nom de A en exigeant que rien de B
 * n'apparaisse jamais.
 *
 * Deux campagnes :
 *  1. **Balayage des routes de lecture** — chaque GET sans paramètre est
 *     appelé au nom de A ; la réponse ne doit contenir aucun marqueur de B.
 *  2. **Accès direct par identifiant** — A demande les documents de B par leur
 *     `_id`. Une base cloisonnée répond « introuvable », jamais le document.
 *
 * ⚠️ Les jetons sont forgés ici avec `tenantId`, car `auth.service` ne le met
 * PAS dans le JWT (point de la phase 1 jamais réalisé). Tant que ce n'est pas
 * corrigé, le mode `multi` est inutilisable en vrai : même le login échoue,
 * faute de tenant au moment de chercher l'utilisateur. Ces tests éprouvent
 * donc l'isolation des routes indépendamment de la résolution du tenant à la
 * connexion, qui dépend d'une décision produit (code boutique au login).
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

const TENANT_A = new Types.ObjectId();
const TENANT_B = new Types.ObjectId();

/** Chaîne plantée UNIQUEMENT dans les données de B : elle ne doit jamais fuir. */
const MARQUEUR_B = 'ZZ-SECRET-MAGASIN-B';

describe("Isolation deux tenants — balayage des routes de l'application", () => {
  let app: INestApplication;
  let jwt: JwtService;
  let jetonA: string;
  const idsB: Record<string, string> = {};

  // Modèles peuplés dans les deux magasins (nom du modèle → fabrique de document).
  const SEMENCES: Record<string, (marque: string) => Record<string, unknown>> = {
    Product:  m => ({ name: `Produit ${m}`, price: 100, costPrice: 50, stock: 10, alertThreshold: 2, unit: 'pièce', category: m }),
    Caisse:   m => ({ nom: `Caisse ${m}`, code: m.slice(0, 6), pinKdf: 'x', pinSalt: 'y', ville: m }),
    Expense:  m => ({ label: `Dépense ${m}`, amount: 500, category: m, date: new Date() }),
    Fournisseur: m => ({ name: `Fournisseur ${m}`, contact: m }),
    Partenaire:  m => ({ name: `Partenaire ${m}`, type: 'structure', ville: m }),
  };

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    jwt = app.get(JwtService);

    // Données des deux magasins. Celles de B portent le marqueur.
    for (const [tenant, marque] of [[TENANT_A, 'MAGASIN-A'], [TENANT_B, MARQUEUR_B]] as const) {
      await runWithTenant(tenant, async () => {
        for (const [modele, fabrique] of Object.entries(SEMENCES)) {
          let model: any;
          try { model = app.get(getModelToken(modele), { strict: false }); } catch { continue; }
          if (!model) continue;
          const doc = await model.create(fabrique(marque));
          if (marque === MARQUEUR_B) idsB[modele] = String(doc._id);
        }
      });
    }

    // Jeton de A — forgé : auth.service n'émet pas de tenantId (voir en-tête).
    jetonA = jwt.sign({
      v: 2, sub: new Types.ObjectId().toString(), email: 'patron-a@test.cm',
      name: 'Patron A', role: 'patron', tenantId: String(TENANT_A),
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  /** Toutes les routes GET exposées par l'application, telles que montées par Express. */
  function routesGet(): string[] {
    const pile = (app.getHttpAdapter().getInstance() as any)._router?.stack ?? [];
    const routes: string[] = [];
    for (const couche of pile) {
      const chemin = couche.route?.path;
      if (!chemin || !couche.route.methods?.get) continue;
      routes.push(Array.isArray(chemin) ? chemin[0] : chemin);
    }
    return [...new Set(routes)];
  }

  it("expose bien des routes à contrôler (garde-fou du balayage)", () => {
    expect(routesGet().length).toBeGreaterThan(20);
  });

  it('aucune route de lecture ne divulgue les données du magasin B', async () => {
    const sansParametre = routesGet().filter(r => !r.includes(':'));
    const fuites: string[] = [];
    let repondues = 0;

    for (const route of sansParametre) {
      const res = await request(app.getHttpServer()).get(route).set('Authorization', `Bearer ${jetonA}`);
      // 4xx/5xx : la route refuse ou échoue — elle ne divulgue rien.
      if (res.status !== 200) continue;
      repondues++;
      const corps = JSON.stringify(res.body ?? '');
      if (corps.includes(MARQUEUR_B) || Object.values(idsB).some(id => corps.includes(id))) {
        fuites.push(`${route} → ${corps.slice(0, 200)}`);
      }
    }

    expect(fuites).toEqual([]);
    // Garde-fou : sans lui, la suite passerait « au vert » si toutes les routes
    // se mettaient à échouer (401, 500…) — elle ne prouverait alors plus rien.
    // Relevé du 21/08/2026 : 62 routes balayées, 60 en 200.
    expect(repondues).toBeGreaterThanOrEqual(50);
  }, 120_000);

  it('un document du magasin B reste introuvable pour le magasin A, même par son identifiant', async () => {
    const parametrees = routesGet().filter(r => /:[A-Za-z]+/.test(r));
    const fuites: string[] = [];

    for (const modele of Object.keys(idsB)) {
      const idB = idsB[modele];
      for (const route of parametrees) {
        const chemin = route.replace(/:[A-Za-z]+/g, idB);
        const res = await request(app.getHttpServer()).get(chemin).set('Authorization', `Bearer ${jetonA}`);
        if (res.status !== 200) continue;
        const corps = JSON.stringify(res.body ?? '');
        if (corps.includes(MARQUEUR_B) || corps.includes(idB)) {
          fuites.push(`${chemin} (${modele}) → ${corps.slice(0, 200)}`);
        }
      }
    }

    expect(fuites).toEqual([]);
  }, 180_000);

  it('témoin — la détection fonctionne : une lecture non cloisonnée, elle, voit bien B', async () => {
    // Sans ce témoin, les deux tests précédents pourraient passer parce que le
    // marqueur n'est jamais planté ou jamais comparé. Ici on lit la collection
    // en contournant délibérément le plugin : B DOIT apparaître.
    const model: any = app.get(getModelToken('Product'), { strict: false });
    const brut = await model.collection.find({}).toArray();
    expect(JSON.stringify(brut)).toContain(MARQUEUR_B);
  }, 30_000);

  it('sans tenant dans le jeton, tout accès échoue (fail-closed)', async () => {
    const jetonSansTenant = jwt.sign({
      v: 2, sub: new Types.ObjectId().toString(), email: 'sans@test.cm',
      name: 'Sans tenant', role: 'patron',
    });
    const res = await request(app.getHttpServer()).get('/api/products').set('Authorization', `Bearer ${jetonSansTenant}`);
    expect(res.status).not.toBe(200);
  }, 30_000);
});
