import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getPendingMagazin, syncMagazin } from '../services/offlineMagazin';

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
        addToastRef.current?.(`Synchronisation ✓ — ${n} opération(s) envoyée(s) au serveur`, 'success');
        onSyncedRef.current?.();
      } else if (!silencieux && r.restants > 0) {
        addToastRef.current?.('Synchronisation impossible — toujours hors connexion ou erreur serveur', 'warning');
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
    pending.produits > 0 ? `${pending.produits} produit(s)` : '',
    pending.receptions > 0 ? `${pending.receptions} réception(s)` : '',
    (pending.ajouts + pending.ajustements) > 0 ? `${pending.ajouts + pending.ajustements} mise(s) à jour de stock` : '',
  ].filter(Boolean).join(', ');

  return (
    <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
        ⏳ {morceaux} enregistré(s) hors connexion — envoi automatique au retour du réseau.
      </span>
      <button onClick={() => lancer(false)}
        style={{ padding: '4px 12px', background: '#b45309', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        Synchroniser maintenant
      </button>
    </div>
  );
}
