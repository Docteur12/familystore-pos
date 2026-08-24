/**
 * Parcours critique n°1 — la vente.
 *
 * C'est le chemin qui fait vivre la boutique : chaque bug ici est une perte
 * d'argent ou de stock. Ces tests traversent la vraie pile Mongoose (base en
 * mémoire) pour rester valables quand le plugin multi-tenant s'ajoutera aux
 * schémas.
 *
 * Couvert :
 *  - vente simple : enregistrement, décrément du stock, mouvement OUT, monnaie
 *  - stock insuffisant : refus AVANT toute écriture
 *  - idempotence : la même clé rejouée ne crée ni 2e vente ni 2e décrément
 *  - vente forcée : passe malgré le stock, trace un écart
 *  - alerte : franchir le seuil remonte une alerte de stock bas
 *  - article « divers » : vendu sans produit référencé, aucun mouvement
 */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

import { SalesService, FENETRE_CORRECTION_JOURS } from '../src/sales/sales.service';
import { MailService } from '../src/mail/mail.service';
import { Settings, SettingsSchema } from '../src/settings/settings.schema';
import { Sale, SaleSchema } from '../src/schemas/sale.schema';
import { Product, ProductSchema, ProductDocument } from '../src/schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../src/schemas/stock-movement.schema';
import { EcartStock, EcartStockSchema } from '../src/schemas/ecart-stock.schema';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from './helpers/db';

