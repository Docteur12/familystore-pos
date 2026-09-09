/**
 * Verrou du mode simulé — même logique que pour les paiements.
 *
 * Un extracteur simulé en production « lirait » des factures inventées et
 * créerait du stock fictif sans que rien ne le signale. Le démarrage doit
 * échouer plutôt que de laisser tourner l'application dans cet état.
 */
import {
  choisirExtracteur, estProduction, nomExtracteurDemande, ExtracteurSimuleInterditError, ExtracteurFacture,
} from '../../src/factures-fournisseurs/extracteur';

const simule: ExtracteurFacture = { nom: 'simule', extraire: async () => { throw new Error('non appelé'); } };
const claude: ExtracteurFacture = { nom: 'claude', extraire: async () => { throw new Error('non appelé'); } };

describe('estProduction — pessimiste par construction', () => {
  it('NODE_ENV tranche quand il est posé', () => {
    expect(estProduction({ NODE_ENV: 'production' })).toBe(true);
    expect(estProduction({ NODE_ENV: 'test' })).toBe(false);
    expect(estProduction({ NODE_ENV: 'development' })).toBe(false);
  });
  it('sans NODE_ENV, une URI de base cliente (familystore, radiance, hervan) = production', () => {
    expect(estProduction({ MONGO_URI: 'mongodb+srv://u:p@c.mongodb.net/hervan?retryWrites=true' })).toBe(true);
    expect(estProduction({ MONGO_URI: 'mongodb+srv://u:p@c.mongodb.net/familystore' })).toBe(true);
    expect(estProduction({ MONGO_URI: 'mongodb://localhost:27017/familystore_test' })).toBe(false);
  });
});

describe('choisirExtracteur', () => {
  it('claude par défaut', () => {
    expect(nomExtracteurDemande({})).toBe('claude');
    expect(choisirExtracteur({ claude, simule }, { NODE_ENV: 'production' })).toBe(claude);
  });
  it('simulé accepté hors production', () => {
    expect(choisirExtracteur({ claude, simule }, { NODE_ENV: 'test', FACTURE_OCR_FOURNISSEUR: 'simule' })).toBe(simule);
  });
  it('simulé REFUSÉ en production — le démarrage échoue', () => {
    expect(() => choisirExtracteur({ claude, simule }, { NODE_ENV: 'production', FACTURE_OCR_FOURNISSEUR: 'simule' }))
      .toThrow(ExtracteurSimuleInterditError);
    expect(() => choisirExtracteur({ simule }, { MONGO_URI: 'mongodb+srv://u:p@c/hervan', FACTURE_OCR_FOURNISSEUR: 'simule' }))
      .toThrow(ExtracteurSimuleInterditError);
  });
  it('claude demandé mais absent → erreur explicite, jamais un repli silencieux sur le simulé', () => {
    expect(() => choisirExtracteur({ simule }, { NODE_ENV: 'development' })).toThrow(/aucun extracteur Claude/);
  });
});
