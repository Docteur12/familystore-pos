/**
 * Traçabilité des changements de prix — le journal doit raconter l'histoire.
 *
 * Cas vécu (07/09/2026) : la « Serviette Belday Home » passe de 4 500 à
 * 3 500 sans que personne ne comprenne. Le journal disait QUI avait modifié,
 * mais pas les VALEURS — et un import Excel qui écrase des prix n'apparaissait
 * que comme « Import en masse : N modifié(s) », introuvable en cherchant le
 * produit par son nom.
 *
 * Deux verrous ici :
 *  - `resumerChangementsPrix` : le texte « prix : 4 500 → 3 500 » que porte
 *    désormais chaque ligne d'audit de modification ;
 *  - `importBulk` : chaque prix écrasé par un import est relevé (nom, avant,
 *    après) pour devenir une ligne d'audit individuelle.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { ProductsService, resumerChangementsPrix } from '../../src/products/products.service';
import { Product, ProductSchema, ProductDocument } from '../../src/schemas/product.schema';
import { Settings, SettingsSchema } from '../../src/settings/settings.schema';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from '../helpers/db';

describe('resumerChangementsPrix — le récit du changement', () => {
  it('décrit un changement de prix avec les deux valeurs', () => {
    expect(resumerChangementsPrix({ price: 4500 }, { price: 3500 }))
      .toBe(' — prix : 4 500 → 3 500');
  });

  it('cumule prix, prix d’achat et réduction quand tout change', () => {
    const resume = resumerChangementsPrix(
      { price: 4500, costPrice: 3000, discount: 0 },
      { price: 3500, costPrice: 2500, discount: 10 },
    );
    expect(resume).toContain('prix : 4 500 → 3 500');
    expect(resume).toContain("prix d'achat : 3 000 → 2 500");
    expect(resume).toContain('réduction : 0 % → 10 %');
  });

  it('reste muet si la modification ne touche pas au financier', () => {
    expect(resumerChangementsPrix({ price: 4500 }, {})).toBe('');
    expect(resumerChangementsPrix({ price: 4500 }, { price: 4500 })).toBe('');
  });
});

describe('importBulk — chaque prix écrasé est relevé', () => {
  let module: TestingModule;
  let service: ProductsService;
  let connection: Connection;
  let productModel: Model<ProductDocument>;

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }, { name: Settings.name, schema: SettingsSchema }]),
      ],
      providers: [ProductsService],
    }).compile();
    service = module.get(ProductsService);
    connection = module.get(getConnectionToken());
    productModel = module.get(getModelToken(Product.name));
  }, 120_000);

  afterAll(async () => {
    await module.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => {
    await viderCollections(connection);
    await productModel.create({
      name: 'Serviette Belday Home', barcode: 'BELDAY1', price: 4500, costPrice: 3000, stock: 5,
    });
  });

  it('un import qui change le prix le relève : nom, avant, après', async () => {
    const r = await service.importBulk([{ barcode: 'BELDAY1', price: '3500' }]);
    expect(r.modifies).toBe(1);
    expect(r.changementsPrix).toEqual([
      { nom: 'Serviette Belday Home', avant: 4500, apres: 3500 },
    ]);
    // Et le prix a réellement changé en base.
    expect((await productModel.findOne({ barcode: 'BELDAY1' }).lean())!.price).toBe(3500);
  });

  it('un import au même prix ne relève rien', async () => {
    const r = await service.importBulk([{ barcode: 'BELDAY1', price: '4500' }]);
    expect(r.modifies).toBe(1);
    expect(r.changementsPrix).toEqual([]);
  });

  it('une cellule prix VIDE ne touche pas au prix — et ne relève rien', async () => {
    const r = await service.importBulk([{ barcode: 'BELDAY1', stock: '12' }]);
    expect(r.changementsPrix).toEqual([]);
    expect((await productModel.findOne({ barcode: 'BELDAY1' }).lean())!.price).toBe(4500);
  });

  it('un produit CRÉÉ par l’import n’est pas un changement de prix', async () => {
    const r = await service.importBulk([{ name: 'Produit Neuf', price: '1000' }]);
    expect(r.crees).toBe(1);
    expect(r.changementsPrix).toEqual([]);
  });
});
