/**
 * init-boutique — créer une boutique NEUVE, correctement et une seule fois.
 *
 * C'est le script qui ouvrira HERVAN Élite. Ce qu'il doit garantir :
 *  - l'identité, le patron, les caisses et la taxonomie sont créés, estampillés
 *    du tenant par défaut (mode single) ;
 *  - le PIN des caisses est HACHÉ selon le contrat de config/pin.ts — le code
 *    de production refuse toute caisse sans pinKdf ;
 *  - relancer ne crée aucun doublon (idempotence) ;
 *  - un mot de passe patron court est refusé — c'est une clé maîtresse ;
 *  - la base d'un client en production est REFUSÉE : on ne « réinitialise »
 *    jamais familystore ou radiance par accident.
 */
import { MongoClient } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';
import { initialiserBoutique, parserCaisses, CATEGORIES_HERVAN, OptionsInit } from '../../scripts/init-boutique';
import { verifierPin } from '../../src/config/pin';
import { DEFAULT_TENANT_ID } from '../../src/tenancy/tenant-context';

describe('init-boutique — ouverture d’une boutique neuve', () => {
  let client: MongoClient;

  const options: OptionsInit = {
    identite: 'hervan',
    patron: { nom: 'Patronne HERVAN', email: 'Patron@Hervan.cm', motDePasse: 'MotDePasse!2026' },
    caisses: [{ code: 'c01', nom: 'Caisse 01', pin: '1234' }, { code: 'C02', nom: 'Caisse 02', pin: '567890' }],
    execute: true,
  };

  beforeAll(async () => {
    client = new MongoClient(await ouvrirBaseDeTest());
    await client.connect();
  }, 120_000);

  afterAll(async () => {
    await client.close();
    await fermerBaseDeTest();
  });

  it('crée identité, patron, caisses et taxonomie — tous estampillés du tenant', async () => {
    const db = client.db('hervan_test_creation');
    const r = await initialiserBoutique(db, options);

    expect(r.settings).toBe('cree');
    expect(r.patron).toBe('cree');
    expect(r.caisses).toEqual({ creees: 2, existantes: 0 });
    const nbLignes = Object.entries(CATEGORIES_HERVAN).reduce((n, [, subs]) => n + 1 + subs.length, 0);
    expect(r.categories).toEqual({ creees: nbLignes, existantes: 0 });

    const settings = await db.collection('settings').findOne({});
    // Module OCR des factures actif chez HERVAN (demande prioritaire), rien d'autre.
    expect(settings).toMatchObject({ nomMagasin: 'HERVAN Élite', langue: 'fr', modules: ['factures-fournisseurs'] });
    expect(String(settings!.tenant)).toBe(String(DEFAULT_TENANT_ID));

    // Aucun document sans tenant : le plugin fail-closed ne les verrait pas.
    for (const col of ['settings', 'users', 'caisses', 'categories']) {
      expect(await db.collection(col).countDocuments({ tenant: { $exists: false } })).toBe(0);
    }
  });

  it('le logo fourni est embarqué dans Settings.logoUrl en data URL', async () => {
    const db = client.db('hervan_test_logo');
    const png = Buffer.from('89504e470d0a1a0a', 'hex');   // en-tête PNG, suffit ici
    await initialiserBoutique(db, { ...options, logoPng: png });
    const s = await db.collection('settings').findOne({});
    expect(s!.logoUrl).toBe(`data:image/png;base64,${png.toString('base64')}`);
  });

  it('le patron a un mot de passe bcrypt et un e-mail normalisé', async () => {
    const db = client.db('hervan_test_patron');
    await initialiserBoutique(db, options);
    const patron = await db.collection('users').findOne({ role: 'patron' });
    expect(patron!.email).toBe('patron@hervan.cm');
    expect(patron!.password).not.toBe(options.patron.motDePasse);
    expect(await bcrypt.compare(options.patron.motDePasse, patron!.password)).toBe(true);
  });

  it('les caisses portent un PIN HACHÉ vérifiable, jamais en clair', async () => {
    const db = client.db('hervan_test_caisses');
    await initialiserBoutique(db, options);
    const c01 = await db.collection('caisses').findOne({ code: 'C01' });   // code mis en majuscules
    expect(c01).toBeTruthy();
    expect(c01!.pin).toBeUndefined();
    expect(verifierPin('1234', c01!.pinSalt, c01!.pinKdf)).toBe(true);
    expect(verifierPin('0000', c01!.pinSalt, c01!.pinKdf)).toBe(false);
  });

  it('relancer ne crée aucun doublon', async () => {
    const db = client.db('hervan_test_idempotence');
    await initialiserBoutique(db, options);
    const r2 = await initialiserBoutique(db, options);
    expect(r2.settings).toBe('existant');
    expect(r2.patron).toBe('existant');
    expect(r2.caisses).toEqual({ creees: 0, existantes: 2 });
    expect(r2.categories.creees).toBe(0);
    expect(await db.collection('users').countDocuments({})).toBe(1);
    expect(await db.collection('caisses').countDocuments({})).toBe(2);
  });

  it('le dry-run n’écrit rien mais annonce tout', async () => {
    const db = client.db('hervan_test_dryrun');
    const r = await initialiserBoutique(db, { ...options, execute: false });
    expect(r.patron).toBe('cree');
    expect(r.caisses.creees).toBe(2);
    expect(await db.collection('users').countDocuments({})).toBe(0);
    expect(await db.collection('caisses').countDocuments({})).toBe(0);
  });

  it('refuse un mot de passe patron court', async () => {
    const db = client.db('hervan_test_mdp');
    await expect(initialiserBoutique(db, { ...options, patron: { ...options.patron, motDePasse: 'court' } }))
      .rejects.toThrow(/8 caractères/);
  });

  it('REFUSE la base d’un client en production', async () => {
    for (const nom of ['familystore', 'radiance', 'Radiance']) {
      await expect(initialiserBoutique(client.db(nom), options)).rejects.toThrow(/client en production/);
      expect(await client.db(nom).collection('users').countDocuments({})).toBe(0);
    }
  });

  it('parserCaisses lit « CODE:Nom:PIN[:Ville] »', () => {
    expect(parserCaisses('C01:Caisse 01:1234, C02:Caisse 02:5678:Akwa')).toEqual([
      { code: 'C01', nom: 'Caisse 01', pin: '1234', ville: undefined },
      { code: 'C02', nom: 'Caisse 02', pin: '5678', ville: 'Akwa' },
    ]);
    expect(() => parserCaisses('C01:Caisse 01')).toThrow(/mal formée/);
  });
});
