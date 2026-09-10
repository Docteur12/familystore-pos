/**
 * creer-superadmin — le premier compte de la plateforme, créé une seule fois.
 *
 * Sans lui, personne n'ouvre de boutique ni n'active de licence en mode
 * manuel. Ce qu'il doit garantir :
 *  - rôle superadmin, mot de passe bcrypt, tenant technique (le plugin
 *    fail-closed refuse tout document sans tenant) ;
 *  - idempotence : relancer ne crée pas de doublon et ne touche pas au compte ;
 *  - mot de passe fort exigé — c'est la clé maîtresse de la plateforme ;
 *  - refus des bases des clients en mode single.
 */
import { MongoClient } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';
import { creerSuperadmin, OptionsSuperadmin } from '../../scripts/creer-superadmin';
import { DEFAULT_TENANT_ID } from '../../src/tenancy/tenant-context';

describe('creer-superadmin — premier compte plateforme', () => {
  let client: MongoClient;

  const options: OptionsSuperadmin = {
    nom: 'Valdes', email: 'Valdes@Cameleon.cm', motDePasse: 'CleMaitresse#2026', execute: true,
  };

  beforeAll(async () => {
    client = new MongoClient(await ouvrirBaseDeTest());
    await client.connect();
  }, 120_000);

  afterAll(async () => {
    await client.close();
    await fermerBaseDeTest();
  });

  it('crée le superadmin : rôle, bcrypt, tenant technique, e-mail normalisé', async () => {
    const db = client.db('cameleon_test');
    const r = await creerSuperadmin(db, options);
    expect(r).toEqual({ base: 'cameleon_test', superadmin: 'cree', email: 'valdes@cameleon.cm' });

    const u = await db.collection('users').findOne({ email: 'valdes@cameleon.cm' });
    expect(u).toMatchObject({ role: 'superadmin', name: 'Valdes' });
    expect(String(u!.tenant)).toBe(String(DEFAULT_TENANT_ID));
    expect(u!.password).not.toBe(options.motDePasse);
    expect(await bcrypt.compare(options.motDePasse, u!.password)).toBe(true);
  });

  it('relancer ne crée aucun doublon et ne change pas le mot de passe', async () => {
    const db = client.db('cameleon_test');
    const avant = (await db.collection('users').findOne({ email: 'valdes@cameleon.cm' }))!.password;
    const r = await creerSuperadmin(db, { ...options, motDePasse: 'AutreMotDePasse#99' });
    expect(r.superadmin).toBe('existant');
    expect(await db.collection('users').countDocuments({ role: 'superadmin' })).toBe(1);
    expect((await db.collection('users').findOne({ email: 'valdes@cameleon.cm' }))!.password).toBe(avant);
  });

  it('le dry-run ne touche à rien', async () => {
    const db = client.db('cameleon_dryrun');
    const r = await creerSuperadmin(db, { ...options, execute: false });
    expect(r.superadmin).toBe('cree');
    expect(await db.collection('users').countDocuments()).toBe(0);
  });

  it('refuse un mot de passe faible', async () => {
    const db = client.db('cameleon_faible');
    await expect(creerSuperadmin(db, { ...options, motDePasse: 'court' })).rejects.toThrow(/12 caractères/);
    await expect(creerSuperadmin(db, { ...options, motDePasse: 'toutenminuscules' })).rejects.toThrow(/majuscule/);
    expect(await db.collection('users').countDocuments()).toBe(0);
  });

  it('refuse les bases des clients en mode single', async () => {
    await expect(creerSuperadmin(client.db('familystore'), options)).rejects.toThrow(/Refus/);
    await expect(creerSuperadmin(client.db('radiance'), options)).rejects.toThrow(/Refus/);
  });
});
