import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { boutiquesBloquees, BoutiqueBloquee } from '../services/session';
import { t } from '../i18n';

/**
 * Bandeau « des ventes attendent sur une autre boutique ».
 *
 * Une file hors-ligne dont le jeton a expiré ne peut plus partir : sans
 * signal, ces ventes resteraient invisibles jusqu'à ce que quelqu'un s'en
 * étonne — c'est-à-dire trop tard. Le bandeau est donc affiché **en tête de
 * page**, pas rangé dans un menu, et il nomme la boutique et le nombre.
 *
 * Le bouton mène à la reconnexion SUR CETTE boutique (`/login?boutique=<id>`)
 * et non à une page de connexion générique : se reconnecter ailleurs ne
 * débloquerait rien.
 */
export default function FilesBloqueesBanner() {
  const [bloquees, setBloquees] = useState<BoutiqueBloquee[]>([]);
  const navigate = useNavigate();

  const rafraichir = useCallback(() => {
    boutiquesBloquees().then(setBloquees).catch(() => setBloquees([]));
  }, []);

  useEffect(() => {
    rafraichir();
    // Une file qui vient de partir doit faire disparaître le bandeau.
    window.addEventListener('offline-queue-changed', rafraichir);
    window.addEventListener('online', rafraichir);
    return () => {
      window.removeEventListener('offline-queue-changed', rafraichir);
      window.removeEventListener('online', rafraichir);
    };
  }, [rafraichir]);

  if (bloquees.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 0 12px' }}>
      {bloquees.map(b => (
        <div
          key={b.boutiqueId}
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap',
            padding: '12px 16px', borderRadius: 10,
            background: '#FEF3C7', border: '1.5px solid #F59E0B', color: '#7C2D12',
            fontSize: 13, fontFamily: 'var(--fs-font-sans)',
          }}
        >
          <span>
            <strong>
              {b.total} {t('vente(s)', 'sale(s)')} {t('de', 'from')} {b.nom}
            </strong>{' '}
            {t(
              'attendent d’être envoyées. Reconnectez-vous sur cette boutique pour les synchroniser.',
              'are waiting to be sent. Sign in to that store to sync them.',
            )}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/login?boutique=${encodeURIComponent(b.boutiqueId)}`)}
            style={{
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              border: 'none', background: '#B45309', color: '#fff',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            {t('Se reconnecter sur', 'Sign in to')} {b.nom}
          </button>
        </div>
      ))}
    </div>
  );
}
