import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Dérivation du PIN de caisse — PBKDF2-SHA256.
 *
 * Le PIN doit être vérifiable HORS-LIGNE par la caisse (verrouillage local) :
 * un hachage purement serveur (bcrypt) ne suffit pas. Le jeton transporte donc
 * la dérivation + le sel, et le client refait le même calcul via WebCrypto
 * (voir frontend/src/utils/pin.ts — les paramètres DOIVENT rester identiques).
 *
 * Un PIN à 4 chiffres n'a que 10 000 combinaisons : les 100 000 itérations
 * rendent la force brute coûteuse sans être hors de portée — c'est une vraie
 * amélioration sur le clair (base et jeton), pas un coffre-fort.
 */
export const PIN_KDF_ITERATIONS = 100_000;
export const PIN_KDF_BYTES = 32;

export function deriverPin(pin: string, saltB64: string): string {
  return pbkdf2Sync(pin, Buffer.from(saltB64, 'base64'), PIN_KDF_ITERATIONS, PIN_KDF_BYTES, 'sha256').toString('base64');
}

export function nouveauSelPin(): string {
  return randomBytes(16).toString('base64');
}

export function verifierPin(pin: string, saltB64: string, kdfB64: string): boolean {
  const a = Buffer.from(deriverPin(pin, saltB64), 'base64');
  const b = Buffer.from(kdfB64, 'base64');
  return a.length === b.length && timingSafeEqual(a, b);
}
