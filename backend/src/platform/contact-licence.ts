/**
 * Contact de renouvellement des licences — le numéro qu'un commerçant appelle.
 *
 * En mode manuel (voir `choisir-prestataire.ts`), le bandeau de préavis, le
 * refus 402 d'une licence expirée et les relances par e-mail ne peuvent pas
 * renvoyer vers une page de paiement : ils donnent un CONTACT. Il vient de
 * `CONTACT_LICENCE` ; à défaut, le numéro du revendeur tel qu'il figure déjà
 * sur les tickets des boutiques ouvertes par lui.
 */
export const CONTACT_LICENCE_DEFAUT = '+237 6 74 63 54 11';

export function contactLicence(env: NodeJS.ProcessEnv = process.env): string {
  return (env.CONTACT_LICENCE ?? '').trim() || CONTACT_LICENCE_DEFAUT;
}

/** Phrase unique, reprise partout où l'on dit comment renouveler. */
export function consigneRenouvellement(env: NodeJS.ProcessEnv = process.env): string {
  return `Pour renouveler, contactez votre revendeur au ${contactLicence(env)} : il active la licence dès le règlement reçu.`;
}
