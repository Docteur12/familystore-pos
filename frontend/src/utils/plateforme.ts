/**
 * Règles d'affichage du back-office plateforme — logique pure, testable.
 *
 * Le revendeur ouvre cet écran pour savoir QUI appeler et QUAND : les
 * boutiques expirées d'abord, puis celles qui approchent, puis les autres.
 * Une erreur de tri ou de libellé ici, c'est un client relancé trop tard.
 */
import type { BoutiquePlateforme, LicenceBoutique, MoyenReglement, DemandeBoutique, StatutDemande } from '../api/plateforme';
import { MOYENS_REGLEMENT } from '../api/plateforme';
import { niveauAlerte, NiveauAlerte } from './licence';
import { t } from '../i18n';

export interface EtiquetteLicence {
  niveau: NiveauAlerte | 'inconnue';
  texte: string;
}

/** Ce qu'on écrit dans la colonne « Licence » d'une boutique. */
export function etiquetteLicence(licence: LicenceBoutique | null): EtiquetteLicence {
  if (!licence) return { niveau: 'inconnue', texte: t('Aucune licence', 'No licence') };
  const niveau = niveauAlerte(licence.joursRestants, licence.expiree);
  if (licence.expiree) {
    const depuis = Math.abs(licence.joursRestants);
    return { niveau, texte: depuis <= 1 ? t('Expirée hier', 'Expired yesterday') : t(`Expirée depuis ${depuis} j`, `Expired ${depuis} days ago`) };
  }
  if (licence.joursRestants === 0) return { niveau, texte: t('Expire aujourd’hui', 'Expires today') };
  if (licence.joursRestants === 1) return { niveau, texte: t('Expire demain', 'Expires tomorrow') };
  return { niveau, texte: t(`${licence.joursRestants} j restants`, `${licence.joursRestants} days left`) };
}

/**
 * Ordre d'affichage : expirées, puis par jours restants croissants, puis les
 * boutiques sans licence, puis par nom. Les suspendues gardent leur place —
 * une boutique suspendue ET expirée reste un client à rappeler.
 */
export function trierBoutiques(boutiques: BoutiquePlateforme[]): BoutiquePlateforme[] {
  const rang = (b: BoutiquePlateforme) => {
    if (!b.licence) return Number.MAX_SAFE_INTEGER;
    if (b.licence.expiree) return -1_000_000 + b.licence.joursRestants;   // plus ancienne expiration d'abord
    return b.licence.joursRestants;
  };
  return [...boutiques].sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom));
}

export function libelleMoyen(moyen: MoyenReglement | string | null | undefined): string {
  const trouve = MOYENS_REGLEMENT.find(m => m.id === moyen);
  return trouve ? trouve.label : (moyen ?? '—');
}

/** Montant lisible : « 120 000 XAF ». */
export function montantLisible(montant: number, devise = 'XAF'): string {
  // fr-FR sépare les milliers par une espace fine insécable (U+202F) ou
  // insécable (U+00A0) : on les remplace par une espace ordinaire.
  return `${Math.round(montant).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} ${devise}`;
}

// ── Demandes d'ouverture ───────────────────────────────────────────────────


export interface EtiquetteDemande { texte: string; fond: string; texteCouleur: string }

/** Badge d'une demande : lisible d'un coup d'œil dans la liste du revendeur. */
export function etiquetteDemande(statut: StatutDemande): EtiquetteDemande {
  switch (statut) {
    case 'en_attente': return { texte: t('À traiter', 'To process'), fond: '#FEF3C7', texteCouleur: '#7C2D12' };
    case 'acceptee':   return { texte: t('Acceptée', 'Accepted'),   fond: '#E6F4EA', texteCouleur: '#1E6B3A' };
    case 'refusee':    return { texte: t('Refusée', 'Declined'),    fond: '#FEE2E2', texteCouleur: '#7F1D1D' };
  }
}

/**
 * Ordre d'affichage : à traiter d'abord (la plus ancienne en tête — elle
 * attend depuis le plus longtemps), puis les traitées, les plus récentes
 * d'abord.
 */
export function trierDemandes(demandes: DemandeBoutique[]): DemandeBoutique[] {
  const date = (d: DemandeBoutique) => (d.cree ? new Date(d.cree).getTime() : 0);
  return [...demandes].sort((a, b) => {
    const attenteA = a.statut === 'en_attente' ? 0 : 1;
    const attenteB = b.statut === 'en_attente' ? 0 : 1;
    if (attenteA !== attenteB) return attenteA - attenteB;
    return attenteA === 0 ? date(a) - date(b) : date(b) - date(a);
  });
}
