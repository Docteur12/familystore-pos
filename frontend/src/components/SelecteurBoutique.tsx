import React, { useCallback, useEffect, useState } from 'react';
import { getTokenPayload } from '../api/dashboard';
import { getBoutiquesProprietaire, basculerBoutique, BoutiqueProprietaire } from '../api/consolide';
import { basculerVersBoutique } from '../services/session';
import { filesEnAttente, messagePerteFiles } from '../services/session';
import { boutiqueActive } from '../services/storage';
import { t } from '../i18n';

/**
 * Sélecteur de boutique du propriétaire.
 *
 * Ne s'affiche QUE s'il y a plus d'une boutique : un commerçant qui n'en a
 * qu'une ne doit voir aucune trace de cette mécanique.
 *
 * Le nom de la boutique active est affiché **en permanence**, pas seulement au
 * moment du choix : une vente encaissée dans la mauvaise boutique est
 * irrattrapable pour un caissier.
 *
 * Avant de quitter une boutique dont des ventes ne sont pas encore envoyées,
 * l'utilisateur est prévenu — le lot A garantit que ces ventes survivent à la
 * bascule, mais il ne doit pas le découvrir au retour.
 */
export default function SelecteurBoutique({ compact = false }: { compact?: boolean }) {
  const payload = getTokenPayload();
  const idsAutorises = payload?.boutiques ?? [];
  const active = boutiqueActive();

  const [boutiques, setBoutiques] = useState<BoutiqueProprietaire[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (idsAutorises.length > 1) getBoutiquesProprietaire().then(setBoutiques).catch(() => {});
  }, [idsAutorises.length]);

  const changer = useCallback(async (cible: BoutiqueProprietaire) => {
    if (cible.boutiqueId === active) { setOuvert(false); return; }

    // Ventes encore en file dans la boutique qu'on quitte : on prévient AVANT.
    // Elles ne seront pas perdues (chaque boutique garde sa file et son jeton),
    // mais il faudra revenir ici pour les envoyer.
    if (active) {
      const files = await filesEnAttente(active);
      if (files.total > 0) {
        const nomActuel = boutiques.find(b => b.boutiqueId === active)?.nom ?? active;
        const detail = messagePerteFiles(files).split('\n')[0].replace(/^Attention : |^Warning: /, '');
        const ok = window.confirm(
          t(
            `Dans ${nomActuel} : ${detail}\n\nCes éléments sont conservés et partiront quand vous reviendrez sur cette boutique. Basculer vers ${cible.nom} ?`,
            `In ${nomActuel}: ${detail}\n\nThese are kept and will be sent when you return to this store. Switch to ${cible.nom}?`,
          ),
        );
        if (!ok) { setOuvert(false); return; }
      }
    }

    setEnCours(true);
    try {
      const jetonCible = await basculerBoutique(cible.boutiqueId);
      // Pose le jeton sous SA boutique et prépare la langue d'arrivée — un
      // seul rechargement suffit ensuite (voir lot A).
      await basculerVersBoutique(jetonCible);
      window.location.href = '/';
    } catch {
      setEnCours(false);
      setOuvert(false);
      alert(t('Bascule impossible. Reconnectez-vous.', 'Switch failed. Please sign in again.'));
    }
  }, [active, boutiques]);

  // Boutique unique : aucune trace de la mécanique multi-boutiques.
  if (idsAutorises.length <= 1) return null;

  const nomActif = boutiques.find(b => b.boutiqueId === active)?.nom
    ?? t('Boutique', 'Store');

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOuvert(o => !o)}
        disabled={enCours}
        title={t('Changer de boutique', 'Switch store')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: compact ? '6px 10px' : '9px 12px', borderRadius: 8,
          border: '1.5px solid var(--fs-gold-500)', background: 'rgba(255,255,255,0.08)',
          color: '#f5ebd9', cursor: enCours ? 'default' : 'pointer',
          fontSize: compact ? 12 : 13, fontFamily: 'var(--fs-font-sans)', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
          {t('Boutique', 'Store')}
        </span>
        <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nomActif}
        </strong>
        <span style={{ opacity: 0.7 }}>▾</span>
      </button>

      {ouvert && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid var(--fs-line-2)', borderRadius: 8,
          boxShadow: 'var(--fs-shadow-md, 0 8px 24px rgba(0,0,0,0.18))', overflow: 'hidden',
        }}>
          {boutiques.map(b => (
            <button
              key={b.boutiqueId}
              type="button"
              onClick={() => changer(b)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', border: 'none', cursor: 'pointer',
                background: b.boutiqueId === active ? 'var(--fs-ivory)' : '#fff',
                color: 'var(--fs-ink-900)', fontSize: 13,
                fontWeight: b.boutiqueId === active ? 700 : 500,
              }}
            >
              {b.nom}{b.boutiqueId === active ? ` — ${t('actuelle', 'current')}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
