/**
 * Demandes d'ouverture de boutique — le parcours du mode manuel.
 *
 * Sans paiement en ligne, le patron DEMANDE une boutique ; le superadmin
 * l'accepte après avoir encaissé de la main à la main. Ce que ce parcours
 * doit garantir :
 *  - la demande ne crée RIEN : pas de boutique, pas de propriétaire, et le
 *    mot de passe du futur patron n'y dort que HACHÉ ;
 *  - l'acceptation crée la boutique UNE fois, enregistre un paiement manuel
 *    confirmé (objet creation_boutique) et efface le hachage ;
 *  - une demande déjà traitée ne se retraite pas ; un refus porte un motif ;
 *  - un patron ne voit que ses demandes et ne peut ni accepter ni refuser ;
 *    un caissier ne demande rien ;
 *  - une licence expirée n'empêche pas de demander une autre boutique.
 */
import '../helpers/env-manuel';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ProvisionnementService } from '../../src/platform/provisionnement.service';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Demandes d’ouverture de boutique — mode manuel', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let provisionnement: ProvisionnementService;
  let Boutique: any;
  let Paiement: any;
  let Demande: any;
  let Licence: any;
  let tenantA: string;
  let jetonPatron: string;
  let jetonAutrePatron: string;
  let jetonCaissier: string;
  let jetonSuperadmin: string;

  const signer = (role: string, email: string, tenant: string, name = role) => jwt.sign({
    v: 2, sub: new Types.ObjectId().toString(), email, name, role, tenantId: tenant, boutiques: [tenant],
  });
  const api = () => request(app.getHttpServer());
  const corpsDemande = (nom: string) => ({
    nom, ville: 'Douala',
    patron: { nom: 'Patron ' + nom, email: `patron.${nom.toLowerCase()}@test.cm`, motDePasse: 'MotDePasse#1' },
    telephone: '690000000', message: 'Quartier Bonapriso',
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
    Boutique = app.get(getModelToken('Boutique'), { strict: false });
    Paiement = app.get(getModelToken('Paiement'), { strict: false });
    Demande  = app.get(getModelToken('DemandeBoutique'), { strict: false });
    Licence  = app.get(getModelToken('Licence'), { strict: false });

    const a = await provisionnement.creerBoutique({
      nom: 'Akwa', ville: 'Douala',
      proprietaire: { email: 'proprio@test.cm', nom: 'Proprio' },
      patron: { nom: 'Proprio', email: 'proprio@test.cm', motDePasse: 'MotDePasse#1' },
    });
    tenantA = a.boutique.tenantId;
    jetonPatron      = signer('patron', 'proprio@test.cm', tenantA, 'Proprio');
    jetonAutrePatron = signer('patron', 'autre@test.cm', new Types.ObjectId().toString());
    jetonCaissier    = signer('caissier', 'caisse@test.cm', tenantA);
    jetonSuperadmin  = signer('superadmin', 'valdes@cameleon.cm', new Types.ObjectId().toString());
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  let idDemande: string;

  it('le patron demande : rien n’est créé, le mot de passe dort haché', async () => {
    const avant = await Boutique.countDocuments();
    const res = await api().post('/api/demandes-boutique').set('Authorization', `Bearer ${jetonPatron}`).send(corpsDemande('Bonapriso'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nom: 'Bonapriso', statut: 'en_attente', proprietaire: { email: 'proprio@test.cm' } });
    expect(JSON.stringify(res.body)).not.toContain('MotDePasse#1');
    expect(res.body.patron).not.toHaveProperty('motDePasseHash');
    idDemande = res.body.id;

    expect(await Boutique.countDocuments()).toBe(avant);
    const doc = await Demande.findById(idDemande).lean();
    expect(doc.patron.motDePasseHash).not.toBe('MotDePasse#1');
    expect(await bcrypt.compare('MotDePasse#1', doc.patron.motDePasseHash)).toBe(true);
  });

  it('un double clic ne crée pas deux demandes', async () => {
    const res = await api().post('/api/demandes-boutique').set('Authorization', `Bearer ${jetonPatron}`).send(corpsDemande('Bonapriso'));
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(idDemande);
    expect(await Demande.countDocuments()).toBe(1);
  });

  it('refuse un mot de passe court et un nom vide', async () => {
    const court = await api().post('/api/demandes-boutique').set('Authorization', `Bearer ${jetonPatron}`)
      .send({ ...corpsDemande('Deido'), patron: { nom: 'X', email: 'x@test.cm', motDePasse: 'court' } });
    expect(court.status).toBe(400);
    const sansNom = await api().post('/api/demandes-boutique').set('Authorization', `Bearer ${jetonPatron}`)
      .send({ ...corpsDemande('Deido'), nom: '  ' });
    expect(sansNom.status).toBe(400);
  });

  it('chaque patron ne voit que ses demandes ; un caissier ne demande rien', async () => {
    const miennes = await api().get('/api/demandes-boutique/mes').set('Authorization', `Bearer ${jetonPatron}`);
    expect(miennes.status).toBe(200);
    expect(miennes.body.map((d: any) => d.nom)).toEqual(['Bonapriso']);

    const autres = await api().get('/api/demandes-boutique/mes').set('Authorization', `Bearer ${jetonAutrePatron}`);
    expect(autres.body).toEqual([]);

    const caissier = await api().post('/api/demandes-boutique').set('Authorization', `Bearer ${jetonCaissier}`).send(corpsDemande('Pirate'));
    expect(caissier.status).toBe(403);
  });

  it('un patron ne peut ni lister toutes les demandes, ni accepter, ni refuser', async () => {
    expect((await api().get('/api/platform/demandes').set('Authorization', `Bearer ${jetonPatron}`)).status).toBe(403);
    expect((await api().post(`/api/platform/demandes/${idDemande}/accepter`).set('Authorization', `Bearer ${jetonPatron}`).send({})).status).toBe(403);
    expect((await api().post(`/api/platform/demandes/${idDemande}/refuser`).set('Authorization', `Bearer ${jetonPatron}`).send({ motif: 'x' })).status).toBe(403);
    expect((await Demande.findById(idDemande).lean()).statut).toBe('en_attente');
  });

  it('licence expirée : demander une autre boutique reste possible', async () => {
    const hier = new Date(); hier.setDate(hier.getDate() - 1);
    await Licence.updateMany({}, { $set: { dateEcheance: hier } });
    ProvisionnementService.oublierLicence();
    const res = await api().post('/api/demandes-boutique').set('Authorization', `Bearer ${jetonPatron}`).send(corpsDemande('Bonaberi'));
    expect(res.status).toBe(201);
    const demain = new Date(); demain.setFullYear(demain.getFullYear() + 1);
    await Licence.updateMany({}, { $set: { dateEcheance: demain } });
    ProvisionnementService.oublierLicence();
  });

  it('le superadmin voit les demandes, en attente d’abord', async () => {
    const res = await api().get('/api/platform/demandes').set('Authorization', `Bearer ${jetonSuperadmin}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((d: any) => d.statut === 'en_attente')).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('motDePasseHash');
  });

  it('l’acceptation crée la boutique UNE fois, enregistre le règlement, efface le hachage', async () => {
    const res = await api().post(`/api/platform/demandes/${idDemande}/accepter`).set('Authorization', `Bearer ${jetonSuperadmin}`)
      .send({ montant: 120_000, moyen: 'especes', note: 'Reçu en main propre' });
    expect(res.status).toBe(201);
    expect(res.body.demande).toMatchObject({ statut: 'acceptee', traiteePar: 'valdes@cameleon.cm' });
    expect(res.body.boutique.nom).toBe('Bonapriso');
    expect(res.body.paiement).toMatchObject({ statut: 'confirme', objet: 'creation_boutique', fournisseur: 'manuel', moyenReglement: 'especes', montant: 120_000 });

    // La boutique appartient au demandeur, sa licence court un an, le patron peut s'y connecter.
    const boutiques = await provisionnement.boutiquesDuProprietaire('proprio@test.cm');
    expect(boutiques.map(b => b.nom).sort()).toEqual(['Akwa', 'Bonapriso']);
    const licence = await provisionnement.licenceCourante(res.body.boutique.tenantId);
    expect(licence).not.toBeNull();

    const paiement = await Paiement.findOne({ reference: res.body.paiement.reference }).lean();
    expect(paiement.effetApplique).toBe(true);
    expect(paiement.journal.map((j: any) => j.source)).toEqual(['creation', 'manuel']);

    const doc = await Demande.findById(idDemande).lean();
    expect(doc.patron.motDePasseHash).toBe('');
    expect(String(doc.boutique)).toBe(res.body.boutique.id);

    // Accepter une seconde fois : refusé, aucune seconde boutique.
    const encore = await api().post(`/api/platform/demandes/${idDemande}/accepter`).set('Authorization', `Bearer ${jetonSuperadmin}`).send({});
    expect(encore.status).toBe(400);
    expect(encore.body.message).toBe('Demande déjà traitée');
    expect(await Boutique.countDocuments({ nom: 'Bonapriso' })).toBe(1);
  });

  it('le refus exige un motif et clôt la demande', async () => {
    const autre = (await Demande.findOne({ nom: 'Bonaberi' }).lean())._id;
    const sansMotif = await api().post(`/api/platform/demandes/${autre}/refuser`).set('Authorization', `Bearer ${jetonSuperadmin}`).send({});
    expect(sansMotif.status).toBe(400);

    const refus = await api().post(`/api/platform/demandes/${autre}/refuser`).set('Authorization', `Bearer ${jetonSuperadmin}`).send({ motif: 'Pas de règlement reçu' });
    expect(refus.status).toBe(201);
    expect(refus.body).toMatchObject({ statut: 'refusee', motifRefus: 'Pas de règlement reçu' });
    expect((await Demande.findById(autre).lean()).patron.motDePasseHash).toBe('');

    const introuvable = await api().post(`/api/platform/demandes/${new Types.ObjectId()}/refuser`).set('Authorization', `Bearer ${jetonSuperadmin}`).send({ motif: 'x' });
    expect(introuvable.status).toBe(404);

    // Le patron voit l'issue de ses deux demandes.
    const miennes = await api().get('/api/demandes-boutique/mes').set('Authorization', `Bearer ${jetonPatron}`);
    expect(miennes.body.map((d: any) => d.statut).sort()).toEqual(['acceptee', 'refusee']);
  });
});
