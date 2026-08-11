/**
 * Parcours critique n°3 — la dette partenaire.
 *
 * Les partenaires grossistes sont livrés à crédit depuis l'entrepôt : la
 * créance qui en résulte est de l'argent réel que la boutique attend. La
 * formule du relevé (getCompte) est le contrat à protéger :
 *
 *   solde = ancienneDette + totalLivré − payéÀLaLivraison − versements − retours
 *   (plancher à 0 : un trop-perçu n'affiche jamais de dette négative)
 *
 * Couvert :
 *  - livraison à crédit : sortie d'entrepôt, mouvement tracé, total calculé
 *  - idempotence de la livraison (double-clic sur « Valider »)
 *  - cycle de vie complet de la dette : ancienne dette → livraison avec
 *    acompte → versement → retour d'invendus → solde à zéro
 *  - plancher à zéro en cas de trop-perçu
 *  - suppression d'un BL : stock restitué, dette recalculée sans lui
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { PartenairesService } from '../src/partenaires/partenaires.service';
import { Product, ProductSchema, ProductDocument } from '../src/schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../src/schemas/stock-movement.schema';
import { Partenaire, PartenaireSchema } from '../src/schemas/partenaire.schema';
import { LivraisonPartenaire, LivraisonPartenaireSchema } from '../src/schemas/livraison-partenaire.schema';
import { PaiementPartenaire, PaiementPartenaireSchema } from '../src/schemas/paiement-partenaire.schema';
import { CommandePartenaire, CommandePartenaireSchema } from '../src/schemas/commande-partenaire.schema';
import { RetourPartenaire, RetourPartenaireSchema } from '../src/schemas/retour-partenaire.schema';
import { Agence, AgenceSchema } from '../src/schemas/agence.schema';
import { User, UserSchema } from '../src/schemas/user.schema';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from './helpers/db';

describe('PartenairesService — dette partenaire', () => {
  let module: TestingModule;
  let service: PartenairesService;
  let connection: Connection;
  let productModel: Model<ProductDocument>;
  let partModel: Model<any>;
  let livModel: Model<any>;
  let movementModel: Model<any>;

  const COMMERCIAL_ID = new Types.ObjectId().toHexString();

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: Product.name,             schema: ProductSchema },
          { name: StockMovement.name,       schema: StockMovementSchema },
          { name: Partenaire.name,          schema: PartenaireSchema },
          { name: LivraisonPartenaire.name, schema: LivraisonPartenaireSchema },
          { name: PaiementPartenaire.name,  schema: PaiementPartenaireSchema },
          { name: CommandePartenaire.name,  schema: CommandePartenaireSchema },
          { name: RetourPartenaire.name,    schema: RetourPartenaireSchema },
          { name: Agence.name,              schema: AgenceSchema },
          // Requis par le populate('creePar') du relevé de compte.
          { name: User.name,                schema: UserSchema },
        ]),
      ],
      providers: [PartenairesService],
    }).compile();

    service       = module.get(PartenairesService);
    connection    = module.get(getConnectionToken());
    productModel  = module.get(getModelToken(Product.name));
    partModel     = module.get(getModelToken(Partenaire.name));
    livModel      = module.get(getModelToken(LivraisonPartenaire.name));
    movementModel = module.get(getModelToken(StockMovement.name));
  });

  afterAll(async () => {
    await module.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => {
    await viderCollections(connection);
  });

  /** Grossiste + produit entrepôt (100 unités à 1 000 F le prix négocié). */
  async function creerContexte(ancienneDette = 0) {
    const partenaire = await partModel.create({ name: 'Alimentation du Marché', ancienneDette });
    const produit = await productModel.create({
      name: 'Huile végétale 1L',
      price: 1300,
      costPrice: 900,
      stock: 0,
      stockMagazin: 100,
      category: 'alimentation',
    });
    return { partenaire, produit };
  }

  function lignes(produit: ProductDocument, quantite: number, prixUnitaire = 1000) {
    return [{ productId: String(produit._id), quantite, prixUnitaire }];
  }

  // ──────────────────────────────────────────────────────────────────────────

  it("livraison à crédit : sortie d'entrepôt, mouvement tracé, total = q × prix négocié", async () => {
    const { partenaire, produit } = await creerContexte();

    const liv = await service.createLivraison(
      String(partenaire._id),
      { numeroBL: 'BL-TEST-1', lignes: lignes(produit, 40) },
      COMMERCIAL_ID,
    );

    expect(liv.total).toBe(40_000);
    expect(liv.modePaiement).toBe('credit');

    // 100 − 40 : la marchandise est sortie de l'entrepôt
    const apres = await productModel.findById(produit._id).lean();
    expect(apres!.stockMagazin).toBe(60);

    const mouvements = await movementModel.find({ reason: 'livraison_partenaire' }).lean();
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]).toMatchObject({ type: 'OUT', quantity: 40 });

    // Toute la livraison est à crédit → la dette vaut le total
    const compte = await service.getCompte(String(partenaire._id));
    expect(compte.solde).toBe(40_000);
  });

  it('double-clic sur « Valider la livraison » : une seule livraison, un seul débit de stock', async () => {
    const { partenaire, produit } = await creerContexte();
    const body = { numeroBL: 'BL-DOUBLE', lignes: lignes(produit, 40), idempotencyKey: 'liv-abc-123' };

    const premiere = await service.createLivraison(String(partenaire._id), body, COMMERCIAL_ID);
    const rejeu    = await service.createLivraison(String(partenaire._id), body, COMMERCIAL_ID);

    expect(String(rejeu._id)).toBe(String(premiere._id));
    expect(await livModel.countDocuments()).toBe(1);

    // Le stock n'a été débité qu'une fois — et la dette ne double pas
    expect((await productModel.findById(produit._id).lean())!.stockMagazin).toBe(60);
    expect((await service.getCompte(String(partenaire._id))).solde).toBe(40_000);
  });

  it("cycle de vie complet : ancienne dette + livraison avec acompte − versement − retour → zéro", async () => {
    // Le partenaire arrive avec 50 000 F de créance antérieure au logiciel
    const { partenaire, produit } = await creerContexte(50_000);
    const id = String(partenaire._id);

    // Livraison de 100 000 F dont 20 000 payés comptant à la livraison
    await service.createLivraison(
      id,
      { numeroBL: 'BL-CYCLE', montantPaye: 20_000, lignes: lignes(produit, 100) },
      COMMERCIAL_ID,
    );
    expect((await service.getCompte(id)).solde).toBe(130_000); // 50k + 100k − 20k

    // Versement de 80 000 F
    await service.createPaiement(id, { montant: 80_000 }, COMMERCIAL_ID);
    expect((await service.getCompte(id)).solde).toBe(50_000);

    // Retour d'invendus valorisé 30 000 F (30 unités × 1 000) — dépôt-vente
    await service.createRetour(id, { lignes: lignes(produit, 30) }, COMMERCIAL_ID);
    const apresRetour = await service.getCompte(id);
    expect(apresRetour.solde).toBe(20_000);
    // …et la marchandise est physiquement revenue à l'entrepôt (0 + 30)
    expect((await productModel.findById(produit._id).lean())!.stockMagazin).toBe(30);

    // Dernier versement : le compte est soldé
    await service.createPaiement(id, { montant: 20_000 }, COMMERCIAL_ID);
    const final = await service.getCompte(id);
    expect(final.solde).toBe(0);
    expect(final.totalLivre).toBe(100_000);
    expect(final.totalPaiements).toBe(100_000);
    expect(final.totalRetours).toBe(30_000);
    expect(final.ancienneDette).toBe(50_000);
  });

  it('un trop-perçu ne crée jamais de dette négative (plancher à zéro)', async () => {
    const { partenaire, produit } = await creerContexte();
    const id = String(partenaire._id);

    await service.createLivraison(id, { lignes: lignes(produit, 10) }, COMMERCIAL_ID); // 10 000 F
    await service.createPaiement(id, { montant: 25_000 }, COMMERCIAL_ID);              // paie trop

    expect((await service.getCompte(id)).solde).toBe(0);
  });

  it('supprimer un BL restitue le stock et efface sa part de dette', async () => {
    const { partenaire, produit } = await creerContexte();
    const id = String(partenaire._id);

    const liv1 = await service.createLivraison(id, { numeroBL: 'BL-1', lignes: lignes(produit, 40) }, COMMERCIAL_ID);
    await service.createLivraison(id, { numeroBL: 'BL-2', lignes: lignes(produit, 10) }, COMMERCIAL_ID);
    expect((await service.getCompte(id)).solde).toBe(50_000);
    expect((await productModel.findById(produit._id).lean())!.stockMagazin).toBe(50);

    const res = await service.deleteLivraison(String(liv1._id));
    expect(res).toMatchObject({ ok: true, produitsRestitues: 40 });

    // La dette est recalculée sans le BL supprimé, le stock est revenu
    expect((await service.getCompte(id)).solde).toBe(10_000);
    expect((await productModel.findById(produit._id).lean())!.stockMagazin).toBe(90);
  });
});
