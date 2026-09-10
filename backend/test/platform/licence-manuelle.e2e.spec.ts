/**
 * Mode LICENCE MANUELLE — décision du 10/09/2026 : pas de MyCoolPay, le
 * revendeur encaisse de la main à la main et active les licences lui-même.
 *
 * Ce que ce mode doit garantir, de bout en bout :
 *  - aucun paiement en ligne ne s'ouvre — et surtout aucun document
 *    « en attente » n'est créé, qu'une réconciliation interrogerait pour rien ;
 *  - l'interface sait COMMENT renouveler : contact du revendeur, pas de
 *    bouton « payer » (`/licence/etat`), y compris dans le refus 402 ;
 *  - la prolongation par le superadmin laisse une TRACE comptable : un
 *    paiement confirmé, source « manuel », avec montant, moyen et auteur ;
 *  - un patron ne peut ni prolonger ni lire l'historique des paiements.
 */
import '../helpers/env-manuel';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ProvisionnementService } from '../../src/platform/provisionnement.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../../src/platform/paiement/payment-provider';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Licences en mode manuel — sans paiement en ligne', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let provisionnement: ProvisionnementService;
  let Paiement: any;
  let Licence: any;
  let idBoutique: string;
  let tenantId: string;
  let jetonPatron: string;
  let jetonSuperadmin: string;

  const CONTACT = '+237 6 00 00 00 00';   // posé par helpers/env-manuel

  const signer = (role: string, email: string, tenant: string) => jwt.sign({
    v: 2, sub: new Types.ObjectId().toString(), email, name: role, role, tenantId: tenant, boutiques: [tenant],
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
    Paiement = app.get(getModelToken('Paiement'), { strict: false });
    Licence  = app.get(getModelToken('Licence'),  { strict: false });

    const cree = await provisionnement.creerBoutique({
      nom: 'HERVAN Élite', ville: 'Douala',
      proprietaire: { email: 'proprio@hervan.cm', nom: 'Patronne' },
      patron: { nom: 'Patronne', email: 'proprio@hervan.cm', motDePasse: 'MotDePasse#1' },
    });
    idBoutique = cree.boutique.id;
    tenantId = cree.boutique.tenantId;
    jetonPatron = signer('patron', 'proprio@hervan.cm', tenantId);
    jetonSuperadmin = signer('superadmin', 'valdes@cameleon.cm', new Types.ObjectId().toString());
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  const api = () => request(app.getHttpServer());

  it('le prestataire injecté est le manuel', () => {
    const prestataire = app.get<PaymentProvider>(PAYMENT_PROVIDER);
    expect(prestataire.nom).toBe('manuel');
  });

  it('/licence/etat dit comment renouveler : contact, pas de paiement en ligne', async () => {
    const res = await api().get('/api/licence/etat').set('Authorization', `Bearer ${jetonPatron}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ connue: true, expiree: false, contact: CONTACT, paiementEnLigne: false });
  });

  it('ouvrir un paiement en ligne est REFUSÉ, avec le contact — et rien n’est écrit', async () => {
    const res = await api()
      .post('/api/paiements/renouvellement').set('Authorization', `Bearer ${jetonPatron}`)
      .send({ boutiqueId: idBoutique, telephonePayeur: '690000000' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(CONTACT);
    expect(res.body.message).toMatch(/paiement en ligne n'est pas proposé/i);
    expect(await Paiement.countDocuments()).toBe(0);

    const creation = await api()
      .post('/api/paiements/boutique').set('Authorization', `Bearer ${jetonPatron}`)
      .send({ nom: 'Autre', patron: { nom: 'X', email: 'x@test.cm', motDePasse: 'MotDePasse#1' }, telephonePayeur: '690000000' });
    expect(creation.status).toBe(400);
    expect(await Paiement.countDocuments()).toBe(0);
  });

  it('licence expirée : le 402 donne le contact à appeler', async () => {
    const hier = new Date(); hier.setDate(hier.getDate() - 1);
    await Licence.updateMany({}, { $set: { dateEcheance: hier } });
    ProvisionnementService.oublierLicence();

    const res = await api()
      .post('/api/sales').set('Authorization', `Bearer ${jetonPatron}`)
      .send({ items: [{ name: 'Robe', quantity: 1, unitPrice: 5000, divers: true }],
              total: 5000, subtotal: 5000, paymentMethod: 'cash', amountPaid: 5000, idempotencyKey: 'k-expiree' });
    expect(res.status).toBe(402);
    expect(res.body.message).toContain(CONTACT);
  });

  it('le superadmin enregistre le règlement reçu et la licence repart pour un an', async () => {
    const res = await api()
      .post(`/api/platform/boutiques/${idBoutique}/prolonger`).set('Authorization', `Bearer ${jetonSuperadmin}`)
      .send({ montant: 120_000, moyen: 'mobile_money', note: 'MoMo 690000000 — reçu le 10/09' });
    expect(res.status).toBe(201);

    // Licence : un an devant, à partir d'aujourd'hui (l'ancienne était dépassée).
    const echeance = new Date(res.body.dateEcheance);
    const dansUnAn = new Date(); dansUnAn.setFullYear(dansUnAn.getFullYear() + 1);
    expect(Math.abs(echeance.getTime() - dansUnAn.getTime())).toBeLessThan(60_000);
    expect((await provisionnement.etatLicence(tenantId))!.expiree).toBe(false);

    // Trace comptable : un paiement CONFIRMÉ, source manuel, avec l'auteur.
    expect(res.body.reglement).toMatchObject({
      statut: 'confirme', montant: 120_000, fournisseur: 'manuel',
      moyenReglement: 'mobile_money', enregistrePar: 'valdes@cameleon.cm',
    });
    const doc = await Paiement.findOne({ reference: res.body.reglement.reference }).lean();
    expect(doc.effetApplique).toBe(true);
    expect(doc.journal.map((j: any) => j.source)).toEqual(['creation', 'manuel', 'reconciliation']);
    expect(doc.journal[1].detail).toContain('reçu le 10/09');

    // Et la vente refusée juste avant passe maintenant.
    const vente = await api()
      .post('/api/sales').set('Authorization', `Bearer ${jetonPatron}`)
      .send({ items: [{ name: 'Robe', quantity: 1, unitPrice: 5000, divers: true }],
              total: 5000, subtotal: 5000, paymentMethod: 'cash', amountPaid: 5000, idempotencyKey: 'k-reactivee' });
    expect(vente.status).toBe(201);
  });

  it('sans corps : plein tarif, Mobile Money — et l’historique de la boutique le montre', async () => {
    const avant = await provisionnement.licenceCourante(tenantId);
    const res = await api()
      .post(`/api/platform/boutiques/${idBoutique}/prolonger`).set('Authorization', `Bearer ${jetonSuperadmin}`)
      .send();
    expect(res.status).toBe(201);
    expect(res.body.reglement).toMatchObject({ montant: 120_000, moyenReglement: 'mobile_money' });
    // Renouvellement en avance : on repart de l'échéance, le client ne perd rien.
    expect(new Date(res.body.dateEcheance).getFullYear()).toBe(new Date(avant!.dateEcheance).getFullYear() + 1);

    const historique = await api()
      .get(`/api/platform/boutiques/${idBoutique}/paiements`).set('Authorization', `Bearer ${jetonSuperadmin}`);
    expect(historique.status).toBe(200);
    expect(historique.body).toHaveLength(2);
    expect(historique.body.every((p: any) => p.statut === 'confirme' && p.fournisseur === 'manuel')).toBe(true);
  });

  it('refuse un moyen inconnu et un geste commercial sans note', async () => {
    const moyen = await api()
      .post(`/api/platform/boutiques/${idBoutique}/prolonger`).set('Authorization', `Bearer ${jetonSuperadmin}`)
      .send({ moyen: 'bitcoin' });
    expect(moyen.status).toBe(400);
    const gratuit = await api()
      .post(`/api/platform/boutiques/${idBoutique}/prolonger`).set('Authorization', `Bearer ${jetonSuperadmin}`)
      .send({ montant: 0 });
    expect(gratuit.status).toBe(400);
    expect(await Paiement.countDocuments()).toBe(2);   // rien d'écrit par ces refus
  });

  it('un patron ne prolonge pas et ne lit pas l’historique des paiements', async () => {
    const prolonger = await api()
      .post(`/api/platform/boutiques/${idBoutique}/prolonger`).set('Authorization', `Bearer ${jetonPatron}`)
      .send({ moyen: 'especes' });
    expect(prolonger.status).toBe(403);
    const historique = await api()
      .get(`/api/platform/boutiques/${idBoutique}/paiements`).set('Authorization', `Bearer ${jetonPatron}`);
    expect(historique.status).toBe(403);
    expect(await Paiement.countDocuments()).toBe(2);
  });
});
