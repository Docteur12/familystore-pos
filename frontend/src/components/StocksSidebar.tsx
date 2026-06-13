import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getTokenPayload } from '../api/dashboard';
import { getAllReceptions } from '../api/magazinier';
import { getEcartsCount }  from '../api/ecarts';
import { useIsMobile } from '../hooks/useIsMobile';

const LS_RECEPTION_SEEN = 'receptions_last_seen';
const SIDEBAR_W   = 190;
const SIDEBAR_BG  = 'var(--fs-wine-900)';
const SIDEBAR_ACT = '#8B1A2B';

function I({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const D = {
  dashboard:   'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  catalogue:   'M4 6h16M4 10h16M4 14h10',
  reception:   'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 3l-4 4-4-4',
  inventaire:  'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 1 2 2',
  alertes:     'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  etiquettes:  'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  depots:      'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z',
  fournisseurs:'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
  divers:      'M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07',
  logout:      'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12',
};

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Tableau de bord',   icon: D.dashboard,    path: '/stocks/dashboard'    },
  { id: 'catalogue',   label: 'Catalogue produits', icon: D.catalogue,    path: '/stocks'              },
  { id: 'receptions',  label: 'Réceptions',         icon: D.reception,    path: '/stocks/receptions'   },
  { id: 'inventaire',  label: 'Inventaire',         icon: D.inventaire,   path: '/stocks/inventaire'   },
  { id: 'alertes',     label: 'Alertes & seuils',   icon: D.alertes,      path: '/stocks/alertes'      },
  { id: 'etiquettes',  label: 'Étiquettes / SKU',   icon: D.etiquettes,   path: '/stocks/etiquettes'   },
  { id: 'depots',      label: 'Dépôts',             icon: D.depots,       path: '/stocks/depots'       },
  { id: 'fournisseurs',label: 'Fournisseurs',        icon: D.fournisseurs, path: '/stocks/fournisseurs' },
  { id: 'ecarts',      label: 'Écarts de stock',     icon: D.alertes,      path: '/stocks/ecarts'       },
  { id: 'divers',      label: 'Articles divers',     icon: D.divers,       path: '/stocks/divers'       },
];

export default function StocksSidebar({ alertCount = 0 }: { alertCount?: number }) {
  const location = useLocation();
  const payload  = getTokenPayload();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const initials = (payload?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const [receptionBadge, setReceptionBadge] = useState(0);
  const [ecartBadge,     setEcartBadge]     = useState(0);

  useEffect(() => {
    getEcartsCount().then(setEcartBadge).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    getAllReceptions().then(recs => {
      const lastSeen = parseInt(localStorage.getItem(LS_RECEPTION_SEEN) ?? '0');
      const newCount = recs.filter(r => r.creePar?.role === 'magazinier' && new Date(r.createdAt).getTime() > lastSeen).length;
      setReceptionBadge(newCount);
    }).catch(() => {});
  }, [location.pathname]);

  useEffect(() => { setIsOpen(false); }, [location.pathname]);
  useEffect(() => { if (!isMobile) setIsOpen(false); }, [isMobile]);

  const activeId = NAV_ITEMS.find(it =>
    it.path === location.pathname ||
    (it.path !== '/stocks' && location.pathname.startsWith(it.path))
  )?.id ?? 'catalogue';

  const sidebarStyle: React.CSSProperties = isMobile ? {
    position: 'fixed', top: 0, left: isOpen ? 0 : -(SIDEBAR_W + 16),
    zIndex: 200, width: SIDEBAR_W,
    background: SIDEBAR_BG, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
  } : {
    width: SIDEBAR_W, background: SIDEBAR_BG,
    display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
  };

  return (
    <>
      {isMobile && (
        <button
          className="fs-hamburger"
          onClick={() => setIsOpen(o => !o)}
          aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          style={{
            position: 'fixed', top: 12, left: isOpen ? SIDEBAR_W + 8 : 12,
            zIndex: 201, width: 36, height: 36, borderRadius: 8,
            background: SIDEBAR_BG, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="var(--fs-gold-400)" strokeWidth="2" strokeLinecap="round">
            {isOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      )}

      {isMobile && isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.45)' }}
        />
      )}

      <aside className="fs-sidebar-drawer" style={sidebarStyle}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.12)"/>
              <circle cx="24" cy="24" r="22" fill="none" stroke="var(--fs-gold-400)" strokeWidth="1"/>
              <path d="M14 22 L18 14 L22 20 L24 12 L26 20 L30 14 L34 22 L34 27 L14 27 Z"
                fill="var(--fs-gold-400)" stroke="var(--fs-gold-300)" strokeWidth="0.5"/>
              <text x="24" y="37" textAnchor="middle" fontFamily="Cormorant Garamond, serif"
                fontSize="8" fontWeight="600" fill="var(--fs-gold-300)" letterSpacing="0.1em">FS</text>
            </svg>
            <div>
              <div style={{ fontFamily: 'var(--fs-font-display)', fontSize: 13, fontWeight: 700, color: '#f5ebd9', letterSpacing: '0.04em' }}>FAMILY STORE</div>
              <div style={{ fontSize: 9, color: 'var(--fs-gold-400)', letterSpacing: '0.08em' }}>Espace d'administration</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: '12px 0 6px', flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', padding: '0 14px', marginBottom: 6 }}>
            Gestion
          </p>
          {NAV_ITEMS.map(item => {
            const isActive = item.id === activeId;
            return (
              <Link key={item.id} to={item.path}
                onClick={() => isMobile && setIsOpen(false)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 14px', marginBottom: 1, textDecoration: 'none',
                  background: isActive ? SIDEBAR_ACT : 'transparent',
                  borderLeft: isActive ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
                  color: isActive ? '#fff' : 'rgba(245,235,217,0.65)',
                  fontSize: 12, fontWeight: isActive ? 600 : 400,
                  boxSizing: 'border-box',
                }}>
                <I d={item.icon} size={13}/>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.id === 'alertes' && alertCount > 0 && (
                  <span style={{ background: 'var(--fs-danger-500)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8 }}>
                    {alertCount}
                  </span>
                )}
                {item.id === 'receptions' && receptionBadge > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8 }}>
                    {receptionBadge}
                  </span>
                )}
                {item.id === 'ecarts' && ecartBadge > 0 && (
                  <span style={{ background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 8, animation: 'pulse 2s infinite' }}>
                    {ecartBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Retour admin (patron uniquement) */}
        {payload?.role === 'patron' && (
          <Link to="/admin/dashboard"
            style={{ margin: '0 10px 8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'var(--fs-gold-400)', fontSize: 12, fontWeight: 700 }}>
            <I d="M15 18l-6-6 6-6" size={13}/> Retour admin
          </Link>
        )}

        {/* Dépôt */}
        <div style={{ margin: '0 10px 10px', padding: '10px 12px', background: 'rgba(255,255,255,0.07)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fs-gold-400)', marginBottom: 4 }}>
            Dépôt principal
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>Akwa · Douala</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>4 dépôts</div>
        </div>

        {/* User */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-400)' }}>
              {payload?.role === 'gestionnaire' ? 'Chef de stock'
                : payload?.role === 'magazinier' ? 'Manutentionnaire'
                : payload?.role === 'patron' ? 'Administrateur'
                : 'Chef de stock'}
            </div>
          </div>
          <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
            style={{ background: 'none', border: 'none', color: 'var(--fs-gold-400)', cursor: 'pointer', display: 'flex', padding: 2 }}>
            <I d={D.logout} size={13}/>
          </button>
        </div>
      </aside>
    </>
  );
}
