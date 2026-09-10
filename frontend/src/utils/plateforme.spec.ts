/**
 * Back-office plateforme — ordre et libellés des licences.
 *
 * Le revendeur doit voir en premier qui appeler : une boutique expirée
 * rangée en bas de liste, c'est un client bloqué qu'on découvre en retard.
 */
import { describe, it, expect } from 'vitest';
import { etiquetteLicence, trierBoutiques, libelleMoyen, montantLisible } from './plateforme';
import type { BoutiquePlateforme } from '../api/plateforme';

const boutique = (nom: string, licence: BoutiquePlateforme['licence']): BoutiquePlateforme => ({
  id: nom, nom, ville: 'Douala', tenantId: nom, statut: 'active', proprietaire: null, licence,
});
const lic = (joursRestants: number, expiree = false) =>
  ({ montant: 120_000, devise: 'XAF', dateEcheance: '2027-01-01', expiree, joursRestants });

describe('étiquette de licence', () => {
  it('dit depuis quand une licence est expirée', () => {
    expect(etiquetteLicence(lic(-12, true))).toEqual({ niveau: 'expire', texte: 'Expirée depuis 12 j' });
    expect(etiquetteLicence(lic(-1, true)).texte).toBe('Expirée hier');
  });

  it('compte les jours restants, avec les cas du jour même et de demain', () => {
    expect(etiquetteLicence(lic(0))).toEqual({ niveau: 'urgent', texte: 'Expire aujourd’hui' });
    expect(etiquetteLicence(lic(1)).texte).toBe('Expire demain');
    expect(etiquetteLicence(lic(10))).toEqual({ niveau: 'info', texte: '10 j restants' });
    expect(etiquetteLicence(lic(200)).niveau).toBe('aucun');
  });

  it('sans licence : le dit, sans inventer une échéance', () => {
    expect(etiquetteLicence(null)).toEqual({ niveau: 'inconnue', texte: 'Aucune licence' });
  });
});

describe('ordre des boutiques', () => {
  it('expirées d’abord (la plus ancienne en tête), puis par urgence, puis sans licence', () => {
    const tri = trierBoutiques([
      boutique('Sereine', lic(300)),
      boutique('SansLicence', null),
      boutique('Proche', lic(5)),
      boutique('ExpireeRecente', lic(-2, true)),
      boutique('ExpireeAncienne', lic(-40, true)),
    ]);
    expect(tri.map(b => b.nom)).toEqual(['ExpireeAncienne', 'ExpireeRecente', 'Proche', 'Sereine', 'SansLicence']);
  });

  it('à égalité, par nom — et sans muter la liste reçue', () => {
    const source = [boutique('Zeta', lic(10)), boutique('Alpha', lic(10))];
    const tri = trierBoutiques(source);
    expect(tri.map(b => b.nom)).toEqual(['Alpha', 'Zeta']);
    expect(source.map(b => b.nom)).toEqual(['Zeta', 'Alpha']);
  });
});

describe('libellés', () => {
  it('nomme chaque moyen de règlement, et rend la valeur brute pour un inconnu', () => {
    expect(libelleMoyen('mobile_money')).toBe('Mobile Money');
    expect(libelleMoyen('especes')).toBe('Espèces');
    expect(libelleMoyen(null)).toBe('—');
  });

  it('écrit les montants avec des espaces ordinaires (pas d’insécables)', () => {
    expect(montantLisible(120_000)).toBe('120 000 XAF');
    expect(montantLisible(0, 'XAF')).toBe('0 XAF');
  });
});
