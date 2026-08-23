/**
 * Machine à états d'un paiement.
 *
 * Tests purs, sans base : ce sont les règles elles-mêmes qu'on éprouve. Une
 * erreur ici ne se verrait qu'en production, sur l'argent d'un client — et
 * seulement dans les cas rares (confirmation tardive, annonce répétée), donc
 * longtemps après la mise en service.
 */
import {
  evaluer, transitionPermise, estRepetition, estTerminal, aInterroger, estDepasse,
  delaiProchaineVerification, DELAI_EXPIRATION_MINUTES, SUIVI_APRES_EXPIRATION_HEURES,
  TRANSITIONS, STATUTS, StatutPaiement,
} from '../../src/platform/paiement/machine-etats';

const ilYA = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe('machine à états du paiement', () => {
  describe('transitions', () => {
    it('un paiement en attente peut être confirmé, échouer ou expirer', () => {
      expect(transitionPermise('en_attente', 'confirme')).toBe(true);
      expect(transitionPermise('en_attente', 'echoue')).toBe(true);
      expect(transitionPermise('en_attente', 'expire')).toBe(true);
    });

    it('une confirmation TARDIVE est acceptée après expiration', () => {
      // Le cas qui compte : l'opérateur a mis vingt minutes, le client a
      // payé. Refuser reviendrait à encaisser sans rendre le service.
      expect(transitionPermise('expire', 'confirme')).toBe(true);
    });

    it('un échec est définitif', () => {
      expect(estTerminal('echoue')).toBe(true);
      expect(TRANSITIONS.echoue).toEqual([]);
      expect(transitionPermise('echoue', 'confirme')).toBe(false);
    });

    it('un paiement confirmé ne peut que devenir remboursé', () => {
      expect(TRANSITIONS.confirme).toEqual(['rembourse']);
      expect(transitionPermise('confirme', 'echoue')).toBe(false);
      expect(transitionPermise('confirme', 'en_attente')).toBe(false);
    });

    it('on ne revient jamais en arrière vers « en attente »', () => {
      for (const de of STATUTS) {
        expect(transitionPermise(de, 'en_attente')).toBe(false);
      }
    });
  });

  describe('effet métier', () => {
    it("n'est déclenché qu'à l'entrée dans « confirmé »", () => {
      expect(evaluer('en_attente', 'confirme').declencheEffet).toBe(true);
      expect(evaluer('expire', 'confirme').declencheEffet).toBe(true);
      expect(evaluer('en_attente', 'echoue').declencheEffet).toBe(false);
      expect(evaluer('en_attente', 'expire').declencheEffet).toBe(false);
    });

    it("n'est PAS déclenché par une annonce répétée", () => {
      // Webhook rejoué, ou réconciliation qui double le webhook : c'est le
      // cas normal, et il ne doit rien produire.
      const r = evaluer('confirme', 'confirme');
      expect(estRepetition('confirme', 'confirme')).toBe(true);
      expect(r.applique).toBe(false);
      expect(r.declencheEffet).toBe(false);
      expect(r.motif).toBe('repetition');
    });

    it("n'est pas déclenché par une transition refusée", () => {
      const r = evaluer('echoue', 'confirme');
      expect(r.applique).toBe(false);
      expect(r.declencheEffet).toBe(false);
      expect(r.motif).toBe('refusee');
    });
  });

  describe('rythme des interrogations', () => {
    it('serré au début, espacé ensuite', () => {
      expect(delaiProchaineVerification(0)).toBe(5);
      expect(delaiProchaineVerification(1)).toBe(5);
      const tard = delaiProchaineVerification(20);
      expect(tard).toBeGreaterThanOrEqual(300);
      // Croissance monotone : sans elle, on marteler ait le prestataire.
      let precedent = 0;
      for (let i = 0; i < 12; i++) {
        const d = delaiProchaineVerification(i);
        expect(d).toBeGreaterThanOrEqual(precedent);
        precedent = d;
      }
    });

    it('interroge immédiatement un paiement jamais vérifié', () => {
      expect(aInterroger({
        statut: 'en_attente', tentativesReconciliation: 0, creeLe: new Date(),
      })).toBe(true);
    });

    it('attend le délai avant de réinterroger', () => {
      const base = { statut: 'en_attente' as StatutPaiement, tentativesReconciliation: 0, creeLe: new Date() };
      expect(aInterroger({ ...base, derniereVerification: new Date() })).toBe(false);
      expect(aInterroger({ ...base, derniereVerification: ilYA(1) })).toBe(true);
    });

    it('continue de suivre un paiement EXPIRÉ — c’est le filet anti-encaissement à vide', () => {
      expect(aInterroger({
        statut: 'expire', tentativesReconciliation: 3, creeLe: ilYA(60), derniereVerification: ilYA(30),
      })).toBe(true);
    });

    it('cesse au-delà de la fenêtre de suivi', () => {
      const troploin = ilYA(SUIVI_APRES_EXPIRATION_HEURES * 60 + 10);
      expect(aInterroger({
        statut: 'expire', tentativesReconciliation: 9, creeLe: troploin, derniereVerification: ilYA(600),
      })).toBe(false);
    });

    it("n'interroge plus un paiement terminé", () => {
      for (const statut of ['confirme', 'echoue', 'rembourse'] as StatutPaiement[]) {
        expect(aInterroger({ statut, tentativesReconciliation: 0, creeLe: new Date() })).toBe(false);
      }
    });
  });

  describe('délai d’attente', () => {
    it('dépassé au-delà du délai, pas avant', () => {
      expect(estDepasse(ilYA(DELAI_EXPIRATION_MINUTES - 1))).toBe(false);
      expect(estDepasse(ilYA(DELAI_EXPIRATION_MINUTES + 1))).toBe(true);
    });

    it('la fenêtre de suivi dépasse largement le délai d’attente', () => {
      // Sinon le filet ne servirait à rien : on cesserait d'interroger au
      // moment même où l'on déclare l'expiration.
      expect(SUIVI_APRES_EXPIRATION_HEURES * 60).toBeGreaterThan(DELAI_EXPIRATION_MINUTES * 4);
    });
  });
});
