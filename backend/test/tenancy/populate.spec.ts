/**
 * `populate()` et cloisonnement — vérification du point d'audit « 33 populate ».
 *
 * Un populate exécute une requête `find` sur le modèle référencé : il passe
 * donc par le hook du plugin, qui y ajoute le tenant courant. Conséquence
 * attendue : une référence pointant vers un autre magasin ne se résout PAS
 * (null), au lieu de divulguer le document voisin.
 *
 * Ce test verrouille cette propriété — si un jour le plugin cessait de couvrir
 * les requêtes de populate, les 33 appels du code métier deviendraient autant
 * de fuites, silencieusement.
 */
import mongoose, { Schema, Types } from 'mongoose';
import { tenantPlugin } from '../../src/tenancy/tenant.plugin';
import { runWithTenant } from '../../src/tenancy/tenant-context';
import { ouvrirBaseDeTest, fermerBaseDeTest, viderCollections } from '../helpers/db';

describe('populate — la résolution des références reste dans le magasin', () => {
  let connection: mongoose.Connection;
  let Produit: mongoose.Model<any>;
  let Vente: mongoose.Model<any>;

  const MAGASIN_A = new Types.ObjectId();
  const MAGASIN_B = new Types.ObjectId();

  beforeAll(async () => {
    const uri = await ouvrirBaseDeTest();
    connection = (await mongoose.createConnection(uri).asPromise()) as mongoose.Connection;

    const produitSchema = new Schema({ nom: String });
    produitSchema.plugin(tenantPlugin);
    Produit = connection.model('ProduitPopTest', produitSchema);

    const venteSchema = new Schema({
      produit: { type: Schema.Types.ObjectId, ref: 'ProduitPopTest' },
    });
    venteSchema.plugin(tenantPlugin);
    Vente = connection.model('VentePopTest', venteSchema);
  });

  afterAll(async () => {
    await connection.close();
    await fermerBaseDeTest();
  });

  beforeEach(async () => { await viderCollections(connection); });

  it('résout une référence du même magasin', async () => {
    await runWithTenant(MAGASIN_A, async () => {
      const p = await Produit.create({ nom: 'Savon A' });
      await Vente.create({ produit: p._id });
      const vente = await Vente.findOne({}).populate('produit');
      expect((vente!.produit as any).nom).toBe('Savon A');
    });
  });

  it('ne résout PAS une référence appartenant à un autre magasin', async () => {
    // Produit créé chez B…
    const produitB = await runWithTenant(MAGASIN_B, async () => Produit.create({ nom: 'Secret B' }));

    // …référencé (à tort) par une vente de A : le populat ne doit rien révéler.
    await runWithTenant(MAGASIN_A, async () => {
      await Vente.create({ produit: produitB._id });
      const vente = await Vente.findOne({}).populate('produit');
      expect(vente!.produit).toBeNull();
    });
  });
});
