/**
 * Le plugin de cloisonnement — preuve du fail-closed et de l'isolation.
 *
 * Testé sur un schéma jetable, indépendamment de tout module métier : c'est
 * le comportement du MÉCANISME qu'on verrouille ici, avant de l'appliquer aux
 * 24 schémas réels.
 *
 * L'exigence n°1 (fail-closed) est le tout premier test : une opération hors
 * contexte tenant doit LEVER, jamais renvoyer les données de tout le monde.
 */
import mongoose, { Schema, Types } from 'mongoose';
import { tenantPlugin } from '../../src/tenancy/tenant.plugin';
import { runWithTenant, DEFAULT_TENANT_ID } from '../../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from '../helpers/db';

describe('tenantPlugin — cloisonnement fail-closed', () => {
  let connection: mongoose.Connection;
  let Widget: mongoose.Model<any>;
  let WidgetSansTenant: mongoose.Model<any>;

  const TENANT_A = new Types.ObjectId();
  const TENANT_B = new Types.ObjectId();

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();
    connection = (await mongoose.createConnection(uri).asPromise()) as mongoose.Connection;

    // Schéma de test cloisonné
    const widgetSchema = new Schema({ label: String, valeur: Number });
    widgetSchema.plugin(tenantPlugin);
    Widget = connection.model('Widget', widgetSchema);

    // Schéma opt-out : le plugin doit s'effacer (pas de champ tenant, pas de filtrage)
    const platformSchema = new Schema({ nom: String }, { skipTenant: true } as any);
    platformSchema.plugin(tenantPlugin);
    WidgetSansTenant = connection.model('PlatformThing', platformSchema);
  });

  afterAll(async () => {
    await connection.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => {
    await viderCollections(connection);
  });

  // ── EXIGENCE N°1 — FAIL-CLOSED ──────────────────────────────────────────────

  describe('fail-closed : aucune opération sans contexte tenant', () => {
    it('find() hors contexte LÈVE au lieu de tout renvoyer', async () => {
      // On sème des données dans deux tenants…
      await runWithTenant(TENANT_A, () => Widget.create({ label: 'a', valeur: 1 }));
      await runWithTenant(TENANT_B, () => Widget.create({ label: 'b', valeur: 2 }));

      // …puis on interroge SANS contexte : ça ne doit PAS renvoyer [a, b].
      await expect(Widget.find({})).rejects.toThrow(/contexte tenant absent/i);
    });

    it('findOne(), count, update, delete et aggregate lèvent tous hors contexte', async () => {
      await expect(Widget.findOne({})).rejects.toThrow(/contexte tenant absent/i);
      await expect(Widget.countDocuments({})).rejects.toThrow(/contexte tenant absent/i);
      await expect(Widget.updateMany({}, { valeur: 0 })).rejects.toThrow(/contexte tenant absent/i);
      await expect(Widget.deleteMany({})).rejects.toThrow(/contexte tenant absent/i);
      await expect(Widget.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }])).rejects.toThrow(
        /contexte tenant absent/i,
      );
    });

    it('create() hors contexte LÈVE (pas de document orphelin sans tenant)', async () => {
      await expect(Widget.create({ label: 'orphelin' })).rejects.toThrow(/contexte tenant absent/i);
      // Rien n'a pu être écrit
      const compteViaAdmin = await connection.collection('widgets').countDocuments({});
      expect(compteViaAdmin).toBe(0);
    });

    it('insertMany() hors contexte LÈVE', async () => {
      await expect(
        Widget.insertMany([{ label: 'x' }, { label: 'y' }]),
      ).rejects.toThrow(/contexte tenant absent/i);
    });
  });

  // ── ISOLATION ───────────────────────────────────────────────────────────────

  describe('isolation entre deux tenants', () => {
    it('chaque tenant ne voit QUE ses propres documents', async () => {
      await runWithTenant(TENANT_A, async () => {
        await Widget.create({ label: 'a1', valeur: 1 });
        await Widget.create({ label: 'a2', valeur: 2 });
      });
      await runWithTenant(TENANT_B, () => Widget.create({ label: 'b1', valeur: 9 }));

      // .exec() force l'exécution DANS le contexte (comme un `await` de service
      // dans un handler HTTP) ; une Query renvoyée non exécutée s'évaluerait
      // hors contexte et lèverait, ce qui est le comportement voulu du plugin.
      const vusParA = await runWithTenant(TENANT_A, () => Widget.find({}).lean().exec());
      const vusParB = await runWithTenant(TENANT_B, () => Widget.find({}).lean().exec());

      expect(vusParA.map((w: any) => w.label).sort()).toEqual(['a1', 'a2']);
      expect(vusParB.map((w: any) => w.label)).toEqual(['b1']);
    });

    it('create() estampille automatiquement le tenant courant', async () => {
      const w = await runWithTenant(TENANT_A, () => Widget.create({ label: 'a' }));
      expect(String(w.tenant)).toBe(String(TENANT_A));
    });

    it('insertMany() estampille chaque document du lot', async () => {
      await runWithTenant(TENANT_A, () => Widget.insertMany([{ label: 'x' }, { label: 'y' }]));
      const bruts = await connection.collection('widgets').find({}).toArray();
      expect(bruts).toHaveLength(2);
      expect(bruts.every(d => String(d.tenant) === String(TENANT_A))).toBe(true);
    });

    it("une mise à jour d'un tenant n'affecte pas les documents de l'autre", async () => {
      await runWithTenant(TENANT_A, () => Widget.create({ label: 'partage', valeur: 1 }));
      await runWithTenant(TENANT_B, () => Widget.create({ label: 'partage', valeur: 1 }));

      // A remet toutes ses valeurs à 100
      await runWithTenant(TENANT_A, () => Widget.updateMany({}, { valeur: 100 }).exec());

      const docA = await runWithTenant(TENANT_A, () => Widget.findOne({ label: 'partage' }).lean<any>().exec());
      const docB = await runWithTenant(TENANT_B, () => Widget.findOne({ label: 'partage' }).lean<any>().exec());
      expect(docA.valeur).toBe(100);
      expect(docB.valeur).toBe(1); // intact
    });

    it("un delete d'un tenant ne touche pas l'autre", async () => {
      await runWithTenant(TENANT_A, () => Widget.create({ label: 'a' }));
      await runWithTenant(TENANT_B, () => Widget.create({ label: 'b' }));

      await runWithTenant(TENANT_A, () => Widget.deleteMany({}).exec());

      expect(await runWithTenant(TENANT_A, () => Widget.countDocuments({}).exec())).toBe(0);
      expect(await runWithTenant(TENANT_B, () => Widget.countDocuments({}).exec())).toBe(1);
    });
  });

  // ── AGRÉGATION ────────────────────────────────────────────────────────────────

  describe('agrégation : $match tenant injecté en tête de pipeline', () => {
    beforeEach(async () => {
      await runWithTenant(TENANT_A, () => Widget.insertMany([{ valeur: 10 }, { valeur: 20 }]));
      await runWithTenant(TENANT_B, () => Widget.insertMany([{ valeur: 1000 }]));
    });

    it("un $group ne somme que les documents du tenant courant", async () => {
      const [resA] = await runWithTenant(TENANT_A, () =>
        Widget.aggregate([{ $group: { _id: null, total: { $sum: '$valeur' } } }]).exec(),
      );
      const [resB] = await runWithTenant(TENANT_B, () =>
        Widget.aggregate([{ $group: { _id: null, total: { $sum: '$valeur' } } }]).exec(),
      );
      expect(resA.total).toBe(30);   // 10 + 20, jamais 1000
      expect(resB.total).toBe(1000);
    });

    it('le $match tenant est bien le PREMIER étage du pipeline', async () => {
      const agg = Widget.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }]);
      await runWithTenant(TENANT_A, () => agg.exec());
      const premierEtage = agg.pipeline()[0];
      expect(premierEtage).toHaveProperty('$match');
      expect(String((premierEtage as any).$match.tenant)).toBe(String(TENANT_A));
    });
  });

  // ── OPT-OUT ───────────────────────────────────────────────────────────────────

  describe('opt-out : les schémas plateforme ne sont pas cloisonnés', () => {
    it("skipTenant=true : pas de champ tenant, requête possible SANS contexte", async () => {
      // Aucune erreur fail-closed, aucun champ tenant ajouté
      await WidgetSansTenant.create({ nom: 'plateforme' });
      const tous = await WidgetSansTenant.find({}).lean();
      expect(tous).toHaveLength(1);
      expect(tous[0]).not.toHaveProperty('tenant');
    });
  });

  // ── MODE SINGLE ────────────────────────────────────────────────────────────────

  describe('tenant par défaut (mode single)', () => {
    it('runWithTenant(DEFAULT_TENANT_ID) fonctionne comme un tenant normal', async () => {
      await runWithTenant(DEFAULT_TENANT_ID, () => Widget.create({ label: 'defaut' }));
      const vus = await runWithTenant(DEFAULT_TENANT_ID, () => Widget.find({}).lean().exec());
      expect(vus).toHaveLength(1);
      expect(String(vus[0].tenant)).toBe(String(DEFAULT_TENANT_ID));
    });
  });
});
