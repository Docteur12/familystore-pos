/**
 * Suivi des péremptions — une règle métier du magasin, pas une fatalité.
 *
 * Le logiciel est né chez un vendeur de cosmétiques : chaque produit créé
 * recevait une péremption « à un an ». Chez un vendeur de vêtements (HERVAN),
 * cela mettrait tout le catalogue en alerte « péremption proche » six mois
 * plus tard. `metier.suiviPeremption = false` coupe la date par défaut ;
 * absent, le comportement historique est conservé — Family Store et Radiance
 * ne changent pas.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { ProductsService } from '../../src/products/products.service';
import { Product, ProductSchema } from '../../src/schemas/product.schema';
import { Settings, SettingsSchema } from '../../src/settings/settings.schema';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from '../helpers/db';

describe('création de produit — date de péremption selon la règle du magasin', () => {
  let module: TestingModule;
  let service: ProductsService;
  let connection: Connection;
  let settings: Model<any>;

  const dansUnAn = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; };
  const dto = { name: 'Robe Coton Bleu 4 ans', price: 9000, costPrice: 5000, stock: 3 } as any;

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
    settings = module.get(getModelToken(Settings.name));
  }, 120_000);

  afterAll(async () => { await module.close(); await fermerBaseDeTest(); });
  beforeEach(async () => { await viderCollections(connection); });

  it('sans document Settings : péremption par défaut à +1 an (comportement historique)', async () => {
    const p = await service.create(dto);
    expect(p.expiryDate).toBeTruthy();
    const ecartJours = Math.abs((new Date(p.expiryDate!).getTime() - dansUnAn().getTime()) / 86_400_000);
    expect(ecartJours).toBeLessThan(2);
  });

  it('suiviPeremption absent du document : toujours +1 an', async () => {
    await settings.create({ nomMagasin: 'Family Store', metier: { inactiviteMinutes: 10, seedFournisseursDemo: true } });
    const p = await service.create(dto);
    expect(p.expiryDate).toBeTruthy();
  });

  it('suiviPeremption = false : AUCUNE date par défaut', async () => {
    await settings.create({ nomMagasin: 'HERVAN Élite', metier: { inactiviteMinutes: 15, seedFournisseursDemo: false, suiviPeremption: false } });
    const p = await service.create(dto);
    expect(p.expiryDate).toBeNull();
  });

  it('une date saisie explicitement est toujours respectée, suivi actif ou non', async () => {
    await settings.create({ nomMagasin: 'HERVAN Élite', metier: { suiviPeremption: false } });
    const p = await service.create({ ...dto, expiryDate: '2027-03-31' });
    expect(new Date(p.expiryDate!).toISOString().slice(0, 10)).toBe('2027-03-31');
  });
});
