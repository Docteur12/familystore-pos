/**
 * Profil Snack-bar — règles métier du module (casiers, casse, consignes).
 *
 * Contrats protégés :
 *  - un casier reçu = N bouteilles sur `Product.stock`, un seul mouvement IN,
 *    jamais compté deux fois (idempotence) ;
 *  - la casse sort du stock sans passer sous zéro ;
 *  - un retour de vide REMBOURSE : une dépense « Consigne rendue » est créée
 *    (jamais une ligne de vente négative), les vides rejoignent la réserve ;
 *  - le rapport du jour lit les consignes encaissées dans les VENTES et les
 *    consignes rendues dans les mouvements : solde = encaissé − rendu.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';

import { ComptoirService, casiersEtBouteilles, bornesDuJour } from '../../src/comptoir/comptoir.service';
import {
  CATEGORIE_DEPENSE_CONSIGNE, MOTIF_CASSE, MOTIF_RECEPTION_CASIER, PREFIXE_LIGNE_CONSIGNE,
} from '../../src/comptoir/motifs';
import { ConditionnementSnack, ConditionnementSnackSchema } from '../../src/comptoir/schemas/conditionnement-snack.schema';
import { MouvementConsigne, MouvementConsigneSchema } from '../../src/comptoir/schemas/mouvement-consigne.schema';
import { ReceptionCasier, ReceptionCasierSchema } from '../../src/comptoir/schemas/reception-casier.schema';
import { Product, ProductDocument, ProductSchema } from '../../src/schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../../src/schemas/stock-movement.schema';
import { Expense, ExpenseSchema } from '../../src/schemas/expense.schema';
import { Sale, SaleSchema } from '../../src/schemas/sale.schema';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from '../helpers/db';

describe('ComptoirService — casiers, casse, consignes', () => {
  let module: TestingModule;
  let service: ComptoirService;
  let connection: Connection;
  let productModel: Model<ProductDocument>;
  let movementModel: Model<any>;
  let expenseModel: Model<any>;
  let consigneModel: Model<any>;
  let receptionModel: Model<any>;
  let saleModel: Model<any>;

  const ACTEUR = { name: 'Awa', email: 'awa@snack.cm', role: 'caissier' };

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          { name: ConditionnementSnack.name, schema: ConditionnementSnackSchema },
          { name: MouvementConsigne.name,    schema: MouvementConsigneSchema },
          { name: ReceptionCasier.name,      schema: ReceptionCasierSchema },
          { name: Product.name,              schema: ProductSchema },
          { name: StockMovement.name,        schema: StockMovementSchema },
          { name: Expense.name,              schema: ExpenseSchema },
          { name: Sale.name,                 schema: SaleSchema },
        ]),
      ],
      providers: [ComptoirService],
    }).compile();

    service        = module.get(ComptoirService);
    connection     = module.get(getConnectionToken());
    productModel   = module.get(getModelToken(Product.name));
    movementModel  = module.get(getModelToken(StockMovement.name));
    expenseModel   = module.get(getModelToken(Expense.name));
    consigneModel  = module.get(getModelToken(MouvementConsigne.name));
    receptionModel = module.get(getModelToken(ReceptionCasier.name));
    saleModel      = module.get(getModelToken(Sale.name));
  });

  afterAll(async () => {
    await module.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => {
    await viderCollections(connection);
  });

  /** Une bière en bouteille consignée : 24 par casier, consigne 200 F, 10 en stock. */
  async function creerBiere(stock = 10, consigne = 200) {
    const p = await productModel.create({
      name: 'beaufort 65cl', price: 700, costPrice: 500, stock, alertThreshold: 12,
      unit: 'bouteille', category: 'bières',
    });
    await service.definirConditionnement(String(p._id), { bouteillesParCasier: 24, consigne });
    return p;
  }

  // ── Conversions pures ──────────────────────────────────────────────────────

  it('casiersEtBouteilles : 72 → 3 casiers, 0 seule ; 30 → 1 casier, 6 seules ; contenance nulle tolérée', () => {
    expect(casiersEtBouteilles(72, 24)).toEqual({ casiers: 3, seules: 0 });
    expect(casiersEtBouteilles(30, 24)).toEqual({ casiers: 1, seules: 6 });
    expect(casiersEtBouteilles(-4, 24)).toEqual({ casiers: 0, seules: 0 });
    expect(casiersEtBouteilles(5, 0)).toEqual({ casiers: 0, seules: 5 });
  });

  it('bornesDuJour : un jour civil entier, date invalide refusée', () => {
    const { debut, fin } = bornesDuJour('2026-09-11');
    expect(fin.getTime() - debut.getTime()).toBe(24 * 3600 * 1000);
    expect(debut.getHours()).toBe(0);
    expect(() => bornesDuJour('11/09/2026')).not.toThrow();   // format inconnu → aujourd'hui
    expect(() => bornesDuJour('2026-13-45')).toThrow(BadRequestException);
  });

  // ── Conditionnement ────────────────────────────────────────────────────────

  it('definirConditionnement : upsert, un seul document par produit, vides conservés', async () => {
    const p = await creerBiere();
    await service.definirConditionnement(String(p._id), { bouteillesParCasier: 12, consigne: 250 });
    const tous = await service.listerConditionnements();
    expect(tous).toHaveLength(1);
    expect(tous[0]).toMatchObject({ bouteillesParCasier: 12, consigne: 250, videsEnReserve: 0 });
    await expect(service.definirConditionnement(new Types.ObjectId().toHexString(), { bouteillesParCasier: 24, consigne: 0 }))
      .rejects.toThrow('Produit introuvable');
  });

  // ── Réception par casier ───────────────────────────────────────────────────

  it('3 casiers × 24 : +72 sur le stock, un mouvement IN au motif prévu, trace casier', async () => {
    const p = await creerBiere(10);
    const res = await service.receptionnerCasiers({ productId: String(p._id), casiers: 3, note: 'Livreur SABC' }, ACTEUR);

    expect(res.rejeu).toBe(false);
    expect(res.stock).toBe(82);
    expect(res.reception).toMatchObject({ casiers: 3, bouteillesParCasier: 24, bouteilles: 72, nomProduit: 'Beaufort 65cl', auteurNom: 'Awa' });

    const apres = await productModel.findById(p._id).lean();
    expect(apres!.stock).toBe(82);

    const mouvements = await movementModel.find().lean();
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]).toMatchObject({ type: 'IN', quantity: 72, reason: MOTIF_RECEPTION_CASIER });
    expect(mouvements[0].note).toContain('3 casier(s) × 24 = 72');
    expect(mouvements[0].note).toContain('Livreur SABC');
  });

  it('double tap sur « Réceptionner » : une seule réception, un seul crédit de stock', async () => {
    const p = await creerBiere(0);
    const dto = { productId: String(p._id), casiers: 2, idempotencyKey: 'rec-1' };
    const a = await service.receptionnerCasiers(dto, ACTEUR);
    const b = await service.receptionnerCasiers(dto, ACTEUR);
    expect(b.rejeu).toBe(true);
    expect(String(b.reception._id)).toBe(String(a.reception._id));
    expect(await receptionModel.countDocuments()).toBe(1);
    expect((await productModel.findById(p._id).lean())!.stock).toBe(48);
    expect(await movementModel.countDocuments()).toBe(1);
  });

  it('réception sans conditionnement : refusée, rien n’est écrit', async () => {
    const p = await productModel.create({ name: 'Coca 33cl', price: 500, costPrice: 300, stock: 5, unit: 'bouteille' });
    await expect(service.receptionnerCasiers({ productId: String(p._id), casiers: 1 }))
      .rejects.toThrow(/Conditionnement non défini/);
    expect((await productModel.findById(p._id).lean())!.stock).toBe(5);
    expect(await movementModel.countDocuments()).toBe(0);
  });

  it('vides rendus au livreur : décomptés de la réserve, jamais plus que détenus', async () => {
    const p = await creerBiere(10);
    await service.retournerVides({ productId: String(p._id), quantite: 30 }, ACTEUR);   // 30 vides en réserve

    await expect(service.receptionnerCasiers({ productId: String(p._id), casiers: 1, videsRendus: 31 }))
      .rejects.toThrow(/Vides rendus \(31\) supérieurs/);

    const res = await service.receptionnerCasiers({ productId: String(p._id), casiers: 1, videsRendus: 24 });
    expect(res.videsEnReserve).toBe(6);
  });

  // ── Casse ─────────────────────────────────────────────────────────────────

  it('casse : sortie de stock au motif prévu, refus sous zéro, idempotente', async () => {
    const p = await creerBiere(10);
    await expect(service.declarerCasse({ productId: String(p._id), bouteilles: 11 }))
      .rejects.toThrow(/Stock insuffisant/);

    const dto = { productId: String(p._id), bouteilles: 3, note: 'chute du casier', idempotencyKey: 'casse-1' };
    const a = await service.declarerCasse(dto, ACTEUR);
    const b = await service.declarerCasse(dto, ACTEUR);

    expect(a.stock).toBe(7);
    expect(b.rejeu).toBe(true);
    expect((await productModel.findById(p._id).lean())!.stock).toBe(7);
    const mouvements = await movementModel.find().lean();
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]).toMatchObject({ type: 'OUT', quantity: 3, reason: MOTIF_CASSE });
    expect(mouvements[0].note).toMatch(/^Casse — chute du casier/);
  });

  // ── Retour de vide ────────────────────────────────────────────────────────

  it('retour de 4 vides à 200 F : dépense de 800 F « Consigne rendue », mouvement lié, 4 vides en réserve', async () => {
    const p = await creerBiere(10, 200);
    const res = await service.retournerVides({ productId: String(p._id), quantite: 4 }, ACTEUR);

    expect(res.montant).toBe(800);
    expect(res.videsEnReserve).toBe(4);

    const depenses = await expenseModel.find().lean();
    expect(depenses).toHaveLength(1);
    expect(depenses[0]).toMatchObject({ amount: 800, category: CATEGORIE_DEPENSE_CONSIGNE });
    expect(depenses[0].description).toContain('4 × Beaufort 65cl');

    const mouvements = await consigneModel.find().lean();
    expect(mouvements).toHaveLength(1);
    expect(mouvements[0]).toMatchObject({ sens: 'rendue', quantite: 4, montantUnitaire: 200, montant: 800, auteurNom: 'Awa' });
    expect(String(mouvements[0].expense)).toBe(String(depenses[0]._id));

    // Le stock de pleines ne bouge pas : un vide n'est pas une bouteille vendable.
    expect((await productModel.findById(p._id).lean())!.stock).toBe(10);
  });

  it('retour de vide sur un produit sans consigne : refusé, aucune dépense', async () => {
    const p = await creerBiere(10, 0);
    await expect(service.retournerVides({ productId: String(p._id), quantite: 1 }))
      .rejects.toThrow(/pas de consigne/);
    expect(await expenseModel.countDocuments()).toBe(0);
  });

  it('double tap sur « Rembourser » : une seule dépense, une seule fois les vides', async () => {
    const p = await creerBiere(10, 200);
    const dto = { productId: String(p._id), quantite: 2, idempotencyKey: 'vide-1' };
    const a = await service.retournerVides(dto, ACTEUR);
    const b = await service.retournerVides(dto, ACTEUR);
    expect(b.rejeu).toBe(true);
    expect(b.montant).toBe(a.montant);
    expect(await expenseModel.countDocuments()).toBe(1);
    expect(await consigneModel.countDocuments()).toBe(1);
    const reserve = await service.etatReserve();
    expect(reserve[0].videsEnReserve).toBe(2);
  });

  // ── État de la réserve ────────────────────────────────────────────────────

  it('etatReserve : 82 bouteilles = 3 casiers + 10 ; 30 vides = 1 casier à rendre + 6', async () => {
    const p = await creerBiere(10);
    await service.receptionnerCasiers({ productId: String(p._id), casiers: 3 });
    await service.retournerVides({ productId: String(p._id), quantite: 30 });

    const lignes = await service.etatReserve();
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      nomProduit: 'Beaufort 65cl', unit: 'bouteille', stock: 82,
      bouteillesParCasier: 24, casiersPleins: 3, bouteillesSeules: 10,
      consigne: 200, videsEnReserve: 30, casiersVidesARendre: 1, videsSeuls: 6,
    });
  });

  // ── Rapport des consignes du jour ─────────────────────────────────────────

  it('consignesDuJour : encaissées lues dans les ventes, rendues dans les mouvements, solde exact', async () => {
    const biere = await creerBiere(50, 200);
    const eau   = await productModel.create({ name: 'Supermont 1L', price: 500, costPrice: 300, stock: 20, unit: 'bouteille' });

    // Deux ventes du jour : bières + consignes ; l'eau sans consigne ; un
    // article divers qui n'est PAS une consigne (ne doit pas compter).
    await saleModel.create({
      items: [
        { product: biere._id, name: 'Beaufort 65cl', quantity: 3, unitPrice: 700 },
        { product: biere._id, name: `${PREFIXE_LIGNE_CONSIGNE}Beaufort 65cl`, quantity: 3, unitPrice: 200, divers: true },
        { name: 'Cacahuètes', quantity: 1, unitPrice: 100, divers: true },
      ],
      total: 2800, amountPaid: 3000, change: 200, paymentMethod: 'cash',
    });
    await saleModel.create({
      items: [
        { product: eau._id, name: 'Supermont 1L', quantity: 2, unitPrice: 500 },
        { product: biere._id, name: `${PREFIXE_LIGNE_CONSIGNE}Beaufort 65cl`, quantity: 1, unitPrice: 200, divers: true },
      ],
      total: 1200, amountPaid: 1200, change: 0, paymentMethod: 'mobile_money',
    });
    // Une vente d'hier : hors rapport.
    const hier = new Date(); hier.setDate(hier.getDate() - 1);
    await saleModel.create({
      items: [{ product: biere._id, name: `${PREFIXE_LIGNE_CONSIGNE}Beaufort 65cl`, quantity: 10, unitPrice: 200, divers: true }],
      total: 2000, amountPaid: 2000, change: 0, paymentMethod: 'cash', createdAt: hier,
    });

    await service.retournerVides({ productId: String(biere._id), quantite: 2 });

    const r = await service.consignesDuJour();
    expect(r.encaissees).toEqual({ quantite: 4, montant: 800 });
    expect(r.rendues).toEqual({ quantite: 2, montant: 400 });
    expect(r.solde).toBe(400);
    expect(r.parProduit).toHaveLength(1);
    expect(r.parProduit[0]).toMatchObject({
      productId: String(biere._id), nomProduit: 'Beaufort 65cl',
      encaissees: 4, montantEncaisse: 800, rendues: 2, montantRendu: 400,
    });

    // Hier : les 10 consignes, aucun retour.
    const veille = await service.consignesDuJour(hier.toISOString().slice(0, 10));
    expect(veille.encaissees).toEqual({ quantite: 10, montant: 2000 });
    expect(veille.rendues).toEqual({ quantite: 0, montant: 0 });
  });
});
