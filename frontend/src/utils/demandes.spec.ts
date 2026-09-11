/**
 * Demandes d'ouverture — ordre et badges dans le back-office et chez le patron.
 *
 * Une demande « à traiter » rangée sous les traitées, c'est un client qui a
 * payé et attend sa boutique sans que le revendeur le voie.
 */
import { describe, it, expect } from 'vitest';
import { trierDemandes, etiquetteDemande } from './plateforme';
import type { DemandeBoutique } from '../api/plateforme';

const demande = (nom: string, statut: 'en_attente' | 'acceptee' | 'refusee', cree: string): DemandeBoutique => ({
  id: nom, nom, ville: 'Douala', proprietaire: { email: 'p@x.cm', nom: 'P' }, patron: { nom: 'P', email: 'p@x.cm' },
  telephone: '', message: '', statut, traiteeLe: null, traiteePar: '', motifRefus: '', boutiqueId: null, referencePaiement: '', cree,
});

describe('demandes d’ouverture', () => {
  it('à traiter d’abord, la plus ancienne en tête ; puis les traitées, les plus récentes d’abord', () => {
    const tri = trierDemandes([
      demande('AccepteeVieille', 'acceptee', '2026-09-01'),
      demande('AttenteRecente', 'en_attente', '2026-09-10'),
      demande('RefuseeRecente', 'refusee', '2026-09-09'),
      demande('AttenteAncienne', 'en_attente', '2026-09-02'),
    ]);
    expect(tri.map(d => d.nom)).toEqual(['AttenteAncienne', 'AttenteRecente', 'RefuseeRecente', 'AccepteeVieille']);
  });

  it('ne mute pas la liste reçue', () => {
    const source = [demande('B', 'refusee', '2026-09-01'), demande('A', 'en_attente', '2026-09-02')];
    trierDemandes(source);
    expect(source.map(d => d.nom)).toEqual(['B', 'A']);
  });

  it('chaque statut a un badge lisible', () => {
    expect(etiquetteDemande('en_attente').texte).toBe('À traiter');
    expect(etiquetteDemande('acceptee').texte).toBe('Acceptée');
    expect(etiquetteDemande('refusee').texte).toBe('Refusée');
  });
});
