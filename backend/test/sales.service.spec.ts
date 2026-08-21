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

import { SalesService } from '../src/sales/sales.service';
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
});
