import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getTokenPayload } from '../api/dashboard';
import { updateUser } from '../api/auth';
import { useSettings } from '../contexts/SettingsContext';
import { useIsMobile } from '../hooks/useIsMobile';

const BG       = '#6B1221';
const ACT      = '#4A0E1C';
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
  caisseSpace:  'M2 7h20v10H2zM2 11h20M6 15h4',
  stockSpace:   'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  magSpace:     'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
};

const SECTIONS = [
  {
    title: 'Pilotage',
    items: [
      { id: 'dashboard',    label: 'Tableau de bord',    icon: D.dashboard,    path: '/admin/dashboard'     },
      { id: 'rapports',     label: 'Rapports & analyses', icon: D.rapports,     path: '/admin/rapports'      },
      { id: 'journal',      label: 'Journal des ventes',  icon: D.journal,      path: '/admin/journal'        },
      { id: 'compta',       label: 'Comptabilité',        icon: D.compta,       path: '/admin/comptabilite'  },
      { id: 'factures',     label: 'Historique factures', icon: D.factures,     path: '/admin/factures'       },
    ],
  },
  {
    title: 'Personnel',
    items: [
      { id: 'equipe',        label: 'Équipe',            icon: D.equipe,        path: '/admin/equipe'        },
      { id: 'caissiers',     label: 'Caissiers',          icon: D.caissiers,     path: '/admin/caissiers'     },
      { id: 'gestionnaires', label: 'Gestionnaires',      icon: D.gestionnaires, path: '/admin/gestionnaires' },
      { id: 'magaziniers',   label: 'Magaziniers',        icon: D.equipe,        path: '/admin/magaziniers'   },
      { id: 'sessions',      label: 'Sessions de travail', icon: D.sessions,      path: '/admin/sessions'      },
      { id: 'roles',         label: 'Rôles & accès',      icon: D.roles,         path: '/admin/roles'         },
    ],
  },
  {
    title: 'Système',
    items: [
      { id: 'caisses',      label: 'Caisses',            icon: D.caisses,      path: '/admin/caisses'    },
      { id: 'parametres',   label: 'Paramètres magasin', icon: D.parametres,   path: '/admin/parametres' },
      { id: 'audit',        label: 'Audit & logs',       icon: D.audit,        path: '/admin/audit'      },
      { id: 'exports',      label: 'Exports',            icon: D.exports,      path: '/admin/exports'    },
    ],
  },
  {
    title: "Changer d'espace",
    items: [
      { id: 'go-caisse',     label: 'Caisse',           icon: D.caisseSpace, path: '/caisse'     },
      { id: 'go-stock',      label: 'Gestion de stock', icon: D.stockSpace,  path: '/stocks'     },
      { id: 'go-magazinier', label: 'Magazinier',       icon: D.magSpace,    path: '/magazinier' },
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
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    if (newPwd && newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (newPwd && !oldPwd) { setError("Saisir l'ancien mot de passe pour changer."); return; }
    if (newPwd && newPwd.length < 4) { setError('Le nouveau mot de passe doit contenir au moins 4 caractères.'); return; }

    setLoading(true); setError(''); setSuccess('');
    const patch: Record<string, string> = {};
    if (name.trim() !== payload?.name) patch.name = name.trim();
    if (email.trim() && email.toLowerCase() !== payload?.email) patch.email = email.trim();
    if (phone.trim()) patch.phone = phone.trim();
    if (newPwd) { patch.password = newPwd; patch.oldPassword = oldPwd; }

    if (Object.keys(patch).length === 0) { setLoading(false); onClose(); return; }

    try {
      await updateUser(payload!.sub, patch);
      setSuccess('Profil mis à jour. Reconnectez-vous pour voir les changements.');
      setTimeout(() => {
        if (newPwd) { localStorage.removeItem('access_token'); window.location.href = '/login'; }
        else onClose();
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#4A0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, width: '100%', maxWidth: 400, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 700, color: '#f5ebd9', fontSize: 15, margin: 0 }}>Mon compte</p>
            <p style={{ color: 'rgba(245,235,217,0.5)', fontSize: 11, margin: '2px 0 0' }}>Modifier vos informations</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,235,217,0.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error   && <div style={{ background: 'rgba(194,62,36,0.2)', color: '#f88', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}
          {success && <div style={{ background: 'rgba(90,139,83,0.25)', color: '#9f9', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{success}</div>}
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-gold-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Identité</p>
          <div><label style={labelStyle}>Nom complet</label><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Prénom Nom"/></div>
          <div><label style={labelStyle}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="email@familystore.cm"/></div>
          <div><label style={labelStyle}>Téléphone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+237 6 XX XX XX XX"/></div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-gold-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '4px 0 0' }}>Changer le mot de passe</p>
          <div><label style={labelStyle}>Ancien mot de passe</label><input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={inputStyle} placeholder="Mot de passe actuel"/></div>
          <div><label style={labelStyle}>Nouveau mot de passe</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={inputStyle} placeholder="Min. 4 caractères"/></div>
          <div><label style={labelStyle}>Confirmer le nouveau mot de passe</label><input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={inputStyle} placeholder="Répéter le mot de passe"/></div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '11px', background: 'var(--fs-gold-500)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'none', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'rgba(245,235,217,0.6)' }}>
            Annuler
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
      aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
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
  const { settings } = useSettings();

  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  // Fermer le drawer quand on change de route
  useEffect(() => { if (isMobile) setIsOpen(false); }, [location.pathname, isMobile]);
  // Fermer quand on passe en desktop
  useEffect(() => { if (!isMobile) setIsOpen(false); }, [isMobile]);

  const activeId = SECTIONS.flatMap(s => s.items).find(it =>
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
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid var(--fs-gold-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M7 11 L9 6 L11 9.5 L12 5 L13 9.5 L15 6 L17 11 L17 13.5 L7 13.5 Z" fill="var(--fs-gold-400)"/>
                <path d="M7 13.5 L17 13.5" stroke="var(--fs-gold-400)" strokeWidth="1.2"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--fs-font-display)', fontSize: 13, fontWeight: 700, color: '#f5ebd9', letterSpacing: '0.05em', lineHeight: 1 }}>{settings.nomMagasin}</div>
              <div style={{ fontSize: 9, color: 'var(--fs-gold-400)', letterSpacing: '0.1em', marginTop: 2 }}>Administration</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '6px 14px 4px', margin: 0 }}>
                {section.title}
              </p>
              {section.items.map(item => {
                const isActive = item.id === activeId;
                return (
                  <Link key={item.id} to={item.path}
                    onClick={() => isMobile && setIsOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '7px 14px', textDecoration: 'none',
                      background: isActive ? ACT : 'transparent',
                      borderLeft: isActive ? '3px solid var(--fs-gold-400)' : '3px solid transparent',
                      color: isActive ? '#fff' : 'rgba(245,235,217,0.6)',
                      fontSize: 12, fontWeight: isActive ? 600 : 400,
                      transition: 'background 0.1s',
                    }}>
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
              {payload?.role === 'patron' ? 'Administrateur'
                : payload?.role === 'gestionnaire' ? 'Chef de stock'
                : payload?.role === 'magazinier'   ? 'Manutentionnaire'
                : payload?.role === 'caissier'     ? 'Caissier(e)'
                : 'Administrateur'}
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} title="Paramètres du compte"
            style={{ background: 'none', border: 'none', color: 'rgba(245,235,217,0.4)', cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}>
            <I d={D.parametres} size={13}/>
          </button>
          <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }} title="Déconnexion"
            style={{ background: 'none', border: 'none', color: 'rgba(245,235,217,0.4)', cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}>
            <I d={D.logout} size={13}/>
          </button>
        </div>
      </aside>
    </>
  );
}
