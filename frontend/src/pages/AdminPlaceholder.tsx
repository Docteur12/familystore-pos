import React from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { useLocation } from 'react-router-dom';

const LABELS: Record<string, { title: string; sub: string }> = {
  '/admin/comptabilite':  { title: 'Comptabilité',     sub: 'Suivi des entrées, sorties et bilans financiers' },
  '/admin/roles':         { title: 'Rôles & accès',    sub: 'Gestion des permissions par profil utilisateur' },
  '/admin/audit':         { title: 'Audit & logs',     sub: 'Journal des actions système et des événements' },
  '/admin/exports':       { title: 'Exports',          sub: 'Téléchargement des données en CSV / Excel / PDF' },
};

export default function AdminPlaceholder() {
  const { pathname } = useLocation();
  const info = LABELS[pathname] ?? { title: 'Page', sub: 'En cours de construction' };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Administration</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>{info.title}</h1>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--fs-wine-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--fs-wine-700)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 6, fontFamily: 'var(--fs-font-display)' }}>{info.title}</div>
            <div style={{ fontSize: 13, color: 'var(--fs-ink-400)', maxWidth: 320 }}>{info.sub}</div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fs-ink-300)', fontStyle: 'italic' }}>Module en cours de développement</div>
          </div>
        </div>
      </main>
    </div>
  );
}
