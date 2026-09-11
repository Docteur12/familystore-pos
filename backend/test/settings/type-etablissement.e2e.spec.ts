/**
 * Type d'établissement — le socle de la gamme Caméléon (CAMELEON-GAMME.md §2).
 *
 * Ce qu'il doit garantir :
 *  - une boutique créée avec un type reçoit ce type dans Settings (source de
 *    vérité) ET sur la Boutique (copie), avec les modules et règles métier du
 *    préréglage ; sans type → commerce, modules vides = tout actif (Commerce
 *    inchangé) ;
 *  - le superadmin change le type (journalisé) ; avec le préréglage les
 *    modules suivent, sans lui les choix du patron survivent ; un type inconnu
 *    est refusé ; un patron ne peut pas (403, témoin 200) ;
 *  - PATCH /settings refuse typeEtablissement ; GET /settings et
 *    GET /settings/public l'exposent.
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
import { runWithTenant } from '../../src/tenancy/tenant-context';
import { PROFILS } from '../../src/settings/profils';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Type d’établissement — socle de la gamme', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let provisionnement: ProvisionnementService;
  let Settings: any;
  let Audit: any;
  let commerce: { id: string; tenantId: string };
  let snack: { id: string; tenantId: string };

  // Le superadmin vit dans un tenant technique fixe : c'est LÀ que ses lignes
  // d'audit plateforme sont écrites (AuditLog est cloisonné comme le reste).
  const tenantSuperadmin = new Types.ObjectId().toString();
  const signer = (role: string, tenant: string) => jwt.sign({
    v: 2, sub: new Types.ObjectId().toString(), email: `${role}@test.cm`, name: role, role, tenantId: tenant, boutiques: [tenant],
  });
  const api = () => request(app.getHttpServer());
  const settingsDe = (tenant: string) => runWithTenant(tenant, async () => Settings.findOne().lean());

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);
    provisionnement = app.get(ProvisionnementService);
    Settings = app.get(getModelToken('Settings'), { strict: false });
    Audit = app.get(getModelToken('AuditLog'), { strict: false });

    const c = await provisionnement.creerBoutique({
      nom: 'Boutique Akwa', proprietaire: { email: 'proprio@test.cm', nom: 'Proprio' },
      patron: { nom: 'P', email: 'p1@test.cm', motDePasse: 'MotDePasse#1' },
    });
    commerce = { id: c.boutique.id, tenantId: c.boutique.tenantId };
    const s = await provisionnement.creerBoutique({
      nom: 'Snack Deido', proprietaire: { email: 'proprio@test.cm' },
      patron: { nom: 'P', email: 'p2@test.cm', motDePasse: 'MotDePasse#1' }, typeEtablissement: 'snack',
    });
    snack = { id: s.boutique.id, tenantId: s.boutique.tenantId };
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  it('sans type : commerce, modules vides (tout actif) — Commerce inchangé', async () => {
    const s = await settingsDe(commerce.tenantId);
    expect(s.typeEtablissement).toBe('commerce');
    expect(s.modules).toEqual([]);
    expect(s.metier).toMatchObject({ inactiviteMinutes: 10, seedFournisseursDemo: true, suiviPeremption: true });
  });

  it('avec un type : Settings (source) et Boutique (copie) le portent, modules et règles préréglés', async () => {
    const s = await settingsDe(snack.tenantId);
    expect(s.typeEtablissement).toBe('snack');
    expect(s.modules).toEqual(PROFILS.snack.modules);
    expect(s.metier).toMatchObject({ suiviPeremption: true, seedFournisseursDemo: false });

    const liste = await api().get('/api/platform/boutiques').set('Authorization', `Bearer ${signer('superadmin', tenantSuperadmin)}`);
    const ligne = liste.body.find((b: any) => b.id === snack.id);
    expect(ligne.typeEtablissement).toBe('snack');
    expect(liste.body.find((b: any) => b.id === commerce.id).typeEtablissement).toBe('commerce');
  });

  it('un type inconnu est refusé à la création', async () => {
    await expect(provisionnement.creerBoutique({
      nom: 'Pharma', proprietaire: { email: 'proprio@test.cm' },
      patron: { nom: 'P', email: 'p3@test.cm', motDePasse: 'MotDePasse#1' }, typeEtablissement: 'pharmacie' as any,
    })).rejects.toThrow(/Type d'établissement inconnu/);
  });

  it('le patron ne change pas le type : ni par la plateforme (403), ni par ses paramètres (400)', async () => {
    const patron = signer('patron', commerce.tenantId);
    const plateforme = await api().patch(`/api/platform/boutiques/${commerce.id}/type`).set('Authorization', `Bearer ${patron}`).send({ type: 'hotel' });
    expect(plateforme.status).toBe(403);
    const parametres = await api().patch('/api/settings').set('Authorization', `Bearer ${patron}`).send({ typeEtablissement: 'hotel' });
    expect(parametres.status).toBe(400);
    expect(parametres.body.message).toMatch(/back-office plateforme/);
    expect((await settingsDe(commerce.tenantId)).typeEtablissement).toBe('commerce');
  });

  it('TÉMOIN — le superadmin change le type sans toucher aux modules, et c’est journalisé', async () => {
    const superadmin = signer('superadmin', tenantSuperadmin);
    // Le patron avait fait un choix de modules : il doit survivre.
    await runWithTenant(commerce.tenantId, async () => Settings.updateOne({}, { $set: { modules: ['partenaires'] } }).exec());

    const res = await api().patch(`/api/platform/boutiques/${commerce.id}/type`).set('Authorization', `Bearer ${superadmin}`).send({ type: 'restaurant' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ avant: 'commerce', apres: 'restaurant', prereglageApplique: false });

    const s = await settingsDe(commerce.tenantId);
    expect(s.typeEtablissement).toBe('restaurant');
    expect(s.modules).toEqual(['partenaires']);

    const journal = await runWithTenant(tenantSuperadmin, async () =>
      Audit.findOne({ module: 'plateforme', detail: /Type de « Boutique Akwa » : commerce → restaurant/ }).lean());
    expect(journal).not.toBeNull();
    expect(journal.actorRole).toBe('superadmin');
  });

  it('avec appliquerPrereglage, modules et règles suivent le nouveau type', async () => {
    const superadmin = signer('superadmin', tenantSuperadmin);
    const res = await api().patch(`/api/platform/boutiques/${commerce.id}/type`).set('Authorization', `Bearer ${superadmin}`)
      .send({ type: 'hotel', appliquerPrereglage: true });
    expect(res.status).toBe(200);
    const s = await settingsDe(commerce.tenantId);
    expect(s.typeEtablissement).toBe('hotel');
    expect(s.modules).toEqual(PROFILS.hotel.modules);
    expect(s.metier.suiviPeremption).toBe(false);
    expect(s.metier.inactiviteMinutes).toBe(10);   // le réglage non couvert par le profil survit

    const inconnu = await api().patch(`/api/platform/boutiques/${commerce.id}/type`).set('Authorization', `Bearer ${superadmin}`).send({ type: 'garage' });
    expect(inconnu.status).toBe(400);
  });

  it('GET /settings et GET /settings/public exposent le type', async () => {
    const patron = signer('patron', commerce.tenantId);
    const prive = await api().get('/api/settings').set('Authorization', `Bearer ${patron}`);
    expect(prive.body.typeEtablissement).toBe('hotel');
    // La route publique n'expose le type qu'en mode single ; en multi elle est neutre.
    const pub = await api().get('/api/settings/public');
    expect(pub.body).toEqual({ mode: 'multi' });
  });
});
