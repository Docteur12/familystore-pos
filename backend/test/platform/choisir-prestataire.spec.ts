/**
 * Verrou du mode de paiement simulé.
 *
 * Le risque est silencieux, et c'est ce qui le rend dangereux : un mode
 * simulé actif en production confirme les paiements sans qu'un franc soit
 * versé. Les boutiques marcheraient, les licences se renouvelleraient, et
 * personne ne paierait — on ne s'en apercevrait qu'en lisant les relevés.
 *
 * D'où un refus de DÉMARRER plutôt qu'un avertissement dans les journaux.
 */
import {
  choisirPrestataire, nomPrestataireDemande, estProduction, ModeSimuleInterditError,
} from '../../src/platform/paiement/choisir-prestataire';
import { PaymentProvider } from '../../src/platform/paiement/payment-provider';

const faux = (nom: string) => ({ nom } as PaymentProvider);
const simule = faux('simule');
const mycoolpay = faux('mycoolpay');

describe('choix du prestataire de paiement', () => {
  describe('lecture de la configuration', () => {
    it('mycoolpay par défaut — jamais le simulé par omission', () => {
      expect(nomPrestataireDemande({})).toBe('mycoolpay');
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: '' })).toBe('mycoolpay');
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: 'nimporte quoi' })).toBe('mycoolpay');
    });

    it('le simulé doit être demandé explicitement', () => {
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: 'simule' })).toBe('simule');
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: '  SIMULE  ' })).toBe('simule');
    });
  });

  describe('détection de la production', () => {
    it('reconnaît NODE_ENV=production', () => {
      expect(estProduction({ NODE_ENV: 'production' })).toBe(true);
    });

    it('reconnaît une base de production même sans NODE_ENV', () => {
      // Sur Render, NODE_ENV est parfois laissé vide alors que le service
      // sert de vrais clients. L'URI, elle, ne ment pas.
      expect(estProduction({ MONGO_URI: 'mongodb+srv://u:p@cluster0.abc.mongodb.net/familystore' })).toBe(true);
      expect(estProduction({ MONGO_URI: 'mongodb+srv://u:p@cluster0.abc.mongodb.net/radiance?retryWrites=true' })).toBe(true);
    });

    it('ne prend pas les bases de test pour de la production', () => {
      expect(estProduction({ MONGO_URI: 'mongodb://127.0.0.1:27017/familystore_test' })).toBe(false);
      expect(estProduction({ NODE_ENV: 'test', MONGO_URI: 'mongodb+srv://x/familystore' })).toBe(false);
      expect(estProduction({ NODE_ENV: 'development' })).toBe(false);
    });
  });

  describe('verrou', () => {
    it('REFUSE le mode simulé en production', () => {
      expect(() => choisirPrestataire({ simule, mycoolpay }, {
        NODE_ENV: 'production', PAIEMENT_FOURNISSEUR: 'simule',
      })).toThrow(ModeSimuleInterditError);
    });

    it('refuse aussi quand seule l’URI trahit la production', () => {
      expect(() => choisirPrestataire({ simule, mycoolpay }, {
        PAIEMENT_FOURNISSEUR: 'simule',
        MONGO_URI: 'mongodb+srv://u:p@cluster0.fjo84gc.mongodb.net/radiance',
      })).toThrow(ModeSimuleInterditError);
    });

    it('accepte le simulé en développement', () => {
      expect(choisirPrestataire({ simule, mycoolpay }, {
        NODE_ENV: 'development', PAIEMENT_FOURNISSEUR: 'simule',
      })).toBe(simule);
    });

    it('rend MyCoolPay quand il est demandé et disponible', () => {
      expect(choisirPrestataire({ simule, mycoolpay }, {
        NODE_ENV: 'production', PAIEMENT_FOURNISSEUR: 'mycoolpay',
      })).toBe(mycoolpay);
    });

    it('LÈVE si MyCoolPay est demandé sans être branché — surtout pas de repli sur le simulé', () => {
      // Le repli silencieux serait exactement le glissement qu'on veut
      // empêcher : une application qui « marche » en encaissant rien.
      expect(() => choisirPrestataire({ simule }, { NODE_ENV: 'development' }))
        .toThrow(/aucune implémentation MyCoolPay/i);
    });
  });
});
