/**
 * Choix du mode de paiement, et verrou du mode simulé.
 *
 * Le risque est silencieux, et c'est ce qui le rend dangereux : un mode
 * simulé actif en production confirme les paiements sans qu'un franc soit
 * versé. Les boutiques marcheraient, les licences se renouvelleraient, et
 * personne ne paierait — on ne s'en apercevrait qu'en lisant les relevés.
 *
 * D'où un refus de DÉMARRER plutôt qu'un avertissement dans les journaux.
 *
 * Depuis le 10/09/2026, le défaut est le mode MANUEL : le revendeur encaisse
 * et active lui-même. Le manuel n'encaisse rien et ne confirme rien : il est
 * donc permis partout, production comprise.
 */
import {
  choisirPrestataire, nomPrestataireDemande, estProduction, paiementEnLigneActif,
  ModeSimuleInterditError, PrestataireInconnuError,
} from '../../src/platform/paiement/choisir-prestataire';
import { PaymentProvider } from '../../src/platform/paiement/payment-provider';
import { PaiementManuelProvider, PaiementEnLigneIndisponibleError } from '../../src/platform/paiement/paiement-manuel.provider';

const faux = (nom: string) => ({ nom } as PaymentProvider);
const simule = faux('simule');
const mycoolpay = faux('mycoolpay');
const manuel = faux('manuel');
const tous = { simule, mycoolpay, manuel };

describe('choix du prestataire de paiement', () => {
  describe('lecture de la configuration', () => {
    it('manuel par défaut — jamais le simulé, jamais un encaissement en ligne par omission', () => {
      expect(nomPrestataireDemande({})).toBe('manuel');
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: '' })).toBe('manuel');
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: ' Manuel ' })).toBe('manuel');
      expect(paiementEnLigneActif({})).toBe(false);
    });

    it('le simulé et MyCoolPay doivent être demandés explicitement', () => {
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: 'simule' })).toBe('simule');
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: '  SIMULE  ' })).toBe('simule');
      expect(nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: 'mycoolpay' })).toBe('mycoolpay');
      expect(paiementEnLigneActif({ PAIEMENT_FOURNISSEUR: 'mycoolpay' })).toBe(true);
    });

    it('une valeur inconnue LÈVE — une faute de frappe ne choisit pas un mode en silence', () => {
      expect(() => nomPrestataireDemande({ PAIEMENT_FOURNISSEUR: 'nimporte quoi' })).toThrow(PrestataireInconnuError);
      expect(() => choisirPrestataire(tous, { PAIEMENT_FOURNISSEUR: 'mycoolpa' })).toThrow(/mycoolpa/);
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
      expect(estProduction({ MONGO_URI: 'mongodb+srv://u:p@cluster0.abc.mongodb.net/hervan' })).toBe(true);
      expect(estProduction({ MONGO_URI: 'mongodb+srv://u:p@cluster0.abc.mongodb.net/cameleon' })).toBe(true);
    });

    it('ne prend pas les bases de test pour de la production', () => {
      expect(estProduction({ MONGO_URI: 'mongodb://127.0.0.1:27017/familystore_test' })).toBe(false);
      expect(estProduction({ NODE_ENV: 'test', MONGO_URI: 'mongodb+srv://x/familystore' })).toBe(false);
      expect(estProduction({ NODE_ENV: 'development' })).toBe(false);
    });
  });

  describe('verrou', () => {
    it('REFUSE le mode simulé en production', () => {
      expect(() => choisirPrestataire(tous, {
        NODE_ENV: 'production', PAIEMENT_FOURNISSEUR: 'simule',
      })).toThrow(ModeSimuleInterditError);
    });

    it('refuse aussi quand seule l’URI trahit la production', () => {
      expect(() => choisirPrestataire(tous, {
        PAIEMENT_FOURNISSEUR: 'simule',
        MONGO_URI: 'mongodb+srv://u:p@cluster0.fjo84gc.mongodb.net/radiance',
      })).toThrow(ModeSimuleInterditError);
    });

    it('accepte le simulé en développement', () => {
      expect(choisirPrestataire(tous, {
        NODE_ENV: 'development', PAIEMENT_FOURNISSEUR: 'simule',
      })).toBe(simule);
    });

    it('rend le manuel par défaut, en production comme ailleurs', () => {
      expect(choisirPrestataire(tous, { NODE_ENV: 'production' })).toBe(manuel);
      expect(choisirPrestataire(tous, { NODE_ENV: 'production', MONGO_URI: 'mongodb+srv://x/cameleon' })).toBe(manuel);
      expect(choisirPrestataire(tous, { NODE_ENV: 'development' })).toBe(manuel);
    });

    it('rend MyCoolPay quand il est demandé et disponible', () => {
      expect(choisirPrestataire(tous, {
        NODE_ENV: 'production', PAIEMENT_FOURNISSEUR: 'mycoolpay',
      })).toBe(mycoolpay);
    });

    it('LÈVE si MyCoolPay est demandé sans être branché — surtout pas de repli sur le simulé', () => {
      // Le repli silencieux serait exactement le glissement qu'on veut
      // empêcher : une application qui « marche » en encaissant rien.
      expect(() => choisirPrestataire({ simule, manuel }, { NODE_ENV: 'development', PAIEMENT_FOURNISSEUR: 'mycoolpay' }))
        .toThrow(/aucune implémentation MyCoolPay/i);
    });
  });

  describe('prestataire manuel', () => {
    const p = new PaiementManuelProvider();

    it('refuse d’ouvrir un paiement, avec le contact du revendeur', async () => {
      process.env.CONTACT_LICENCE = '+237 6 11 22 33 44';
      const demande = { reference: 'CAM-X', montant: 120_000, devise: 'XAF', description: '', client: { email: 'a@b.cm' } };
      await expect(p.creer(demande)).rejects.toThrow(PaiementEnLigneIndisponibleError);
      await expect(p.creer(demande)).rejects.toThrow(/\+237 6 11 22 33 44/);
      delete process.env.CONTACT_LICENCE;
    });

    it('ne décide rien : interrogation « en attente », aucun webhook lisible', async () => {
      expect((await p.interroger('CAM-X')).statut).toBe('en_attente');
      expect(p.extraireReference()).toBeNull();
    });
  });
});
