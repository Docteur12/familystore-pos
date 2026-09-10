/**
 * `GET /api/settings/public` — l'identité AVANT connexion dépend du mode.
 *
 * Règle tranchée le 26/08/2026 (CLAUDE.md « Identité avant connexion ») :
 *  - single : un domaine par client, l'écran de connexion porte l'enseigne →
 *    la route rend l'identité complète et dit `mode: 'single'` ;
 *  - multi : origine partagée, on ne sait pas chez qui l'on entre → la route
 *    rend une réponse NEUTRE, sans nom ni logo, et dit `mode: 'multi'`.
 *    Elle répondait 500 (plugin fail-closed hors contexte tenant) ; le
 *    frontend retombait sur ses défauts par accident, pas par décision.
 */
import './helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DEFAULT_TENANT_ID, runWithTenant } from '../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest } from './helpers/db';

async function demarrer(mode: 'single' | 'multi'): Promise<INestApplication> {
  process.env.TENANT_MODE = mode;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

describe('GET /api/settings/public — identité selon le mode', () => {
  beforeAll(async () => { process.env.MONGO_URI = await ouvrirBaseDeTest(); }, 120_000);
  afterAll(async () => { await fermerBaseDeTest(); delete process.env.TENANT_MODE; });

  it('single : l’identité du magasin, et le mode annoncé', async () => {
    const app = await demarrer('single');
    try {
      const Settings: any = app.get(getModelToken('Settings'), { strict: false });
      await runWithTenant(DEFAULT_TENANT_ID, async () => {
        await Settings.deleteMany({});
        await Settings.create({ nomMagasin: 'HERVAN Élite', couleurPrincipale: '#1A1A1A', logoUrl: 'data:image/png;base64,AAA', langue: 'fr' });
      });

      const res = await request(app.getHttpServer()).get('/api/settings/public');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        mode: 'single', nomMagasin: 'HERVAN Élite', couleurPrincipale: '#1A1A1A', logoUrl: 'data:image/png;base64,AAA',
      });
      // Rien de sensible ne sort par cette route publique.
      expect(res.body).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('modules');
    } finally { await app.close(); }
  }, 60_000);

  it('multi : réponse NEUTRE — 200, pas 500, et aucune enseigne', async () => {
    const app = await demarrer('multi');
    try {
      const res = await request(app.getHttpServer()).get('/api/settings/public');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ mode: 'multi' });
    } finally { await app.close(); }
  }, 60_000);
});
