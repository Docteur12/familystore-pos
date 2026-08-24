/**
 * Identité d'une boutique NEUVE — rien d'un autre commerçant.
 *
 * Ces trois défauts se ressemblent et n'ont pas la même gravité : le premier
 * imprime une promesse commerciale au nom du client, le deuxième lui donne
 * l'enseigne d'un concurrent sur ses reçus. Aucun ne casse quoi que ce soit —
 * c'est bien le problème : ils passent inaperçus jusqu'à ce qu'un client
 * lise son ticket.
 */
import '../helpers/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../../src/app.module';
import { ProvisionnementService } from '../../src/platform/provisionnement.service';
import { SettingsService } from '../../src/settings/settings.service';
import { runWithTenant } from '../../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest } from '../helpers/db';

describe('Identité d’une boutique neuve', () => {
  let app: INestApplication;
  let provisionnement: ProvisionnementService;
  let settings: SettingsService;
  let Settings: any;
  let tenantId: string;

  beforeAll(async () => {
    process.env.MONGO_URI = await ouvrirBaseDeTest();
    process.env.TENANT_MODE = 'multi';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    provisionnement = app.get(ProvisionnementService);
    settings = app.get(SettingsService);
    Settings = app.get(getModelToken('Settings'), { strict: false });

    const { boutique } = await provisionnement.creerBoutique({
      nom: 'Bependa', ville: 'Douala',
      proprietaire: { email: 'proprio@cameleon.cm', nom: 'Valdes' },
      patron: { nom: 'Patron', email: 'patron@test.cm', motDePasse: 'MotDePasse#1' },
    });
    tenantId = boutique.tenantId;
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fermerBaseDeTest();
    delete process.env.TENANT_MODE;
  });

  describe('le nom du magasin', () => {
    it('est celui demandé, jamais un défaut hérité', async () => {
      const s = await runWithTenant(tenantId, async () => Settings.findOne().lean());
      expect(s.nomMagasin).toBe('Bependa');
    });

    it('est obligatoire à la création', async () => {
      await expect(provisionnement.creerBoutique({
        nom: '   ',
        proprietaire: { email: 'proprio@cameleon.cm' },
        patron: { nom: 'X', email: 'x@test.cm', motDePasse: 'MotDePasse#1' },
      })).rejects.toThrow(/nom de la boutique est obligatoire/i);
    });

    it('ne peut pas être effacé ensuite — il figure sur chaque ticket', async () => {
      await runWithTenant(tenantId, async () => {
        await expect(settings.update({ nomMagasin: '  ' } as any))
          .rejects.toThrow(/nom du magasin est obligatoire/i);
      });
    });

    it('reste modifiable pour une valeur réelle', async () => {
      const apres = await runWithTenant(tenantId, async () => {
        await settings.update({ nomMagasin: 'Bependa Centre' } as any);
        return Settings.findOne().lean();
      });
      expect(apres.nomMagasin).toBe('Bependa Centre');
    });
  });

  describe('le pied de ticket', () => {
    it('est VIDE — aucune promesse commerciale faite au nom du client', async () => {
      const s = await runWithTenant(tenantId, async () => Settings.findOne().lean());
      const offre = s.offreFacture ?? {};
      for (const champ of ['titre', 'message', 'validite', 'cta', 'salutation']) {
        expect(offre[champ] ?? '').toBe('');
      }
    });

    it('ne porte le nom d’aucune autre enseigne', async () => {
      // Témoin de la vraie regression : une remise de 5 % au nom de « Family
      // Store » etait imprimee sur les recus de toute boutique neuve.
      const s = await runWithTenant(tenantId, async () => Settings.findOne().lean());
      expect(JSON.stringify(s)).not.toMatch(/family\s*store/i);
    });
  });
});
