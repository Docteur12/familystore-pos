/**
 * Licence expirée → LECTURE SEULE, jamais coupure.
 *
 * Deux risques opposés, testés tous les deux :
 *  - laisser écrire une boutique impayée (le produit ne se défend pas) ;
 *  - **bloquer une boutique à jour** (le produit casse chez un client qui a
 *    payé — bien pire). D'où la garde de sécurité : aucun blocage tant que
 *    l'échéance n'est pas dépassée, y compris à 23 h 59 le jour même.
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ProvisionnementService } from '../../src/platform/provisionnement.service';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Licence expirée — lecture seule', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let provisionnement: ProvisionnementService;
  let Licence: any;
  let idBoutique: string;
  let tenantId: string;
  let jetonPatron: string;

  /** Déplace l'échéance et vide le cache — comme le ferait le temps qui passe. */
  async function fixerEcheance(quand: Date) {
    await Licence.updateMany({}, { $set: { dateEcheance: quand } });
    ProvisionnementService.oublierLicence();
  }

  const jours = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };

  const vendre = (corps: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${jetonPatron}`)
      .send({
        items: [{ name: 'Savon', quantity: 1, unitPrice: 1000, divers: true }],
        total: 1000, subtotal: 1000, paymentMethod: 'cash', amountPaid: 1000,
        idempotencyKey: `k-${Math.random()}`,
        ...corps,
      });

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    jwt = app.get(JwtService);
    provisionnement = app.get(ProvisionnementService);
    Licence = app.get(getModelToken('Licence'), { strict: false });

    const cree = await provisionnement.creerBoutique({
      nom: 'Bonamoussadi', ville: 'Douala',
      proprietaire: { email: 'proprio@cameleon.cm', nom: 'Valdes' },
      patron: { nom: 'Patron', email: 'patron@test.cm', motDePasse: 'MotDePasse#1' },
    });
    idBoutique = cree.boutique.id;
    tenantId = cree.boutique.tenantId;

    jetonPatron = jwt.sign({
      v: 2, sub: new Types.ObjectId().toString(), email: 'patron@test.cm',
      name: 'Patron', role: 'patron', tenantId, boutiques: [tenantId],
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  // ── Garde de sécurité : ne JAMAIS bloquer une boutique à jour ─────────────

  it('une licence valide ne bloque rien', async () => {
    await fixerEcheance(jours(200));
    expect((await vendre()).status).toBe(201);
  });

  it('le JOUR MÊME de l’échéance, tout passe encore — jusqu’à 23 h 59', async () => {
    // L'échéance est aujourd'hui : la journée en cours reste couverte, on ne
    // coupe personne au milieu de ses ventes.
    await fixerEcheance(new Date());
    expect((await vendre()).status).toBe(201);

    const etat = await provisionnement.etatLicence(tenantId);
    expect(etat!.expiree).toBe(false);
    expect(etat!.finCouverture.getHours()).toBe(23);
    expect(etat!.finCouverture.getMinutes()).toBe(59);
  });

  it('une boutique sans licence enregistrée n’est jamais bloquée', async () => {
    // Cas des instances d'avant le module plateforme : aucun registre.
    const inconnue = new Types.ObjectId().toString();
    const jeton = jwt.sign({
      v: 2, sub: new Types.ObjectId().toString(), email: 'x@test.cm',
      name: 'X', role: 'patron', tenantId: inconnue, boutiques: [inconnue],
    });
    expect(await provisionnement.etatLicence(inconnue)).toBeNull();

    const res = await request(app.getHttpServer())
      .post('/api/sales').set('Authorization', `Bearer ${jeton}`)
      .send({ items: [{ name: 'X', quantity: 1, unitPrice: 100, divers: true }],
              total: 100, subtotal: 100, paymentMethod: 'cash', amountPaid: 100, idempotencyKey: 'k-inconnue' });
    expect(res.status).not.toBe(402);
  });

  // ── Expirée : ce qui est bloqué ──────────────────────────────────────────

  it('refuse une vente neuve avec 402 et le montant à payer', async () => {
    await fixerEcheance(jours(-1));

    const res = await vendre();

    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/120 000 XAF/);
    expect(res.body.message).toMatch(/consultable/i);
    expect(res.body.licence).toMatchObject({ expiree: true, montant: 120_000, devise: 'XAF' });
  });

  it('refuse aussi la création de produit et la modification de stock', async () => {
    await fixerEcheance(jours(-1));
    const entete = { Authorization: `Bearer ${jetonPatron}` };

    const produit = await request(app.getHttpServer())
      .post('/api/products').set(entete)
      .send({ name: 'Nouveau', price: 500, costPrice: 200, stock: 10, alertThreshold: 2, unit: 'pièce' });
    expect(produit.status).toBe(402);

    const depense = await request(app.getHttpServer())
      .post('/api/expenses').set(entete)
      .send({ label: 'Loyer', amount: 5000, category: 'Loyer' });
    expect(depense.status).toBe(402);
  });

  // ── Expirée : ce qui reste autorisé ──────────────────────────────────────

  it('laisse passer une vente hors-ligne réalisée pendant la couverture', async () => {
    await fixerEcheance(jours(-5));

    // Vente encaissée il y a 10 jours, restée en file : la refuser
    // détruirait une vente réelle.
    const res = await vendre({ dateVente: jours(-10).toISOString() });
    expect(res.status).toBe(201);
  });

  it('refuse en revanche une vente antidatée APRÈS la fin de couverture', async () => {
    await fixerEcheance(jours(-5));
    // Antidatée, mais postérieure à la couverture : c'est une vente neuve
    // déguisée, elle ne doit pas passer.
    const res = await vendre({ dateVente: jours(-1).toISOString() });
    expect(res.status).toBe(402);
  });

  it('laisse consulter et exporter — ce sont ses données', async () => {
    await fixerEcheance(jours(-5));
    const entete = { Authorization: `Bearer ${jetonPatron}` };

    for (const chemin of ['/api/products', '/api/sales', '/api/settings', '/api/licence/etat']) {
      const res = await request(app.getHttpServer()).get(chemin).set(entete);
      expect(res.status).not.toBe(402);
    }
  });

  it('laisse fermer une session de caisse en cours', async () => {
    await fixerEcheance(jours(200));
    const ouverture = await request(app.getHttpServer())
      .post('/api/sessions').set('Authorization', `Bearer ${jetonPatron}`)
      .send({ fondCaisse: 0 });
    const sessionId = ouverture.body?._id ?? ouverture.body?.id;

    await fixerEcheance(jours(-1));   // la licence expire pendant la session

    const fermeture = await request(app.getHttpServer())
      .patch(`/api/sessions/${sessionId}/close`).set('Authorization', `Bearer ${jetonPatron}`)
      .send({ montantCompte: 0 });
    expect(fermeture.status).not.toBe(402);
  });

  // ── Le cycle complet ─────────────────────────────────────────────────────

  it('expirée → refus → prolongation → écriture de nouveau possible IMMÉDIATEMENT', async () => {
    await fixerEcheance(jours(-1));
    expect((await vendre()).status).toBe(402);

    // Prolongation par le back-office, avec le même processus en marche :
    // ni redéploiement, ni reconnexion.
    const superadmin = jwt.sign({
      v: 2, sub: new Types.ObjectId().toString(), email: 'root@cameleon.cm',
      name: 'Root', role: 'superadmin', tenantId, boutiques: [],
    });
    const prolongation = await request(app.getHttpServer())
      .post(`/api/platform/boutiques/${idBoutique}/prolonger`)
      .set('Authorization', `Bearer ${superadmin}`).send({});
    expect(prolongation.status).toBe(201);

    // Le MÊME jeton patron, sans reconnexion, écrit de nouveau.
    expect((await vendre()).status).toBe(201);

    const etat = await provisionnement.etatLicence(tenantId);
    expect(etat!.expiree).toBe(false);
    expect(etat!.joursRestants).toBeGreaterThan(300);
  });

  // ── Préavis ──────────────────────────────────────────────────────────────

  it('annonce l’échéance avant qu’elle tombe, avec le montant', async () => {
    await fixerEcheance(jours(10));
    const res = await request(app.getHttpServer())
      .get('/api/licence/etat').set('Authorization', `Bearer ${jetonPatron}`);

    expect(res.body).toMatchObject({ connue: true, expiree: false, montant: 120_000, devise: 'XAF' });
    expect(res.body.joursRestants).toBeGreaterThanOrEqual(10);
    expect(res.body.joursRestants).toBeLessThanOrEqual(11);
  });
});
