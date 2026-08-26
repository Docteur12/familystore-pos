/**
 * Correction et suppression d'une vente — QUI a le droit, et quelle trace.
 *
 * Le service est déjà couvert par `sales.service.spec.ts` : deltas de stock,
 * recalcul des montants, fenêtre de correction. Ce qu'il ne peut pas prouver,
 * c'est la couche HTTP — et c'est là que se joue le risque réel.
 *
 * Corriger une vente encaissée, c'est réécrire un chiffre d'affaires. Entre
 * les mains d'un caissier, cela permettrait d'effacer une erreur… ou un vol :
 * encaisser 3 articles, en remettre 1 au client, puis « corriger » le ticket à
 * 1 article. La caisse tomberait juste. C'est précisément le contrôle qu'un
 * test de service ne voit pas, parce qu'il appelle la méthode directement.
 *
 * Chaque refus est donc doublé d'un TÉMOIN : le même appel, par un patron,
 * doit réussir. Sans lui, un 403 dû à une charge utile mal formée ou à une
 * route absente passerait pour un contrôle d'accès qui fonctionne.
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

describe('Correction d’une vente — réservée au patron, et tracée', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let Product: any;
  let Sale: any;
  let AuditLog: any;

  const tenantId = new Types.ObjectId().toString();
  let jetonPatron = '';
  let jetonCaissier = '';
  let jetonGestionnaire = '';

  /** Jeton v2 — l'AuthGuard rejette tout jeton sans `v: 2`. */
  const jetonPour = (role: string, nom: string) => jwt.sign({
    v: 2, sub: new Types.ObjectId().toString(),
    email: `${role}@test.cm`, name: nom, role, tenantId, boutiques: [tenantId],
  });

  /**
   * Toute lecture ou écriture métier passe par ici.
   *
   * Le plugin de cloisonnement est FAIL-CLOSED : hors contexte tenant, il
   * lève — y compris sur les sous-documents d'une vente. Les requêtes HTTP
   * entrent dans ce contexte par le TenantInterceptor ; les fixtures d'un
   * test doivent le faire explicitement.
   */
  const dansBoutique = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tenantId, fn);

  /** Une vente fraîche et son produit, prêts à être corrigés. */
  async function venteAvecProduit(stock = 20) {
    return dansBoutique(async () => {
    const produit = await Product.create({
      tenant: tenantId, name: 'SAVON DOVE', price: 500, costPrice: 300,
      stock, initialStock: stock, category: 'Hygiène',
    });
    const vente = await Sale.create({
      tenant: tenantId,
      items: [{ product: produit._id, name: 'SAVON DOVE', quantity: 3, unitPrice: 500 }],
      subtotal: 1500, total: 1500, paymentMethod: 'cash', amountPaid: 2000, change: 500,
      cashierName: 'Caissière', caisseName: 'Caisse 01',
    });
    return { produit, vente };
    });
  }

  /** Corps d'une correction ramenant le ticket à 1 article. */
  const correction = (produitId: string) => ({
    items: [{ product: produitId, name: 'SAVON DOVE', quantity: 1, unitPrice: 500 }],
    motif: 'Client a rendu deux savons',
  });

  const patch = (id: string, jeton: string, corps: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(`/api/sales/${id}`)
      .set('Authorization', `Bearer ${jeton}`)
      .send(corps);

  const supprimer = (id: string, jeton: string, corps: Record<string, unknown>) =>
    request(app.getHttpServer())
      .delete(`/api/sales/${id}`)
      .set('Authorization', `Bearer ${jeton}`)
      .send(corps);

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    // MÊME configuration que `main.ts` : sans le ValidationPipe, les DTO ne
    // sont pas validés et le test conclurait que le motif n'est pas exigé,
    // alors qu'il l'est en production. Un test doit reproduire l'application
    // réelle, pas une version plus permissive.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwt = app.get(JwtService);
    Product  = app.get(getModelToken('Product'),  { strict: false });
    Sale     = app.get(getModelToken('Sale'),     { strict: false });
    AuditLog = app.get(getModelToken('AuditLog'), { strict: false });

    jetonPatron       = jetonPour('patron', 'Admin Patron');
    jetonCaissier     = jetonPour('caissier', 'Esther B.');
    jetonGestionnaire = jetonPour('gestionnaire', 'Samuel O.');
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  // ── Le contrôle d'accès ─────────────────────────────────────────────────

  describe('qui peut corriger', () => {
    it('un CAISSIER ne peut pas corriger une vente', async () => {
      const { produit, vente } = await venteAvecProduit();

      const res = await patch(String(vente._id), jetonCaissier, correction(String(produit._id)));

      expect(res.status).toBe(403);
      // Rien n'a bougé : ni le ticket, ni le stock.
      const apres: any = await dansBoutique(async () => Sale.findById(vente._id).lean());
      expect(apres.total).toBe(1500);
      expect(apres.items[0].quantity).toBe(3);
      expect((await dansBoutique(async () => Product.findById(produit._id).lean())).stock).toBe(20);
    });

    it('un GESTIONNAIRE ne peut pas corriger une vente', async () => {
      const { produit, vente } = await venteAvecProduit();
      const res = await patch(String(vente._id), jetonGestionnaire, correction(String(produit._id)));
      expect(res.status).toBe(403);
      expect((await dansBoutique(async () => Sale.findById(vente._id).lean())).total).toBe(1500);
    });

    it('sans jeton du tout, la route est fermée', async () => {
      const { produit, vente } = await venteAvecProduit();
      const res = await request(app.getHttpServer())
        .patch(`/api/sales/${String(vente._id)}`)
        .send(correction(String(produit._id)));
      expect(res.status).toBe(401);
    });

    // TÉMOIN — sans lui, les trois refus ci-dessus passeraient au vert même si
    // la route n'existait pas, ou si la charge utile était invalide.
    it('témoin — le PATRON, lui, corrige la vente', async () => {
      const { produit, vente } = await venteAvecProduit();

      const res = await patch(String(vente._id), jetonPatron, correction(String(produit._id)));

      expect(res.status).toBe(200);
      expect(res.body.ancienTotal).toBe(1500);
      expect(res.body.nouveauTotal).toBe(500);
      // Deux savons rendus au stock : 20 → 22.
      expect((await dansBoutique(async () => Product.findById(produit._id).lean())).stock).toBe(22);
    });

    it('un CAISSIER ne peut pas supprimer une vente', async () => {
      const { vente } = await venteAvecProduit();
      const res = await supprimer(String(vente._id), jetonCaissier, { motif: 'Vente annulée' });
      expect(res.status).toBe(403);
      expect(await dansBoutique(async () => Sale.findById(vente._id).lean())).not.toBeNull();
    });

    it('témoin — le PATRON, lui, supprime la vente', async () => {
      const { vente } = await venteAvecProduit();
      const res = await supprimer(String(vente._id), jetonPatron, { motif: 'Vente de test à retirer' });
      expect(res.status).toBe(200);
      expect(await dansBoutique(async () => Sale.findById(vente._id).lean())).toBeNull();
    });
  });

  // ── Le motif ────────────────────────────────────────────────────────────

  describe('le motif est exigé', () => {
    it('refuse une correction sans motif', async () => {
      const { produit, vente } = await venteAvecProduit();
      const { motif, ...sansMotif } = correction(String(produit._id));
      const res = await patch(String(vente._id), jetonPatron, sansMotif);
      expect(res.status).toBe(400);
      expect((await dansBoutique(async () => Sale.findById(vente._id).lean())).total).toBe(1500);
    });

    it('refuse un motif trop court pour dire quoi que ce soit', async () => {
      const { produit, vente } = await venteAvecProduit();
      const res = await patch(String(vente._id), jetonPatron, {
        ...correction(String(produit._id)), motif: 'ok',
      });
      expect(res.status).toBe(400);
    });

    it('refuse une suppression sans motif', async () => {
      const { vente } = await venteAvecProduit();
      const res = await supprimer(String(vente._id), jetonPatron, {});
      expect(res.status).toBe(400);
      expect(await dansBoutique(async () => Sale.findById(vente._id).lean())).not.toBeNull();
    });
  });

  // ── La trace ────────────────────────────────────────────────────────────

  describe('qui a corrigé quoi, et quand', () => {
    it('la vente garde l’état d’avant, l’auteur et l’horodatage', async () => {
      const { produit, vente } = await venteAvecProduit();
      const avant = Date.now();

      await patch(String(vente._id), jetonPatron, correction(String(produit._id)));

      const apres: any = await dansBoutique(async () => Sale.findById(vente._id).lean());
      expect(apres.modifications).toHaveLength(1);
      const m = apres.modifications[0];

      expect(m.parNom).toBe('Admin Patron');
      expect(m.parEmail).toBe('patron@test.cm');
      expect(m.motif).toBe('Client a rendu deux savons');
      expect(m.ancienTotal).toBe(1500);
      expect(m.nouveauTotal).toBe(500);
      // Horodatage réel, pas une valeur par défaut.
      expect(new Date(m.date).getTime()).toBeGreaterThanOrEqual(avant - 1000);
      // L'ORIGINAL reste rejouable : trois savons à 500.
      expect(m.anciensItems).toHaveLength(1);
      expect(m.anciensItems[0]).toMatchObject({ name: 'SAVON DOVE', quantity: 3, unitPrice: 500 });
    });

    it('deux corrections successives s’empilent, aucune n’écrase la précédente', async () => {
      const { produit, vente } = await venteAvecProduit();

      await patch(String(vente._id), jetonPatron, correction(String(produit._id)));
      await patch(String(vente._id), jetonPatron, {
        items: [{ product: String(produit._id), name: 'SAVON DOVE', quantity: 2, unitPrice: 500 }],
        motif: 'Le client en reprend un finalement',
      });

      const apres: any = await dansBoutique(async () => Sale.findById(vente._id).lean());
      expect(apres.modifications).toHaveLength(2);
      expect(apres.modifications[0]).toMatchObject({ ancienTotal: 1500, nouveauTotal: 500 });
      expect(apres.modifications[1]).toMatchObject({ ancienTotal: 500,  nouveauTotal: 1000 });
      // L'historique remonte jusqu'au ticket d'origine.
      expect(apres.modifications[0].anciensItems[0].quantity).toBe(3);
    });

    it('la correction est inscrite au journal d’audit, avec le motif', async () => {
      const { produit, vente } = await venteAvecProduit();

      await patch(String(vente._id), jetonPatron, correction(String(produit._id)));

      // Le journal est écrit sans être attendu par le contrôleur : on laisse
      // à l'écriture le temps d'arriver plutôt que de courir après.
      let entree: any = null;
      for (let i = 0; i < 20 && !entree; i++) {
        entree = await dansBoutique(async () => AuditLog.findOne({ module: 'ventes', type: 'modification', 'meta.saleId': String(vente._id) }).lean());
        if (!entree) await new Promise(r => setTimeout(r, 100));
      }

      expect(entree).not.toBeNull();
      expect(entree.actorName).toBe('Admin Patron');
      expect(entree.actorRole).toBe('patron');
      expect(entree.detail).toContain('Client a rendu deux savons');
      expect(entree.meta.saleId).toBe(String(vente._id));
    });
  });
});
