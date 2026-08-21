/**
 * Dérivation du PIN de caisse (config/pin.ts).
 *
 * Les PARAMÈTRES (PBKDF2-SHA256, 100 000 itérations, 32 octets) sont un
 * contrat partagé avec le frontend (utils/pin.ts, WebCrypto) ET avec les
 * dérivations déjà écrites en base par migrate-pin-caisses. Les changer
 * invaliderait tous les PIN existants : le vecteur figé ci-dessous casse si
 * quelqu'un y touche.
 */
import { webcrypto } from 'node:crypto';
import { deriverPin, nouveauSelPin, verifierPin, PIN_KDF_ITERATIONS, PIN_KDF_BYTES } from '../src/config/pin';

describe('PIN de caisse — dérivation PBKDF2', () => {
  it('vérifie un PIN correct et rejette un PIN faux', () => {
    const salt = nouveauSelPin();
    const kdf = deriverPin('4271', salt);
    expect(verifierPin('4271', salt, kdf)).toBe(true);
    expect(verifierPin('0000', salt, kdf)).toBe(false);
    expect(verifierPin('4271', nouveauSelPin(), kdf)).toBe(false); // mauvais sel
  });

  it('vecteur figé — les paramètres du contrat serveur/client/base ne doivent pas changer', () => {
    expect(PIN_KDF_ITERATIONS).toBe(100_000);
    expect(PIN_KDF_BYTES).toBe(32);
    // PBKDF2-SHA256('1234', base64('sel-fixe-test0'), 100000, 32)
    expect(deriverPin('1234', Buffer.from('sel-fixe-test0').toString('base64')))
      .toBe('BsmLAglP6tWmOWIviNtA819Cusl0nSVBNRlZZx9hqM4=');
  });

  it('le client (WebCrypto) dérive exactement la même valeur que le serveur', async () => {
    const salt = nouveauSelPin();
    const serveur = deriverPin('9058', salt);
    // Réimplémentation frontend (utils/pin.ts) sur le WebCrypto de Node
    const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode('9058'), 'PBKDF2', false, ['deriveBits']);
    const bits = await webcrypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(Buffer.from(salt, 'base64')), iterations: PIN_KDF_ITERATIONS },
      key,
      PIN_KDF_BYTES * 8,
    );
    expect(Buffer.from(bits).toString('base64')).toBe(serveur);
  });
});
