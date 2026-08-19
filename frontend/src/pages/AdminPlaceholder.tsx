import React from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { useLocation } from 'react-router-dom';
import { t } from '../i18n';

const LABELS: Record<string, { title: string; sub: string }> = {
  '/admin/comptabilite':  { title: t('Comptabilité', 'Accounting'),   sub: t('Suivi des entrées, sorties et bilans financiers', 'Tracking of income, expenses and financial statements') },
  '/admin/roles':         { title: t('Rôles & accès', 'Roles & access'), sub: t('Gestion des permissions par profil utilisateur', 'Permission management by user profile') },
  '/admin/audit':         { title: t('Audit & logs', 'Audit & logs'), sub: t('Journal des actions système et des événements', 'Log of system actions and events') },
  '/admin/exports':       { title: t('Exports', 'Exports'),           sub: t('Téléchargement des données en CSV / Excel / PDF', 'Data download in CSV / Excel / PDF') },
};

export default function AdminPlaceholder() {
  const { pathname } = useLocation();
  const info = LABELS[pathname] ?? { title: t('Page', 'Page'), sub: t('En cours de construction', 'Under construction') };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Administration', 'Administration')}</p>
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
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fs-ink-300)', fontStyle: 'italic' }}>{t('Module en cours de développement', 'Module under development')}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
