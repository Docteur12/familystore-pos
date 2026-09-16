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

describe('Factures fournisseurs — import, contrôle, validation, réception', () => {
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

  /** Contrôle du contenu par la direction : savon connu (24), robe à créer (10). */
  const corpsControle = (f: any) => ({
    lignes: [
      { designation: 'SAVON DOVE 90G', quantite: 24, prixUnitaire: 400, produitId: String(f.lignes[0].produitId) },
      { designation: 'Robe Enfant Coton Bleu 4 ans', quantite: 10, prixUnitaire: 5140, creer: { name: 'Robe Enfant Coton Bleu 4 ans', price: 9000, category: 'Vêtements Fille' } },
    ],
  });

  it('la VALIDATION crée le produit manquant et fige le contenu — SANS toucher au stock', async () => {
    // Décision HERVAN (16/09/2026) : le patron valide de l'étranger, la marchandise
    // arrive des jours plus tard. Un stock qui bouge ici serait un stock faux.
    const f = await service.importer(corpsImport(), USER);
    const r = await service.valider(String(f._id), corpsControle(f), USER);

    expect(r.produitsCrees).toBe(1);
    expect(r.articlesAttendus).toBe(34);
    expect(r.facture.statut).toBe('validee');
    expect(r.facture.receptionId).toBeNull();

    const savon = await produits.findOne({ barcode: '8720181240751' }).lean() as any;
    expect(savon!.stockMagazin).toBe(12);                    // RIEN n'est entré
    expect(savon!.stock).toBe(5);
    const robe = await produits.findOne({ name: 'Robe Enfant Coton Bleu 4 ans' }).lean() as any;
    expect(robe).toMatchObject({ price: 9000, costPrice: 5140, stockMagazin: 0, stock: 0, category: 'Vêtements Fille' });
    expect(await receptions.countDocuments({})).toBe(0);
    expect(await mouvements.countDocuments({})).toBe(0);
  });

  it('la RÉCEPTION par le magasinier entre en ENTREPÔT, quantités comptées, écarts tracés', async () => {
    const f = await service.importer(corpsImport(), USER);
    await service.valider(String(f._id), corpsControle(f), USER);
    const robe = await produits.findOne({ name: 'Robe Enfant Coton Bleu 4 ans' }).lean() as any;

    // 24 savons arrivés sur 24 ; 8 robes sur 10 (colis incomplet).
    const r = await service.recevoir(String(f._id), {
      lignes: [
        { produitId: String(f.lignes[0].produitId), quantiteRecue: 24 },
        { produitId: String(robe._id), quantiteRecue: 8 },
      ],
      note: 'BL 4471',
    }, USER);

    expect(r.facture.statut).toBe('recue');
    expect(r.articlesRecus).toBe(32);
    expect(r.ecarts).toEqual(['Robe Enfant Coton Bleu 4 ans : 8/10']);
    expect(r.facture.lignes.map((l: any) => l.quantiteRecue)).toEqual([24, 8]);

    expect((await produits.findOne({ barcode: '8720181240751' }).lean() as any).stockMagazin).toBe(12 + 24);
    expect((await produits.findById(robe._id).lean() as any).stockMagazin).toBe(8);

    const reception = await receptions.findOne({}).lean() as any;
    expect(reception).toMatchObject({ fournisseur: 'Grossiste Akwa', idempotencyKey: `facture-fournisseur:${f._id}` });
    expect(reception!.items).toHaveLength(2);
    expect(reception!.note).toMatch(/Écarts : Robe Enfant Coton Bleu 4 ans : 8\/10/);
    expect(reception!.note).toMatch(/BL 4471/);
    expect(await mouvements.countDocuments({ type: 'IN', reason: 'reception' })).toBe(2);
    expect(await fournisseurs.countDocuments({ name: /grossiste akwa/i })).toBe(1);
  });

  it('réception sans détail = tout est arrivé conforme ; une ligne comptée à 0 n’entre pas', async () => {
    const f = await service.importer(corpsImport(), USER);
    await service.valider(String(f._id), corpsControle(f), USER);
    const r = await service.recevoir(String(f._id), {}, USER);
    expect(r.articlesRecus).toBe(34);
    expect(r.ecarts).toEqual([]);

    const g = await service.importer(corpsImport(), USER);
    await service.valider(String(g._id), corpsControle(g), USER);
    const r2 = await service.recevoir(String(g._id), { lignes: [{ produitId: String(g.lignes[0].produitId), quantiteRecue: 24 }] }, USER);
    expect(r2.articlesRecus).toBe(24);                        // la robe, non comptée, n'entre pas
    expect(r2.ecarts).toEqual(['Robe Enfant Coton Bleu 4 ans : 0/10']);
  });

  it('ordre imposé : pas de réception avant validation, une seule réception, rien après', async () => {
    const f = await service.importer(corpsImport(), USER);
    await expect(service.recevoir(String(f._id), {}, USER)).rejects.toThrow(/d’abord être validée/);
    await service.valider(String(f._id), corpsControle(f), USER);
    await service.recevoir(String(f._id), {}, USER);
    await expect(service.recevoir(String(f._id), {}, USER)).rejects.toThrow(/déjà été réceptionnée/);
    await expect(service.valider(String(f._id), corpsControle(f), USER)).rejects.toThrow(BadRequestException);
    expect(await receptions.countDocuments({})).toBe(1);
    expect((await produits.findOne({ barcode: '8720181240751' }).lean() as any).stockMagazin).toBe(36);
  });

  it('refuse une réception où rien n’est arrivé', async () => {
    const f = await service.importer(corpsImport(), USER);
    await service.valider(String(f._id), corpsControle(f), USER);
    await expect(service.recevoir(String(f._id), { lignes: [{ produitId: String(f.lignes[0].produitId), quantiteRecue: 0 }] }, USER)).rejects.toThrow(/Aucune quantité reçue/);
    expect(await receptions.countDocuments({})).toBe(0);
  });

  it('compatibilité : une facture « validee » de l’ancien flux, déjà reçue, est exposée « recue »', async () => {
    const f = await service.importer(corpsImport(), USER);
    await service.valider(String(f._id), corpsControle(f), USER);
    // Ancien flux : la validation posait directement une receptionId.
    const factures = connection.model(FactureFournisseur.name);
    await factures.updateOne({ _id: f._id }, { $set: { receptionId: new Types.ObjectId() } });
    expect((await service.obtenir(String(f._id))).statut).toBe('recue');
    expect((await service.lister('validee')).map((x: any) => String(x._id))).not.toContain(String(f._id));
    expect((await service.lister('recue')).map((x: any) => String(x._id))).toContain(String(f._id));
    await expect(service.recevoir(String(f._id), {}, USER)).rejects.toThrow(/déjà été réceptionnée/);
  });

  it('option : reporter le prix de la facture dans le prix d’achat', async () => {
    const f = await service.importer(corpsImport(), USER);
    await service.valider(String(f._id), {
      mettreAJourPrixAchat: true,
      lignes: [{ designation: 'SAVON DOVE 90G', quantite: 1, prixUnitaire: 400, produitId: String(f.lignes[0].produitId) }],
    }, USER);
    expect((await produits.findOne({ barcode: '8720181240751' }).lean() as any).costPrice).toBe(400);
  });

  it('une ligne ignorée n’est pas retenue ; une facture ne se valide qu’une fois', async () => {
    const f = await service.importer(corpsImport(), USER);
    const corps = {
      lignes: [
        { designation: 'SAVON DOVE 90G', quantite: 24, prixUnitaire: 400, produitId: String(f.lignes[0].produitId) },
        { designation: 'Frais de transport', quantite: 1, prixUnitaire: 2000, ignorer: true },
      ],
    };
    const r = await service.valider(String(f._id), corps, USER);
    expect(r.articlesAttendus).toBe(24);
    expect(r.facture.lignes).toHaveLength(1);
    expect(await produits.countDocuments({})).toBe(1);        // rien créé pour la ligne ignorée
    await expect(service.valider(String(f._id), corps, USER)).rejects.toThrow(BadRequestException);
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
