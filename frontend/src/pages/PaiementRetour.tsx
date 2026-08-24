/**
 * Retour depuis la page de paiement hébergée — page CUL-DE-SAC assumée.
 *
 * ═══ ELLE NE CRÉDITE RIEN, ET NE LIT MÊME PAS LE PAIEMENT ═══
 *
 * C'est l'adresse configurée comme « URL de succès / annulation / erreur »
 * chez le prestataire. Ces adresses ne sont PAS une source de vérité : le
 * navigateur du payeur y arrive parce qu'on l'y a envoyé, ce que n'importe
 * qui peut faire en tapant l'adresse. Les traiter comme une confirmation
 * reviendrait à offrir une boutique à qui connaît l'URL.
 *
 * L'autorité est ailleurs, et uniquement là : l'appel `checkStatus` serveur à
 * serveur, déclenché par le webhook ou par la réconciliation active. L'écran
 * qui a ouvert le paiement interroge notre propre route toutes les 4 s et
 * conclura de lui-même.
 *
 * Cette page dit donc une seule chose : « retournez à votre autre onglet ».
 * Elle existe parce que sans elle, le payeur atterrissait sur un écran qui
 * n'avait rien à lui dire.
 *
 * PUBLIQUE, sans authentification : le règlement peut se faire depuis un autre
 * appareil que celui où la session est ouverte — un téléphone, typiquement,
 * puisqu'il s'agit de Mobile Money.
 */
import React from 'react';
import { COULEUR_MARQUE } from '../config/marque';
import { t } from '../i18n';

// Couleurs fixes : cette page précède toute notion de boutique, elle ne doit
// porter l'identité d'aucun client. Même règle que l'écran de connexion.
const ENCRE = '#2E3238';
const ENCRE_PALE = '#8A9099';

export default function PaiementRetour() {
  return (
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      background: '#F5F0E8',
      display: 'flex',
      justifyContent: 'center',
      padding: '24px 16px',
      boxSizing: 'border-box',
      fontFamily: 'var(--fs-font-sans)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, margin: 'auto', textAlign: 'center' }}>

        <div style={{
          width: 56, height: 56, borderRadius: 18, margin: '0 auto 16px',
          background: COULEUR_MARQUE, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12h11M11 7l5 5-5 5"/>
            <path d="M19 5v14"/>
          </svg>
        </div>

        <h1 style={{
          fontFamily: 'var(--fs-font-display)', fontSize: 23, fontWeight: 600,
          color: ENCRE, margin: 0, letterSpacing: '0.02em',
        }}>
          {t('Paiement transmis', 'Payment submitted')}
        </h1>

        <div style={{
          background: '#fff', border: '1px solid #E6E1D8', borderRadius: 14,
          padding: '20px 22px', marginTop: 20, textAlign: 'left',
        }}>
          <p style={{ fontSize: 13.5, color: ENCRE, lineHeight: 1.7, margin: 0 }}>
            {t(
              'Retournez à l’onglet Caméléon resté ouvert : c’est lui qui suit votre règlement et vous dira quand la boutique est créée.',
              'Go back to the Caméléon tab you left open: it is following your payment and will tell you when the store is ready.',
            )}
          </p>
          <p style={{ fontSize: 12.5, color: ENCRE_PALE, lineHeight: 1.7, margin: '14px 0 0' }}>
            {t(
              'Vous pouvez fermer cette page. Si vous avez payé depuis un autre appareil, revenez simplement à celui où vous aviez commencé.',
              'You can close this page. If you paid from another device, just go back to the one where you started.',
            )}
          </p>
        </div>

        {/* Dit explicitement que cette page ne prouve rien : sans cela, un
            commerçant pourrait croire que « y être arrivé » vaut paiement,
            et s'étonner que sa boutique n'existe pas. */}
        <p style={{ fontSize: 11.5, color: ENCRE_PALE, lineHeight: 1.6, margin: '16px 0 0' }}>
          {t(
            'Cette page ne confirme pas le règlement : la confirmation vient de l’opérateur, vérifiée directement par nos serveurs. Un paiement abouti crée la boutique même si vous fermez tout.',
            'This page does not confirm the payment: confirmation comes from the operator and is checked by our servers. A completed payment creates the store even if you close everything.',
          )}
        </p>

        <p style={{ fontSize: 11, color: ENCRE_PALE, marginTop: 22 }}>
          Caméléon &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
