/**
 * Facture fournisseur : import → lecture → contrôle → réception.
 *
 * Ce que ces tests garantissent, sur une vraie base en mémoire :
 *  - l'import n'entre RIEN en stock : il produit une proposition « à vérifier »
 *    avec un appariement par ligne (produit existant / nouveau) ;
 *  - la validation crée les produits manquants, incrémente le stock ENTREPÔT
 *    (pas la boutique), passe par la réception fournisseur standard
 *    (mouvements tracés, fournisseur auto-créé) et archive le lien ;
 *  - une facture ne se valide qu'une fois ; une ligne ignorée n'entre pas ;
 *  - rejet avec motif ; fichiers refusés (format, taille, vide).
 *
 * L'extracteur est le SIMULÉ : le test lui dicte la facture à « lire » en
 * JSON — aucun appel réseau, aucune clé.
 */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { FacturesFournisseursService } from '../../src/factures-fournisseurs/factures-fournisseurs.service';
import { FactureFournisseur, FactureFournisseurSchema } from '../../src/factures-fournisseurs/facture-fournisseur.schema';
import { EXTRACTEUR_FACTURE } from '../../src/factures-fournisseurs/extracteur';
import { ExtracteurSimule } from '../../src/factures-fournisseurs/extracteur-simule';
import { MagazinierService } from '../../src/magazinier/magazinier.service';
import { Product, ProductSchema } from '../../src/schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../../src/schemas/stock-movement.schema';
import { DemandeStock, DemandeStockSchema } from '../../src/schemas/demande-stock.schema';
import { Reception, ReceptionSchema } from '../../src/schemas/reception.schema';
import { Fournisseur, FournisseurSchema } from '../../src/schemas/fournisseur.schema';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from '../helpers/db';

