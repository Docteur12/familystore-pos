import SelecteurBoutique from './SelecteurBoutique';
import { deconnexion } from '../services/session';
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getTokenPayload } from '../api/dashboard';
import { updateUser } from '../api/auth';
import { logAccesEspace } from '../api/audit';
import { useSettings } from '../contexts/SettingsContext';
import type { ModuleId } from '../api/settings';
import { useIsMobile } from '../hooks/useIsMobile';
import { nomEnseigne, COULEUR_MARQUE } from '../config/marque';
import { t } from '../i18n';

const BG       = 'var(--fs-wine-900)';
const ACT      = 'var(--fs-wine-700)';
const SIDEBAR_W = 200;

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const D = {
  dashboard:    'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  rapports:     'M18 20V10M12 20V4M6 20v-6',
  journal:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  compta:       'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  factures:     'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M12 12h.01M8 12h.01M16 12h.01',
  equipe:       'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  caissiers:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  gestionnaires:'M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM1 10h22',
  roles:        'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  caisses:      'M3 3h18v5H3zM3 8h18v13H3zM8 12h2M12 12h4M8 16h2M12 16h4',
  parametres:   'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  sessions:     'M12 8v4l3 3M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
  audit:        'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  exports:      'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  logout:       'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12',
  menu:         'M3 6h18M3 12h18M3 18h18',
  close:        'M18 6L6 18M6 6l12 12',
  manuel:       'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM9 7h6M9 11h6',
  // Imprimante — page « Installer un poste de caisse »
  posteCaisse:  'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  caisseSpace:  'M2 7h20v10H2zM2 11h20M6 15h4',
  stockSpace:   'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  magSpace:     'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
};

type NavItem = {
  id: string; label: string; icon: string; path: string;
  external?: boolean; module?: ModuleId;
  /** Entrée dont l'adresse vient des paramètres de la boutique ; masquée si vide. */
  reglage?: 'manuelUrl';
  /** Réservé aux propriétaires de plusieurs boutiques — invisible sinon. */
  multiBoutique?: boolean;
};
type NavSection = { title: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: t('Pilotage', 'Overview'),
    items: [
      { id: 'dashboard',    label: t('Tableau de bord', 'Dashboard'),    icon: D.dashboard,    path: '/admin/dashboard'     },
      { id: 'rapports',     label: t('Rapports & analyses', 'Reports & analytics'), icon: D.rapports,     path: '/admin/rapports'      },
      { id: 'consolide',    label: t('Rapport consolidé', 'Consolidated report'), icon: D.rapports, path: '/admin/consolide', multiBoutique: true },
      { id: 'journal',      label: t('Journal des ventes', 'Sales journal'),  icon: D.journal,      path: '/admin/journal'        },
      { id: 'compta',       label: t('Comptabilité', 'Accounting'),        icon: D.compta,       path: '/admin/comptabilite'  },
      { id: 'factures',     label: t('Historique factures', 'Invoice history'), icon: D.factures,     path: '/admin/factures'       },
    ],
  },
  {
    title: t('Personnel', 'Staff'),
    items: [
      { id: 'equipe',        label: t('Équipe', 'Team'),            icon: D.equipe,        path: '/admin/equipe'        },
      { id: 'caissiers',     label: t('Caissiers', 'Cashiers'),          icon: D.caissiers,     path: '/admin/caissiers'     },
      { id: 'gestionnaires', label: t('Gestionnaires', 'Stock managers'),      icon: D.gestionnaires, path: '/admin/gestionnaires' },
      { id: 'magaziniers',   label: t('Magasiniers', 'Warehouse keepers'),        icon: D.equipe,        path: '/admin/magaziniers'   },
      { id: 'partenaires',   label: t('Partenaires', 'Partners'),        icon: D.caissiers,     path: '/admin/partenaires',  module: 'partenaires' },
      { id: 'fournisseurs',  label: t('Fournisseurs', 'Suppliers'),       icon: D.magSpace,      path: '/admin/fournisseurs'  },
      { id: 'sessions',      label: t('Sessions de travail', 'Work sessions'), icon: D.sessions,      path: '/admin/sessions'      },
      { id: 'roles',         label: t('Rôles & accès', 'Roles & access'),      icon: D.roles,         path: '/admin/roles'         },
    ],
  },
  {
    title: t('Système', 'System'),
    items: [
      { id: 'caisses',      label: t('Caisses', 'Cash registers'),            icon: D.caisses,      path: '/admin/caisses'    },
      { id: 'parametres',   label: t('Paramètres magasin', 'Store settings'), icon: D.parametres,   path: '/admin/parametres' },
      { id: 'poste-caisse', label: t('Installer un poste', 'Set up a station'), icon: D.posteCaisse, path: '/admin/poste-caisse' },
      { id: 'audit',        label: t('Audit & logs', 'Audit & logs'),       icon: D.audit,        path: '/admin/audit'      },
      { id: 'exports',      label: t('Exports', 'Exports'),            icon: D.exports,      path: '/admin/exports'    },
      // Manuel d'utilisation — PROPRE À LA BOUTIQUE (Paramètres → manuelUrl).
      // Il pointait en dur sur `/manuel-family-store.pdf` : Radiance affichait
      // donc à ses employés le manuel d'un autre commerce, en français. Sans
      // manuel renseigné, l'entrée disparaît — mieux vaut pas de manuel qu'un
      // manuel étranger, qui fait faire des gestes faux en croyant bien faire.
      { id: 'manuel',       label: t("Manuel d'utilisation", 'User manual'), icon: D.manuel,     path: '', external: true, reglage: 'manuelUrl' },
    ],
  },
  {
    title: t("Changer d'espace", 'Switch workspace'),
    items: [
      { id: 'go-caisse',     label: t('Caisse', 'Checkout'),           icon: D.caisseSpace, path: '/caisse'     },
      { id: 'go-stock',      label: t('Gestion de stock', 'Inventory'), icon: D.stockSpace,  path: '/stocks'     },
      { id: 'go-magazinier', label: t('Magasinier', 'Warehouse'),       icon: D.magSpace,    path: '/magazinier' },
      { id: 'go-partenaires',label: t('Partenaires', 'Partners'),      icon: D.equipe,      path: '/partenaires', module: 'partenaires' },
    ],
  },
];

