/**
 * Parcours critique n°2 — le transfert entrepôt → boutique.
 *
 * Le produit porte DEUX stocks indépendants : `stockMagazin` (entrepôt,
 * géré par le magasinier) et `stock` (boutique, vendu en caisse). Toute la
 * logistique interne consiste à faire circuler la marchandise entre les deux
 * sans jamais en créer ni en perdre. C'est ce que verrouillent ces tests.
 *
 * Couvert :
 *  - réception fournisseur : entrepôt +N, mouvement IN, fournisseur auto-créé
 *  - idempotence de la réception (rejeu de la synchro hors-ligne)
 *  - circuit complet : réception → envoi (entrepôt −N) → reçu (boutique +N)
 *  - envoi refusé si le stock entrepôt est insuffisant (tout ou rien)
 *  - annulation d'un envoi en transit : l'entrepôt récupère la marchandise
 *  - retour boutique → entrepôt, avec son garde-fou
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { MagazinierService } from '../src/magazinier/magazinier.service';
import { Product, ProductSchema, ProductDocument } from '../src/schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../src/schemas/stock-movement.schema';
import { DemandeStock, DemandeStockSchema } from '../src/schemas/demande-stock.schema';
import { Reception, ReceptionSchema } from '../src/schemas/reception.schema';
import { Fournisseur, FournisseurSchema } from '../src/schemas/fournisseur.schema';
import { User, UserSchema } from '../src/schemas/user.schema';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from './helpers/db';

describe('MagazinierService — transfert entrepôt → boutique', () => {
  let module: TestingModule;
  let service: MagazinierService;
  let connection: Connection;
  let productModel: Model<ProductDocument>;
  let movementModel: Model<any>;
  let demandeModel: Model<any>;
  let receptionModel: Model<any>;
  let fournisseurModel: Model<any>;

  const MAGASINIER_ID = new Types.ObjectId().toHexString();

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: Product.name,       schema: ProductSchema },
          { name: StockMovement.name, schema: StockMovementSchema },
          { name: DemandeStock.name,  schema: DemandeStockSchema },
          { name: Reception.name,     schema: ReceptionSchema },
          { name: Fournisseur.name,   schema: FournisseurSchema },
          // Requis par les populate('demandePar') du service, même si aucun
          // utilisateur n'est créé dans ces tests.
          { name: User.name,          schema: UserSchema },
        ]),
      ],
      providers: [MagazinierService],
    }).compile();

    service          = module.get(MagazinierService);
    connection       = module.get(getConnectionToken());
    productModel     = module.get(getModelToken(Product.name));
    movementModel    = module.get(getModelToken(StockMovement.name));
    demandeModel     = module.get(getModelToken(DemandeStock.name));
    receptionModel   = module.get(getModelToken(Reception.name));
    fournisseurModel = module.get(getModelToken(Fournisseur.name));
  });

  afterAll(async () => {
    await module.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => {
    await viderCollections(connection);
  });

  /** Produit de travail : boutique 10, entrepôt 0. */
  async function creerProduit(surcharges: Partial<Product> = {}): Promise<ProductDocument> {
    return productModel.create({
      name: 'Riz parfumé 5kg',
      price: 4500,
      costPrice: 3800,
      stock: 10,
      stockMagazin: 0,
      category: 'alimentation',
      ...surcharges,
    });
  }

  async function relireStocks(id: unknown) {
    const p = await productModel.findById(id).lean();
    return { boutique: p!.stock, entrepot: p!.stockMagazin };
  }

  // ──────────────────────────────────────────────────────────────────────────

  it("réception fournisseur : entrepôt +N, boutique inchangée, mouvement IN, fournisseur auto-créé", async () => {
    const produit = await creerProduit();

    await service.createReception(
      { fournisseur: 'SABC', items: [{ productId: String(produit._id), quantity: 20 }] },
      MAGASINIER_ID,
    );

    // Seul le stock ENTREPÔT bouge — le stock boutique ne doit jamais être
    // touché par une réception.
    expect(await relireStocks(produit._id)).toEqual({ boutique: 10, entrepot: 20 });

    const mouvements = await movementModel.find().lean();
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]).toMatchObject({ type: 'IN', quantity: 20, reason: 'reception' });

    // Le fournisseur inconnu est créé dans la table centrale
    expect(await fournisseurModel.countDocuments({ name: 'SABC' })).toBe(1);
  });

  it("rejoue la même clé d'idempotence de réception sans ré-incrémenter l'entrepôt", async () => {
    const produit = await creerProduit();
    const body = {
      fournisseur: 'SABC',
      items: [{ productId: String(produit._id), quantity: 20 }],
      idempotencyKey: 'reception-offline-xyz',
    };

    await service.createReception(body, MAGASINIER_ID);
    await service.createReception(body, MAGASINIER_ID); // rejeu réseau

    expect((await relireStocks(produit._id)).entrepot).toBe(20); // pas 40
    expect(await receptionModel.countDocuments()).toBe(1);
    expect(await movementModel.countDocuments()).toBe(1);
  });

  it('circuit complet : réception 20 → envoi 8 → reçu en boutique (+8)', async () => {
    const produit = await creerProduit();

    // 1. La marchandise arrive du fournisseur à l'entrepôt
    await service.createReception(
      { fournisseur: 'SABC', items: [{ productId: String(produit._id), quantity: 20 }] },
      MAGASINIER_ID,
    );

    // 2. Le magasinier envoie 8 unités vers la boutique
    const [envoi] = await service.createEnvoi(
      { items: [{ produitId: String(produit._id), quantite: 8 }] },
      MAGASINIER_ID,
    );
    // La marchandise a quitté l'entrepôt mais n'est pas encore en boutique
    expect(await relireStocks(produit._id)).toEqual({ boutique: 10, entrepot: 12 });
    expect(envoi.statut).toBe('envoyé');

    // 3. Le gestionnaire confirme la réception en boutique
    const recu = await service.marquerRecu(String(envoi._id));
    expect(recu!.statut).toBe('reçu');
    expect(await relireStocks(produit._id)).toEqual({ boutique: 18, entrepot: 12 });

    // Bilan matière : 10 (départ) + 20 (reçu) = 18 + 12 — rien de créé ni perdu
  });

  it("refuse l'envoi si le stock entrepôt est insuffisant — tout ou rien, aucune écriture", async () => {
    const p1 = await creerProduit({ name: 'Produit A', stockMagazin: 10 });
    const p2 = await creerProduit({ name: 'Produit B', stockMagazin: 3 });

    // Le 2e article dépasse le stock : TOUT l'envoi doit être refusé,
    // y compris le 1er article pourtant disponible.
    await expect(
      service.createEnvoi(
        {
          items: [
            { produitId: String(p1._id), quantite: 5 },
            { produitId: String(p2._id), quantite: 4 }, // 4 > 3
          ],
        },
        MAGASINIER_ID,
      ),
    ).rejects.toThrow(BadRequestException);

    expect((await relireStocks(p1._id)).entrepot).toBe(10); // intact
    expect((await relireStocks(p2._id)).entrepot).toBe(3);  // intact
    expect(await demandeModel.countDocuments()).toBe(0);
  });

  it("annule un envoi en transit : l'entrepôt récupère la marchandise, l'envoi devient inutilisable", async () => {
    const produit = await creerProduit({ stockMagazin: 20 });

    const [envoi] = await service.createEnvoi(
      { items: [{ produitId: String(produit._id), quantite: 8 }] },
      MAGASINIER_ID,
    );
    expect((await relireStocks(produit._id)).entrepot).toBe(12);

    const annule = await service.annulerEnvoi(String(envoi._id));
    expect(annule!.statut).toBe('annulé');
    // Restitution intégrale à l'entrepôt, la boutique n'a jamais rien reçu
    expect(await relireStocks(produit._id)).toEqual({ boutique: 10, entrepot: 20 });

    // Un envoi annulé ne peut plus être « reçu » (sinon stock créé du néant)
    await expect(service.marquerRecu(String(envoi._id))).rejects.toThrow(ForbiddenException);
    expect((await relireStocks(produit._id)).boutique).toBe(10);
  });

  it('retour boutique → entrepôt : stock inversé, mouvement tracé, garde-fou sur le stock boutique', async () => {
    const produit = await creerProduit({ stock: 10, stockMagazin: 5 });

    const resultat = await service.retourEntrepot(
      { produitId: String(produit._id), quantite: 4 },
      MAGASINIER_ID,
    );
    expect(resultat).toMatchObject({ ok: true, stock: 6, stockMagazin: 9 });

    const mouvements = await movementModel.find({ reason: 'retour_entrepot' }).lean();
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]).toMatchObject({ type: 'OUT', quantity: 4 });

    // Retourner plus que le stock boutique est refusé, sans écriture
    await expect(
      service.retourEntrepot({ produitId: String(produit._id), quantite: 99 }, MAGASINIER_ID),
    ).rejects.toThrow(BadRequestException);
    expect(await relireStocks(produit._id)).toEqual({ boutique: 6, entrepot: 9 });
  });
});