describe('Factures fournisseurs — import, contrôle, validation', () => {
  let module: TestingModule;
  let service: FacturesFournisseursService;
  let connection: Connection;
  let produits: Model<any>;
  let receptions: Model<any>;
  let mouvements: Model<any>;
  let fournisseurs: Model<any>;
  const USER = new Types.ObjectId().toHexString();

  /** Une facture « lue » : 2 lignes, l'une connue par code-barres, l'autre inconnue. */
  const factureJson = JSON.stringify({
    fournisseur: 'Grossiste Akwa', numeroFacture: 'GA-118', dateFacture: '2026-09-05', devise: 'XAF', total: 61000,
    lignes: [
      { designation: 'SAVON DOVE 90G', quantite: 24, prixUnitaire: 400, prixTotal: 9600, reference: '8720181240751' },
      { designation: 'Robe Enfant Coton Bleu 4 ans', quantite: 10, prixUnitaire: 5140, prixTotal: 51400, reference: null },
    ],
    confiance: 'haute', remarques: null,
  });
  const corpsImport = () => ({ fichierBase64: Buffer.from(factureJson).toString('base64'), mimeType: 'image/jpeg', nomFichier: 'facture.jpg' });

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: FactureFournisseur.name, schema: FactureFournisseurSchema },
          { name: Product.name, schema: ProductSchema }, { name: StockMovement.name, schema: StockMovementSchema },
          { name: DemandeStock.name, schema: DemandeStockSchema }, { name: Reception.name, schema: ReceptionSchema },
          { name: Fournisseur.name, schema: FournisseurSchema },
        ]),
      ],
      providers: [FacturesFournisseursService, MagazinierService, { provide: EXTRACTEUR_FACTURE, useClass: ExtracteurSimule }],
    }).compile();
    service = module.get(FacturesFournisseursService);
    connection = module.get(getConnectionToken());
    produits = module.get(getModelToken(Product.name));
    receptions = module.get(getModelToken(Reception.name));
    mouvements = module.get(getModelToken(StockMovement.name));
    fournisseurs = module.get(getModelToken(Fournisseur.name));
  }, 120_000);

  afterAll(async () => { await module.close(); await fermerBaseDeTest(); });

  beforeEach(async () => {
    await viderCollections(connection);
    await produits.create({ name: 'Savon Dove Original 90g', barcode: '8720181240751', price: 600, costPrice: 350, stock: 5, stockMagazin: 12 });
  });

  it('l’import lit, apparie et stocke « à vérifier » — sans toucher au stock', async () => {
    const f = await service.importer(corpsImport(), USER);
    expect(f.statut).toBe('a_verifier');
    expect(f.fournisseur).toBe('Grossiste Akwa');
    expect(f.numeroFacture).toBe('GA-118');
    expect(f.extracteur).toBe('simule');
    expect(f.fichier).toBeUndefined();                       // jamais renvoyé dans la réponse
    expect(f.lignes).toHaveLength(2);
    expect(f.lignes[0]).toMatchObject({ appariement: 'existant', produitNom: 'Savon Dove Original 90g' });
    expect(f.lignes[1]).toMatchObject({ appariement: 'nouveau', produitId: null });
    const savon = await produits.findOne({ barcode: '8720181240751' }).lean() as any;
    expect(savon!.stockMagazin).toBe(12);
    expect(await receptions.countDocuments({})).toBe(0);
  });

  it('le justificatif est archivé et relisible', async () => {
    const f = await service.importer(corpsImport(), USER);
    const archive = await service.fichier(String(f._id));
    expect(archive.mimeType).toBe('image/jpeg');
    expect(Buffer.from(archive.fichier).toString('utf8')).toBe(factureJson);
  });

  it('la validation crée le produit manquant, réceptionne en ENTREPÔT et trace tout', async () => {
    const f = await service.importer(corpsImport(), USER);
    const r = await service.valider(String(f._id), {
      lignes: [
        { designation: 'SAVON DOVE 90G', quantite: 24, prixUnitaire: 400, produitId: String(f.lignes[0].produitId) },
        { designation: 'Robe Enfant Coton Bleu 4 ans', quantite: 10, prixUnitaire: 5140, creer: { name: 'Robe Enfant Coton Bleu 4 ans', price: 9000, category: 'Vêtements Fille' } },
      ],
    }, USER);

    expect(r.produitsCrees).toBe(1);
    expect(r.articlesRecus).toBe(34);
    expect(r.facture.statut).toBe('validee');
    expect(r.receptionId).toBeTruthy();

    const savon = await produits.findOne({ barcode: '8720181240751' }).lean() as any;
    expect(savon!.stockMagazin).toBe(12 + 24);
    expect(savon!.stock).toBe(5);                            // la boutique n'a pas bougé
    expect(savon!.costPrice).toBe(350);                      // prix d'achat inchangé sans option

    const robe = await produits.findOne({ name: 'Robe Enfant Coton Bleu 4 ans' }).lean() as any;
    expect(robe).toMatchObject({ price: 9000, costPrice: 5140, stockMagazin: 10, stock: 0, category: 'Vêtements Fille' });

    const reception = await receptions.findOne({}).lean() as any;
    expect(reception).toMatchObject({ fournisseur: 'Grossiste Akwa', idempotencyKey: `facture-fournisseur:${f._id}` });
    expect(reception!.items).toHaveLength(2);
    expect(await mouvements.countDocuments({ type: 'IN', reason: 'reception' })).toBe(2);
    expect(await fournisseurs.countDocuments({ name: /grossiste akwa/i })).toBe(1);
  });

  it('option : reporter le prix de la facture dans le prix d’achat', async () => {
    const f = await service.importer(corpsImport(), USER);
    await service.valider(String(f._id), {
      mettreAJourPrixAchat: true,
      lignes: [{ designation: 'SAVON DOVE 90G', quantite: 1, prixUnitaire: 400, produitId: String(f.lignes[0].produitId) }],
    }, USER);
    expect((await produits.findOne({ barcode: '8720181240751' }).lean() as any).costPrice).toBe(400);
  });

  it('une ligne ignorée n’entre pas ; une facture ne se valide qu’une fois', async () => {
    const f = await service.importer(corpsImport(), USER);
    const corps = {
      lignes: [
        { designation: 'SAVON DOVE 90G', quantite: 24, prixUnitaire: 400, produitId: String(f.lignes[0].produitId) },
        { designation: 'Frais de transport', quantite: 1, prixUnitaire: 2000, ignorer: true },
      ],
    };
    const r = await service.valider(String(f._id), corps, USER);
    expect(r.articlesRecus).toBe(24);
    expect(await produits.countDocuments({})).toBe(1);        // rien créé pour la ligne ignorée
    await expect(service.valider(String(f._id), corps, USER)).rejects.toThrow(BadRequestException);
    expect((await produits.findOne({ barcode: '8720181240751' }).lean() as any).stockMagazin).toBe(36);
    expect(await receptions.countDocuments({})).toBe(1);
  });

  it('refuse une quantité nulle et un fournisseur vide', async () => {
    const f = await service.importer(corpsImport(), USER);
    await expect(service.valider(String(f._id), { lignes: [{ designation: 'X', quantite: 0, produitId: String(f.lignes[0].produitId) }] }, USER))
      .rejects.toThrow(/Quantité invalide/);
    await expect(service.valider(String(f._id), { fournisseur: '   ', lignes: [{ designation: 'X', quantite: 1, produitId: String(f.lignes[0].produitId) }] }, USER))
      .rejects.toThrow(/fournisseur/);
  });

  it('rejet avec motif obligatoire', async () => {
    const f = await service.importer(corpsImport(), USER);
    await expect(service.rejeter(String(f._id), '  ', USER)).rejects.toThrow(/motif/);
    const r = await service.rejeter(String(f._id), 'Doublon de la facture GA-117', USER);
    expect(r.statut).toBe('rejetee');
    expect(r.motifRejet).toBe('Doublon de la facture GA-117');
    await expect(service.valider(String(f._id), { lignes: [] }, USER)).rejects.toThrow(/déjà rejetée/);
  });

  it('refuse les fichiers inexploitables : format, vide, trop lourd', async () => {
    await expect(service.importer({ fichierBase64: 'AAAA', mimeType: 'text/plain' }, USER)).rejects.toThrow(/Format non pris en charge/);
    await expect(service.importer({ fichierBase64: '', mimeType: 'image/png' }, USER)).rejects.toThrow(/manquant/);
    const lourd = Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64');
    await expect(service.importer({ fichierBase64: lourd, mimeType: 'image/png' }, USER)).rejects.toThrow(/trop lourd/);
  });
});
