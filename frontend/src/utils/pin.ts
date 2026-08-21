// Vérification hors-ligne du PIN de caisse — PBKDF2-SHA256 via WebCrypto.
//
// Le serveur ne transmet jamais le PIN en clair : le jeton porte la dérivation
// {pinKdf, pinSalt} (voir backend/src/config/pin.ts — les paramètres DOIVENT
// rester identiques des deux côtés). La caisse refait le même calcul sur la
// saisie, même sans réseau. Le calcul prend ~50 ms : imperceptible à la
// saisie, coûteux pour une attaque par force brute.

import { t } from '../i18n';

const ITERATIONS = 100_000;
const BYTES = 32;

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const bytesToB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

export async function verifierPin(saisie: string, pinSalt: string, pinKdf: string): Promise<boolean> {
  if (!saisie || !pinSalt || !pinKdf) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(saisie), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(pinSalt), iterations: ITERATIONS },
      key,
      BYTES * 8,
    );
    return bytesToB64(bits) === pinKdf;
  } catch {
    // WebCrypto exige un contexte sécurisé (https ou localhost) — toujours le
    // cas en production (Netlify) et en dev (localhost).
    alert(t('Vérification du PIN impossible sur cette connexion (non sécurisée).', 'PIN check unavailable on this (insecure) connection.'));
    return false;
  }
}