// ── Mon Compte Modal ──────────────────────────────────────────────────────────

function MonCompteModal({ onClose }: { onClose: () => void }) {
  const payload = getTokenPayload();
  const [name, setName]             = useState(payload?.name ?? '');
  const [email, setEmail]           = useState(payload?.email ?? '');
  const [phone, setPhone]           = useState('');
  const [oldPwd, setOldPwd]         = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'var(--fs-font-sans)', background: 'rgba(255,255,255,0.08)', color: '#fff',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'rgba(245,235,217,0.5)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4,
  };

  const handleSave = async () => {
    if (!name.trim()) { setError(t('Le nom est obligatoire.', 'Name is required.')); return; }
    if (newPwd && newPwd !== confirmPwd) { setError(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.')); return; }
    if (newPwd && !oldPwd) { setError(t("Saisir l'ancien mot de passe pour changer.", 'Enter your current password to change it.')); return; }
    if (newPwd && newPwd.length < 4) { setError(t('Le nouveau mot de passe doit contenir au moins 4 caractères.', 'The new password must be at least 4 characters long.')); return; }

    setLoading(true); setError(''); setSuccess('');
    const patch: Record<string, string> = {};
    if (name.trim() !== payload?.name) patch.name = name.trim();
    if (email.trim() && email.toLowerCase() !== payload?.email) patch.email = email.trim();
    if (phone.trim()) patch.phone = phone.trim();
    if (newPwd) { patch.password = newPwd; patch.oldPassword = oldPwd; }

    if (Object.keys(patch).length === 0) { setLoading(false); onClose(); return; }

    try {
      await updateUser(payload!.sub, patch);
      setSuccess(t('Profil mis à jour. Reconnectez-vous pour voir les changements.', 'Profile updated. Log in again to see the changes.'));
      setTimeout(() => {
        if (newPwd) { void deconnexion().then(ok => { if (ok) window.location.href = '/login'; }); }
        else onClose();
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Erreur', 'Error'));
    } finally { setLoading(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--fs-wine-900)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, width: '100%', maxWidth: 400, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 700, color: '#f5ebd9', fontSize: 15, margin: 0 }}>{t('Mon compte', 'My account')}</p>
            <p style={{ color: 'rgba(245,235,217,0.5)', fontSize: 11, margin: '2px 0 0' }}>{t('Modifier vos informations', 'Edit your details')}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,235,217,0.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error   && <div style={{ background: 'rgba(194,62,36,0.2)', color: '#f88', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}
          {success && <div style={{ background: 'rgba(90,139,83,0.25)', color: '#9f9', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{success}</div>}
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-gold-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{t('Identité', 'Identity')}</p>
          <div><label style={labelStyle}>{t('Nom complet', 'Full name')}</label><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('Prénom Nom', 'First name Last name')}/></div>
          <div><label style={labelStyle}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="email@exemple.cm"/></div>
          <div><label style={labelStyle}>{t('Téléphone', 'Phone')}</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+237 6 XX XX XX XX"/></div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-gold-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '4px 0 0' }}>{t('Changer le mot de passe', 'Change password')}</p>
          <div><label style={labelStyle}>{t('Ancien mot de passe', 'Current password')}</label><input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={inputStyle} placeholder={t('Mot de passe actuel', 'Current password')}/></div>
          <div><label style={labelStyle}>{t('Nouveau mot de passe', 'New password')}</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={inputStyle} placeholder={t('Min. 4 caractères', 'Min. 4 characters')}/></div>
          <div><label style={labelStyle}>{t('Confirmer le nouveau mot de passe', 'Confirm new password')}</label><input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={inputStyle} placeholder={t('Répéter le mot de passe', 'Repeat the password')}/></div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '11px', background: 'var(--fs-gold-500)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? t('Enregistrement…', 'Saving…') : t('Enregistrer', 'Save')}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'none', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'rgba(245,235,217,0.6)' }}>
            {t('Annuler', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hamburger icon ─────────────────────────────────────────────────────────────

function HamburgerBtn({ isOpen, onClick, left }: { isOpen: boolean; onClick: () => void; left: number }) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? t('Fermer le menu', 'Close menu') : t('Ouvrir le menu', 'Open menu')}
      className="fs-hamburger"
      style={{
        position: 'fixed', top: 12, left,
        zIndex: 201, width: 38, height: 38,
        borderRadius: 10, background: BG, border: 'none',
        color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
      }}
    >
      <I d={isOpen ? D.close : D.menu} size={15}/>
    </button>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function AdminSidebar() {
  const location = useLocation();
  const payload  = getTokenPayload();
  const initials = (payload?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const [showSettings, setShowSettings] = useState(false);
  const { settings, hasModule } = useSettings();
  // Sections filtrées selon les modules activés pour ce magasin
  // Un commerçant à boutique unique ne voit aucune trace de la mécanique
  // multi-boutiques : ni sélecteur, ni entrée « Rapport consolidé ».
  const plusieursBoutiques = (getTokenPayload()?.boutiques?.length ?? 0) > 1;
  const sections = SECTIONS.map(s => ({
    ...s,
    items: s.items
      // Adresse tirée des paramètres de la boutique (manuel) : on la pose ici.
      .map(it => (it.reglage ? { ...it, path: (settings[it.reglage] ?? '').trim() } : it))
      .filter(it =>
        (!it.module || hasModule(it.module)) &&
        (!it.multiBoutique || plusieursBoutiques) &&
        // Une entrée paramétrable sans adresse ne s'affiche pas.
        (!it.reglage || !!it.path),
      ),
  }));

  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  // Fermer le drawer quand on change de route
  useEffect(() => { if (isMobile) setIsOpen(false); }, [location.pathname, isMobile]);
  // Fermer quand on passe en desktop
  useEffect(() => { if (!isMobile) setIsOpen(false); }, [isMobile]);

  const activeId = sections.flatMap(s => s.items).find(it =>
    location.pathname === it.path || location.pathname.startsWith(it.path + '/'),
  )?.id ?? 'dashboard';

  const sidebarStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed', top: 0, left: isOpen ? 0 : -(SIDEBAR_W + 16),
        zIndex: 200, width: SIDEBAR_W,
        background: BG, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
      }
    : {
        width: SIDEBAR_W, background: BG,
        display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
      };

  return (
    <>
      {showSettings && <MonCompteModal onClose={() => setShowSettings(false)}/>}

      {/* Backdrop (mobile) */}
      {isMobile && isOpen && (
        <div onClick={() => setIsOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.55)' }}/>
      )}

      {/* Bouton hamburger (mobile) */}
      {isMobile && (
        <HamburgerBtn
          isOpen={isOpen}
          onClick={() => setIsOpen(o => !o)}
          left={isOpen ? SIDEBAR_W + 8 : 12}
        />
      )}

      <aside className="fs-sidebar-drawer" style={sidebarStyle}>
        {/* Logo du magasin (Paramètres). Sans logo téléversé, StoreLogo écrit
            le nom de l'enseigne — jamais l'image d'un autre commerçant. */}
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ background: '#fdf9f0', borderRadius: 10, border: '1px solid var(--fs-gold-400)', padding: '6px 8px', overflow: 'hidden' }}>
            {/* Même règle que StoreLogo : sans logo téléversé, le NOM de
                l'enseigne, jamais l'image d'un autre commerçant. Ce menu
                dupliquait le rendu du composant, et avec lui le repli. */}
            {settings.logoUrl
              ? <img src={settings.logoUrl} alt={nomEnseigne(settings.nomMagasin)} style={{ width: '100%', display: 'block', borderRadius: 6 }}/>
              : <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 56, padding: '8px 4px', textAlign: 'center',
                  fontFamily: 'var(--fs-font-display)', fontWeight: 700, fontSize: 15,
                  lineHeight: 1.15, color: COULEUR_MARQUE, wordBreak: 'break-word',
                }}>{nomEnseigne(settings.nomMagasin)}</div>}
          </div>
          {/* Boutique active, en permanence — et bascule si le propriétaire
              en a plusieurs. Rien ne s'affiche pour une boutique unique. */}
          <div style={{ marginTop: 10 }}><SelecteurBoutique compact/></div>
          <div style={{ fontSize: 9, color: 'var(--fs-gold-400)', letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginTop: 6 }}>{t('Administration', 'Administration')}</div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {sections.map(section => (
            <div key={section.title} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '6px 14px 4px', margin: 0 }}>
                {section.title}
              </p>
              {section.items.map(item => {
                const isActive = item.id === activeId;
                const itemStyle: React.CSSProperties = {
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 14px', textDecoration: 'none',
                  background: isActive ? ACT : 'transparent',
                  borderLeft: isActive ? '3px solid var(--fs-gold-400)' : '3px solid transparent',
                  color: isActive ? '#fff' : 'rgba(245,235,217,0.6)',
                  fontSize: 12, fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.1s',
                };
                // Lien externe (ex. manuel PDF) : nouvel onglet, pas de routage React
                if ('external' in item && item.external) {
                  return (
                    <a key={item.id} href={item.path} target="_blank" rel="noopener noreferrer"
                      onClick={() => { if (isMobile) setIsOpen(false); }} style={itemStyle}>
                      <I d={item.icon} size={13}/>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 9, opacity: 0.6 }}>↗</span>
                    </a>
                  );
                }
                return (
                  <Link key={item.id} to={item.path}
                    onClick={() => { if (item.id.startsWith('go-')) logAccesEspace(item.label); if (isMobile) setIsOpen(false); }}
                    style={itemStyle}>
                    <I d={item.icon} size={13}/>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-400)' }}>
              {payload?.role === 'patron' ? t('Administrateur', 'Administrator')
                : payload?.role === 'gestionnaire' ? t('Chef de stock', 'Stock manager')
                : payload?.role === 'magazinier'   ? t('Manutentionnaire', 'Warehouse keeper')
                : payload?.role === 'caissier'     ? t('Caissier(e)', 'Cashier')
                : t('Administrateur', 'Administrator')}
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} title={t('Paramètres du compte', 'Account settings')}
            style={{ background: 'none', border: 'none', color: 'rgba(245,235,217,0.4)', cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}>
            <I d={D.parametres} size={13}/>
          </button>
          <button onClick={() => { void deconnexion().then(ok => { if (ok) window.location.href = '/login'; }); }} title={t('Déconnexion', 'Log out')}
            style={{ background: 'none', border: 'none', color: 'rgba(245,235,217,0.4)', cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}>
            <I d={D.logout} size={13}/>
          </button>
        </div>
      </aside>
    </>
  );
}
