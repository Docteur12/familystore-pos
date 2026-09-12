/**
 * Les lignes de consigne ne sont pas des « articles divers à régulariser ».
 *
 * Une consigne encaissée au comptoir est une ligne `divers` (aucun stock à
 * décrémenter) qui PORTE un produit. La liste des articles divers
 * (`GET /api/sales/divers`) sert à régulariser des ventes saisies sans
 * produit : une ligne rattachée à un produit n'y a pas sa place. Sans ce
 * filtre, chaque bouteille consignée y apparaissait comme un article à
 * référencer — décision de Valdes du 12/09/2026.
 *
 * Témoin : un vrai divers (sans produit) reste listé, et le décrément de
 * stock ignore toujours la ligne de consigne.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { SalesService } from '../../src/sales/sales.service';
import { MailService } from '../../src/mail/mail.service';
import { Settings, SettingsSchema } from '../../src/settings/settings.schema';
import { Sale, SaleSchema } from '../../src/schemas/sale.schema';
import { Product, ProductDocument, ProductSchema } from '../../src/schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../../src/schemas/stock-movement.schema';
import { EcartStock, EcartStockSchema } from '../../src/schemas/ecart-stock.schema';
import { PREFIXE_LIGNE_CONSIGNE } from '../../src/comptoir/motifs';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from '../helpers/db';

describe('Articles divers à régulariser — les consignes en sont exclues', () => {
  let module: TestingModule;
  let service: SalesService;
  let connection: Connection;
  let productModel: Model<ProductDocument>;

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
    service      = module.get(SalesService);
    connection   = module.get(getConnectionToken());
    productModel = module.get(getModelToken(Product.name));
  });

  afterAll(async () => {
    await module.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => {
    await viderCollections(connection);
  });

  it('une vente du comptoir : la consigne (divers + produit) est absente de la liste, le vrai divers y reste, le stock ne bouge que pour la bière', async () => {
    const biere = await productModel.create({ name: 'beaufort 65cl', price: 700, costPrice: 500, stock: 10, alertThreshold: 2, unit: 'bouteille' });

    await service.create({
      items: [
        { product: String(biere._id), name: 'beaufort 65cl', quantity: 2, unitPrice: 700 },
        { product: String(biere._id), divers: true, name: `${PREFIXE_LIGNE_CONSIGNE}Beaufort 65cl`, quantity: 2, unitPrice: 200 },
        { divers: true, name: 'Cacahuètes', quantity: 1, unitPrice: 100 },
      ],
      total: 1900, subtotal: 1900, paymentMethod: 'cash', amountPaid: 2000, idempotencyKey: 'vente-comptoir-1',
    }, { name: 'Awa', role: 'caissier' });

    const divers = await service.getDiversSales();
    expect(divers.map(d => d.name)).toEqual(['Cacahuètes']);   // témoin : le vrai divers est listé

    // La ligne de consigne n'a pas touché au stock : 10 − 2 bières, pas − 4.
    expect((await productModel.findById(biere._id).lean())!.stock).toBe(8);
  });
});
