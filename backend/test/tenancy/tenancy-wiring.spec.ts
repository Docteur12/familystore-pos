/**
 * Câblage du plugin — preuve qu'il est bien appliqué à TOUS les modèles de
 * l'application réelle, pas seulement au schéma jetable du test unitaire.
 *
 * On boote l'AppModule complet (avec son connectionFactory) et on vérifie que
 * les schémas métier ont bien reçu le champ `tenant`. Sans ce test, une
 * régression du câblage (connectionFactory retiré, ordre d'import cassé)
 * passerait inaperçue jusqu'à une fuite en production.
 */
import './../helpers/env'; // JWT_SECRET avant l'import d'AppModule
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe("câblage du plugin sur l'AppModule réel", () => {
  let module: TestingModule;
  let connection: Connection;

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'single';
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await module.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  // Échantillon représentatif des schémas métier (cœur, stock, partenaires,
  // auth, paramètres, audit) : tous doivent être cloisonnés.
  const MODELES_METIER = [
    'Product', 'Sale', 'StockMovement', 'User', 'Settings',
    'Partenaire', 'LivraisonPartenaire', 'Caisse', 'AuditLog', 'Reception',
  ];

  it('chaque schéma métier a reçu le champ `tenant` du plugin', () => {
    for (const nom of MODELES_METIER) {
      const model = connection.models[nom];
      expect(model).toBeDefined();
      expect(model.schema.path('tenant')).toBeDefined();
    }
  });

  it('le champ `tenant` est requis et indexé', () => {
    const chemin: any = connection.models['Product'].schema.path('tenant');
    expect(chemin.isRequired).toBe(true);
    expect(chemin.options?.index).toBe(true);
  });
});
