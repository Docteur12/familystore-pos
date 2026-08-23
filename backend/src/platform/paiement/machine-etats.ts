/**
 * Machine à états d'un paiement — logique pure, sans base ni prestataire.
 *
 * Elle est isolée ici pour la même raison que `joursAvantEcheance` : une
 * erreur de transition ne se voit pas à l'œil. Il faudrait un vrai paiement,
 * un vrai webhook et un vrai retard pour la constater — c'est-à-dire chez un
 * client, avec son argent.
 */

export type StatutPaiement = 'en_attente' | 'confirme' | 'echoue' | 'expire' | 'rembourse';

export const STATUTS: StatutPaiement[] = ['en_attente', 'confirme', 'echoue', 'expire', 'rembourse'];

/**
 * Transitions autorisées.
 *
 * Deux choix méritent explication :
 *
 * **`expire → confirme` est PERMIS.** En Mobile Money, une confirmation
 * arrive parfois bien après le délai d'attente : le client a saisi son code,
 * l'opérateur a mis vingt minutes. Refuser cette confirmation reviendrait à
 * encaisser sans rendre le service — le pire cas possible. On accepte donc la
 * confirmation tardive, et la boutique se crée à ce moment-là.
 *
 * **`echoue` est TERMINAL.** Un échec ne doit être inscrit que si le
 * prestataire l'affirme. Une panne réseau, une réponse illisible ou un délai
 * dépassé ne sont PAS des échecs : ils laissent le paiement `en_attente`,
 * que la réconciliation reprendra. Cette règle est ce qui rend l'état
 * terminal acceptable ; sans elle, un incident passager condamnerait un
 * paiement réussi.
 */
export const TRANSITIONS: Record<StatutPaiement, StatutPaiement[]> = {
  en_attente: ['confirme', 'echoue', 'expire'],
  expire:     ['confirme'],
  confirme:   ['rembourse'],
  echoue:     [],
  rembourse:  [],
};

/** États sur lesquels plus rien n'est attendu du prestataire. */
export const TERMINAUX: StatutPaiement[] = ['echoue', 'rembourse'];

export function estTerminal(statut: StatutPaiement): boolean {
  return TERMINAUX.includes(statut);
}

/**
 * Une même annonce reçue deux fois — webhook rejoué, réconciliation qui
 * double le webhook. Ce n'est pas une erreur : c'est le cas NORMAL, et il ne
 * doit produire aucun effet.
 */
export function estRepetition(de: StatutPaiement, vers: StatutPaiement): boolean {
  return de === vers;
}

export function transitionPermise(de: StatutPaiement, vers: StatutPaiement): boolean {
  return (TRANSITIONS[de] ?? []).includes(vers);
}

export interface Transition {
  /** `false` quand rien ne doit changer : répétition, ou transition refusée. */
  applique: boolean;
  /** `true` seulement au passage effectif vers `confirme`. */
  declencheEffet: boolean;
  motif: 'applique' | 'repetition' | 'refusee';
}

/**
 * Décide ce qu'il advient d'une annonce de statut.
 *
 * `declencheEffet` n'est vrai qu'à l'entrée dans `confirme`, et jamais sur
 * une répétition : c'est lui qui commande la création de la boutique ou la
 * prolongation de la licence. Le service ajoute par-dessus une garde en base
 * (`effetApplique`), parce qu'une décision juste ne suffit pas quand deux
 * chemins arrivent en même temps.
 */
export function evaluer(de: StatutPaiement, vers: StatutPaiement): Transition {
  if (estRepetition(de, vers)) return { applique: false, declencheEffet: false, motif: 'repetition' };
  if (!transitionPermise(de, vers)) return { applique: false, declencheEffet: false, motif: 'refusee' };
  return { applique: true, declencheEffet: vers === 'confirme', motif: 'applique' };
}

/**
 * Délai d'attente avant de déclarer un paiement expiré.
 *
 * Trente minutes : au-delà, le client a fermé son téléphone et refera une
 * demande. La confirmation tardive reste acceptée (voir `TRANSITIONS`), ce
 * qui rend ce délai peu risqué.
 */
export const DELAI_EXPIRATION_MINUTES = 30;

/**
 * Combien de temps continuer d'interroger le prestataire APRÈS expiration.
 *
 * Vingt-quatre heures : c'est le filet contre l'encaissement sans service.
 * Un paiement passé en `expire` chez nous mais réussi chez l'opérateur est
 * rattrapé le lendemain, sans intervention.
 */
export const SUIVI_APRES_EXPIRATION_HEURES = 24;

/**
 * Prochain intervalle d'interrogation, en secondes, selon le nombre de
 * tentatives déjà faites.
 *
 * Progressif : serré au début — le client attend devant son écran — puis
 * espacé, pour ne pas marteler le prestataire pendant vingt-quatre heures.
 */
export function delaiProchaineVerification(tentatives: number): number {
  const paliers = [5, 5, 10, 10, 20, 30, 60, 120, 300];
  return paliers[Math.min(tentatives, paliers.length - 1)] ?? 300;
}

/** Le paiement doit-il être interrogé maintenant ? */
export function aInterroger(
  p: { statut: StatutPaiement; tentativesReconciliation: number; derniereVerification?: Date; creeLe: Date },
  maintenant = new Date(),
): boolean {
  if (p.statut !== 'en_attente' && p.statut !== 'expire') return false;

  // Passé le suivi post-expiration, on cesse : le paiement est perdu, et
  // continuer d'interroger indéfiniment coûterait sans jamais rien rendre.
  const limite = p.creeLe.getTime() + SUIVI_APRES_EXPIRATION_HEURES * 3_600_000;
  if (maintenant.getTime() > limite) return false;

  if (!p.derniereVerification) return true;
  const attendu = delaiProchaineVerification(p.tentativesReconciliation) * 1000;
  return maintenant.getTime() - p.derniereVerification.getTime() >= attendu;
}

/** Le délai d'attente est-il dépassé ? */
export function estDepasse(creeLe: Date, maintenant = new Date()): boolean {
  return maintenant.getTime() - creeLe.getTime() > DELAI_EXPIRATION_MINUTES * 60_000;
}