describe('SalesService — parcours de vente', () => {
  let module: TestingModule;
  let service: SalesService;
  let connection: Connection;
  let productModel: Model<ProductDocument>;
  let saleModel: Model<any>;
  let movementModel: Model<any>;
  let ecartModel: Model<any>;

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: Sale.name,          schema: SaleSchema },
          { name: Product.name,       schema: ProductSchema },
          { name: StockMovement.name, schema: StockMovementSchema },
          { name: EcartStock.name,    schema: EcartStockSchema },
          { name: Settings.name,      schema: SettingsSchema },
        ]),
      ],
      providers: [SalesService, MailService],
    }).compile();

    service       = module.get(SalesService);
    connection    = module.get(getConnectionToken());
    productModel  = module.get(getModelToken(Product.name));
    saleModel     = module.get(getModelToken(Sale.name));
    movementModel = module.get(getModelToken(StockMovement.name));
    ecartModel    = module.get(getModelToken(EcartStock.name));
  });

  afterAll(async () => {
    await module.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => {
    await viderCollections(connection);
  });

  /** Produit de travail : 20 en stock, alerte à 5, vendu 500 F. */
  async function creerProduit(surcharges: Partial<Product> = {}): Promise<ProductDocument> {
    return productModel.create({
      name: 'Savon 200g',
      price: 500,
      costPrice: 350,
      stock: 20,
      alertThreshold: 5,
      category: 'hygiène',
      ...surcharges,
    });
  }

  function dtoVente(produit: ProductDocument, surcharges: Record<string, any> = {}) {
    return {
      items: [{ product: String(produit._id), name: produit.name, quantity: 3, unitPrice: 500 }],
      total: 1500,
      paymentMethod: 'cash',
      amountPaid: 2000,
      ...surcharges,
    } as any;
  }

  const actor = { name: 'Caissière Test', email: 'caisse@test.local', role: 'caissier', caisse: { nom: 'Caisse 01' } };

  // ────────────────────────────────────────────────────────────────────────────

  it('enregistre une vente : stock décrémenté, mouvement OUT, monnaie rendue', async () => {
    const produit = await creerProduit();

    const resultat = await service.create(dtoVente(produit), actor);

    // La vente est enregistrée avec les bons montants et la traçabilité
    expect(resultat.change).toBe(500);
    expect(resultat.sale.total).toBe(1500);
    expect(resultat.sale.cashierName).toBe('Caissière Test');
    expect(resultat.sale.caisseName).toBe('Caisse 01');

    // Le stock est passé de 20 à 17
    const apres = await productModel.findById(produit._id).lean();
    expect(apres!.stock).toBe(17);

    // Un mouvement OUT de 3 tracé pour ce produit
    const mouvements = await movementModel.find({ productId: produit._id }).lean();
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]).toMatchObject({ type: 'OUT', quantity: 3, reason: 'sale' });
  });

  it('refuse la vente si le stock est insuffisant, sans rien écrire', async () => {
    const produit = await creerProduit({ stock: 2 });

    await expect(service.create(dtoVente(produit), actor)) // demande 3, dispo 2
      .rejects.toThrow(BadRequestException);

    // AUCUNE écriture : ni vente, ni mouvement, ni décrément
    expect(await saleModel.countDocuments()).toBe(0);
    expect(await movementModel.countDocuments()).toBe(0);
    const apres = await productModel.findById(produit._id).lean();
    expect(apres!.stock).toBe(2);
  });

  it("rejoue la même clé d'idempotence sans créer de doublon ni re-décrémenter", async () => {
    const produit = await creerProduit();
    const dto = dtoVente(produit, { idempotencyKey: 'sync-offline-abc123' });

    const premier = await service.create(dto, actor);
    const rejeu   = await service.create(dto, actor); // réessai réseau / synchro

    // Même vente renvoyée, pas une nouvelle
    expect(String(rejeu.sale._id)).toBe(String(premier.sale._id));
    expect(await saleModel.countDocuments()).toBe(1);

    // Le stock n'a été décrémenté qu'une seule fois : 20 - 3 = 17
    const apres = await productModel.findById(produit._id).lean();
    expect(apres!.stock).toBe(17);
    expect(await movementModel.countDocuments()).toBe(1);
  });

  it('vente forcée : passe malgré le stock insuffisant et trace un écart', async () => {
    const produit = await creerProduit({ stock: 1 });

    const resultat = await service.create(
      dtoVente(produit, {
        forceVente: true,
        ecarts: [{
          produit:        String(produit._id),
          nomProduit:     produit.name,
          stockSysteme:   1,
          quantiteVendue: 3,
          ecart:          -2,
        }],
      }),
      actor,
    );

    expect(resultat.sale.total).toBe(1500);

    // L'écart est enregistré, attribué à la caissière, en attente de résolution
    const ecarts = await ecartModel.find().lean();
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({
      ecart:         -2,
      caissiereName: 'Caissière Test',
      statut:        'en_attente',
    });

    // Le stock suit réellement la vente (1 - 3 = -2) : c'est le comportement
    // actuel — l'écart négatif matérialise la marchandise vendue sans stock.
    const apres = await productModel.findById(produit._id).lean();
    expect(apres!.stock).toBe(-2);
  });

  it("remonte une alerte quand la vente fait passer le stock sous le seuil", async () => {
    const produit = await creerProduit({ stock: 7, alertThreshold: 5 });

    const resultat = await service.create(dtoVente(produit), actor); // 7 - 3 = 4 ≤ 5

    expect(resultat.alerts).toHaveLength(1);
    expect(resultat.alerts[0]).toMatchObject({
      productId: String(produit._id),
      stock: 4,
      alertThreshold: 5,
    });
  });

  it("vend un article « divers » sans produit référencé : aucun mouvement de stock", async () => {
    const resultat = await service.create(
      {
        items: [{ divers: true, name: 'Sachet cadeau', quantity: 2, unitPrice: 100 }],
        total: 200,
        paymentMethod: 'cash',
        amountPaid: 200,
      } as any,
      actor,
    );

    expect(resultat.sale.total).toBe(200);
    expect(resultat.change).toBe(0);
    expect(await movementModel.countDocuments()).toBe(0);
  });

  // ── Correction d'une vente (client revenu avec son ticket) ─────────────────
  //
  // C'est le seul endroit où une vente déjà encaissée est réécrite : chaque test
  // ci-dessous protège soit l'argent, soit le stock, soit la traçabilité.

  describe('modifier — correction par le patron', () => {
    const patron = { name: 'Admin Patron', email: 'admin@test.local' };

    it('baisse la quantité : stock rendu au delta, total et monnaie recalculés', async () => {
      const produit = await creerProduit();                       // stock 20
      const { sale } = await service.create(dtoVente(produit), actor);  // 3 vendus → 17

      const res = await service.modifier(
        String(sale._id),
        {
          items: [{ product: String(produit._id), name: produit.name, quantity: 1, unitPrice: 500 }],
          motif: 'Client a rendu 2 savons',
        } as any,
        patron,
      );

      // Montants recalculés côté serveur : 1 × 500, et 2000 remis → 1500 rendus
      expect(res.sale.total).toBe(500);
      expect(res.sale.change).toBe(1500);
      expect(res.ancienTotal).toBe(1500);

      // Stock : 17 + 2 rendus = 19 (et non 20 : une seule unité reste vendue)
      const apres = await productModel.findById(produit._id).lean();
      expect(apres!.stock).toBe(19);

      // Mouvement IN du delta uniquement
      const mvts = await movementModel.find({ reason: 'modification_vente' }).lean();
      expect(mvts).toHaveLength(1);
      expect(mvts[0]).toMatchObject({ type: 'IN', quantity: 2 });
    });

    it("garde l'état d'avant et le motif dans l'historique de la vente", async () => {
      const produit = await creerProduit();
      const { sale } = await service.create(dtoVente(produit), actor);

      await service.modifier(
        String(sale._id),
        {
          items: [{ product: String(produit._id), name: produit.name, quantity: 2, unitPrice: 500 }],
          motif: 'Erreur de saisie caissière',
        } as any,
        patron,
      );

      const enBase: any = await saleModel.findById(sale._id).lean();
      expect(enBase!.modifications).toHaveLength(1);
      expect(enBase!.modifications[0]).toMatchObject({
        motif: 'Erreur de saisie caissière',
        ancienTotal: 1500,
        nouveauTotal: 1000,
        parNom: 'Admin Patron',
      });
      // L'état d'avant est rejouable : 3 unités à 500
      expect(enBase!.modifications[0].anciensItems[0]).toMatchObject({ quantity: 3, unitPrice: 500 });
    });

    it('ajoute un article absent du ticket : stock sorti, mouvement OUT, total à jour', async () => {
      const vendu  = await creerProduit();                              // stock 20
      const ajoute = await creerProduit({ name: 'Éponge', price: 300, stock: 8 });
      const { sale } = await service.create(dtoVente(vendu), actor);    // 3 × 500 = 1500

      const res = await service.modifier(
        String(sale._id),
        {
          items: [
            { product: String(vendu._id),  name: vendu.name,  quantity: 3, unitPrice: 500 },
            { product: String(ajoute._id), name: ajoute.name, quantity: 2, unitPrice: 300 },
          ],
          amountPaid: 2500,
          motif: 'Client prend 2 éponges en échange',
        } as any,
        patron,
      );

      expect(res.sale.total).toBe(2100);          // 1500 + 600
      expect(res.sale.change).toBe(400);          // 2500 remis

      // Le produit ajouté est sorti du stock, l'autre n'a pas bougé
      expect((await productModel.findById(ajoute._id).lean())!.stock).toBe(6);
      expect((await productModel.findById(vendu._id).lean())!.stock).toBe(17);

      const mvt = await movementModel.find({ reason: 'modification_vente' }).lean();
      expect(mvt).toHaveLength(1);
      expect(mvt[0]).toMatchObject({ type: 'OUT', quantity: 2, productId: ajoute._id });
    });

    it("refuse d'ajouter un article dont le stock est insuffisant", async () => {
      const vendu  = await creerProduit();
      const ajoute = await creerProduit({ name: 'Éponge', price: 300, stock: 1 });
      const { sale } = await service.create(dtoVente(vendu), actor);

      await expect(
        service.modifier(
          String(sale._id),
          {
            items: [
              { product: String(vendu._id),  name: vendu.name,  quantity: 3, unitPrice: 500 },
              { product: String(ajoute._id), name: ajoute.name, quantity: 4, unitPrice: 300 },
            ],
            amountPaid: 5000,
            motif: 'Ajout impossible',
          } as any,
          patron,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect((await productModel.findById(ajoute._id).lean())!.stock).toBe(1);   // intact
      const enBase: any = await saleModel.findById(sale._id).lean();
      expect(enBase.total).toBe(1500);
    });

    it('refuse de monter la quantité si le stock ne suit pas, sans rien écrire', async () => {
      const produit = await creerProduit({ stock: 4 });            // 4 en stock
      const { sale } = await service.create(dtoVente(produit), actor);  // 3 vendus → 1

      await expect(
        service.modifier(
          String(sale._id),
          {
            items: [{ product: String(produit._id), name: produit.name, quantity: 9, unitPrice: 500 }],
            motif: 'Client veut 6 de plus',
          } as any,
          patron,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Ni le stock ni la vente n'ont bougé
      const apres = await productModel.findById(produit._id).lean();
      expect(apres!.stock).toBe(1);
      const enBase: any = await saleModel.findById(sale._id).lean();
      expect(enBase!.total).toBe(1500);
      expect(enBase!.modifications ?? []).toHaveLength(0);
    });

    it('refuse un nouveau total supérieur au montant remis (hors crédit)', async () => {
      const produit = await creerProduit();
      const { sale } = await service.create(dtoVente(produit), actor);   // remis 2000

      await expect(
        service.modifier(
          String(sale._id),
          {
            items: [{ product: String(produit._id), name: produit.name, quantity: 5, unitPrice: 500 }],
            motif: 'Ajout de 2 savons',
          } as any,
          patron,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);   // 2500 dû > 2000 remis

      const apres = await productModel.findById(produit._id).lean();
      expect(apres!.stock).toBe(17);                   // stock intact
    });

    it('refuse de corriger une vente hors de la fenêtre de correction', async () => {
      const produit = await creerProduit();
      const { sale } = await service.create(dtoVente(produit), actor);

      // On vieillit la vente au-delà de la fenêtre
      // `createdAt` est immuable sous timestamps:true — Mongoose ignore un $set,
      // ce qui empêche d antidater une vente en production. Le test fabrique donc
      // le cas via le driver brut.
      const vieux = new Date(Date.now() - (FENETRE_CORRECTION_JOURS + 1) * 86_400_000);
      await saleModel.collection.updateOne({ _id: sale._id }, { $set: { createdAt: vieux } });

      await expect(
        service.modifier(
          String(sale._id),
          {
            items: [{ product: String(produit._id), name: produit.name, quantity: 1, unitPrice: 500 }],
            motif: 'Correction tardive',
          } as any,
          patron,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse de supprimer une vente hors de la fenêtre de correction', async () => {
      const produit = await creerProduit();
      const { sale } = await service.create(dtoVente(produit), actor);

      const vieux = new Date(Date.now() - (FENETRE_CORRECTION_JOURS + 1) * 86_400_000);
      await saleModel.collection.updateOne({ _id: sale._id }, { $set: { createdAt: vieux } });

      await expect(service.remove(String(sale._id), 'Trop tard'))
        .rejects.toBeInstanceOf(BadRequestException);

      // La vente est toujours là et le stock n'a pas été recrédité
      expect(await saleModel.countDocuments({ _id: sale._id })).toBe(1);
      const apres = await productModel.findById(produit._id).lean();
      expect(apres!.stock).toBe(17);
    });
  });
});
