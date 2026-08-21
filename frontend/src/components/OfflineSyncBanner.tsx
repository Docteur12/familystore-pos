import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getPendingMagazin, syncMagazin } from '../services/offlineMagazin';
import { t } from '../i18n';

/**
 * Bandeau « opérations enregistrées hors connexion » + synchronisation
 * automatique (à l'ouverture de la page et au retour du réseau).
 * Ne rend rien quand la file est vide.
 */
export default function OfflineSyncBanner({ onSynced, addToast }: {
  onSynced?: () => void;
  addToast?: (msg: string, type: 'success' | 'error' | 'warning') => void;
}) {
  const [pending, setPending] = useState({ produits: 0, receptions: 0, ajouts: 0, ajustements: 0, total: 0 });

  // Refs pour garder des callbacks stables (pas de re-synchro en boucle)
  const onSyncedRef = useRef(onSynced);  onSyncedRef.current = onSynced;
  const addToastRef = useRef(addToast);  addToastRef.current = addToast;

  const refresh = useCallback(() => { getPendingMagazin().then(setPending).catch(() => {}); }, []);

  const lancer = useCallback(async (silencieux = true) => {
    try {
      const r = await syncMagazin();
      const n = r.produitsSync + r.receptionsSync + r.stockSync;
      if (n > 0) {
        addToastRef.current?.(t(`Synchronisation ✓ — ${n} opération(s) envoyée(s) au serveur`, `Sync ✓ — ${n} operation(s) sent to the server`), 'success');
        onSyncedRef.current?.();
      } else if (!silencieux && r.restants > 0) {
        addToastRef.current?.(t('Synchronisation impossible — toujours hors connexion ou erreur serveur', 'Sync failed — still offline or server error'), 'warning');
      }
    } catch { /* silencieux */ }
    refresh();
  }, [refresh]);

  useEffect(() => {
    lancer();
    const onOnline = () => lancer();
    window.addEventListener('online', onOnline);
    // Une opération vient d'entrer en file (mise hors-ligne) → mettre à jour le compteur
    window.addEventListener('offline-queue-changed', refresh);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline-queue-changed', refresh);
    };
  }, [lancer, refresh]);

  if (pending.total === 0) return null;

  const morceaux = [
    pending.produits > 0 ? t(`${pending.produits} produit(s)`, `${pending.produits} product(s)`) : '',
    pending.receptions > 0 ? t(`${pending.receptions} réception(s)`, `${pending.receptions} goods receipt(s)`) : '',
    (pending.ajouts + pending.ajustements) > 0 ? t(`${pending.ajouts + pending.ajustements} mise(s) à jour de stock`, `${pending.ajouts + pending.ajustements} stock update(s)`) : '',
  ].filter(Boolean).join(', ');

  return (
    <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
        ⏳ {morceaux} {t('enregistré(s) hors connexion — envoi automatique au retour du réseau.', 'saved offline — will be sent automatically when the connection returns.')}
      </span>
      <button onClick={() => lancer(false)}
        style={{ padding: '4px 12px', background: '#b45309', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        {t('Synchroniser maintenant', 'Sync now')}
      </button>
    </div>
  );
}
