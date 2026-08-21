/**
 * Remise à zéro d'un magasin (POST /api/admin/reset) — non-régression.
 *
 * Ce point d'entrée supprimait les utilisateurs via un accès BRUT à la
 * collection (`connection.collection('users')`), qui court-circuite le plugin
 * de cloisonnement : en mode multi, la remise à zéro d'un magasin aurait
 * supprimé les caissiers, gestionnaires et magasiniers de TOUS les magasins.
 *
 * Le test reproduit les deux écritures — brute et via le modèle — pour
 * démontrer la différence, et verrouille la règle : ne jamais toucher la
 * base autrement que par un modèle Mongoose porteur du plugin.
 */
import mongoose, { Schema, Types } from 'mongoose';
import { tenantPlugin } from '../../src/tenancy/tenant.plugin';
import { runWithTenant } from '../../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from '../helpers/db';

describe('admin/reset — la purge des utilisateurs reste dans le magasin', () => {
  let connection: mongoose.Connection;
  let User: mongoose.Model<any>;

  const MAGASIN_A = new Types.ObjectId();
  const MAGASIN_B = new Types.ObjectId();

  const ROLES_OPERATIONNELS = ['caissier', 'gestionnaire', 'magazinier'];

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();
    connection = (await mongoose.createConnection(uri).asPromise()) as mongoose.Connection;
    const userSchema = new Schema({ name: String, role: String });
    userSchema.plugin(tenantPlugin);
    User = connection.model('UserResetTest', userSchema);
  });

  afterAll(async () => {
    await connection.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => {
    await viderCollections(connection);
    for (const [tenant, prefixe] of [[MAGASIN_A, 'A'], [MAGASIN_B, 'B']] as const) {
      await runWithTenant(tenant, async () => {
        await User.create({ name: `${prefixe}-patron`,  role: 'patron' });
        await User.create({ name: `${prefixe}-caisse`,  role: 'caissier' });
        await User.create({ name: `${prefixe}-magasin`, role: 'magazinier' });
      });
    }
  });

  const noms = async () =>
    (await connection.collection(User.collection.name).find({}).toArray())
      .map((d: any) => d.name)
      .sort();

  it('supprime les rôles opérationnels du magasin courant, épargne les autres magasins', async () => {
    await runWithTenant(MAGASIN_A, async () => {
      await User.deleteMany({ role: { $in: ROLES_OPERATIONNELS } });
    });

    // A ne garde que son patron ; B est intact.
    expect(await noms()).toEqual(['A-patron', 'B-caisse', 'B-magasin', 'B-patron']);
  });

  it("l'accès brut à la collection, lui, détruirait les autres magasins", async () => {
    // Reproduction de l'ancien code — sert de preuve, pas de modèle à suivre.
    await runWithTenant(MAGASIN_A, async () => {
      await connection.collection(User.collection.name).deleteMany({
        role: { $in: ROLES_OPERATIONNELS },
      });
    });

    // Les employés de B ont disparu alors que seul A demandait une remise à zéro.
    expect(await noms()).toEqual(['A-patron', 'B-patron']);
  });
});
