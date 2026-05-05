import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getTokenPayload } from '../api/dashboard';
import { getAllProducts } from '../api/products';
import { useIsMobile } from '../hooks/useIsMobile';

// ── SVG icon set ──────────────────────────────────────────────────────────────

function Icon({ name, size = 16, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard:    <><path d="M4 13h7V4H4zM13 9h7V4h-7zM13 20h7v-9h-7zM4 20h7v-5H4z"/></>,
    receipt:      <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h4"/></>,
    box:          <><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></>,
    chart:        <><path d="M4 20V4M4 20h16"/><path d="M8 16V11M12 16V7M16 16v-4M20 16V9"/></>,
    tag:          <><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.2"/></>,
    users:        <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 11a3 3 0 0 0 0-6M21 20a5.5 5.5 0 0 0-4-5.3"/></>,
    bell:         <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/></>,
    alert:        <><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v5M12 18v.5"/></>,
    book:         <><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4V4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7V4z"/></>,
    logout:       <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12"/></>,
    boxes:        <><path d="M3 8l4-2 4 2v4l-4 2-4-2V8zM13 8l4-2 4 2v4l-4 2-4-2V8zM8 16l4-2 4 2v4l-4 2-4-2v-4z"/></>,
    store:        <><path d="M3 9l2-5h14l2 5v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9zM5 10v10h14V10"/></>,
  };
  const p = paths[name] ?? <circle cx="12" cy="12" r="6"/>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {p}
    </svg>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function CrownMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="24" cy="24" r="22" fill="var(--fs-wine-700)"/>
      <circle cx="24" cy="24" r="22" fill="none" stroke="var(--fs-gold-400)" strokeWidth="1"/>
      <path d="M14 22 L18 14 L22 20 L24 12 L26 20 L30 14 L34 22 L34 27 L14 27 Z"
            fill="var(--fs-gold-400)" stroke="var(--fs-gold-300)" strokeWidth="0.5"/>
      <circle cx="18" cy="14" r="1.1" fill="var(--fs-gold-300)"/>
      <circle cx="24" cy="12" r="1.1" fill="var(--fs-gold-300)"/>
      <circle cx="30" cy="14" r="1.1" fill="var(--fs-gold-300)"/>
      <text x="24" y="37" textAnchor="middle" fontFamily="Cormorant Garamond, serif"
            fontSize="8" fontWeight="600" fill="var(--fs-gold-300)" letterSpacing="0.1em">FS</text>
    </svg>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem { label: string; path: string; icon: string }

const PATRON_NAV: NavItem[] = [
  { label: 'Tableau de bord', path: '/dashboard',    icon: 'dashboard' },
  { label: 'Caisse',          path: '/caisse',       icon: 'receipt'   },
  { label: 'Stocks',          path: '/stocks',       icon: 'boxes'     },
  { label: 'Dépenses',        path: '/depenses',     icon: 'book'      },
  { label: 'Rapports',        path: '/rapports',     icon: 'chart'     },
  { label: 'Produits',        path: '/produits',     icon: 'tag'       },
  { label: 'Utilisateurs',    path: '/utilisateurs', icon: 'users'     },
];

const CAISSIER_NAV: NavItem[] = [
  { label: 'Caisse', path: '/caisse', icon: 'receipt' },
];

const GESTIONNAIRE_NAV: NavItem[] = [
  { label: 'Stocks',   path: '/stocks',          icon: 'boxes' },
  { label: 'Produits', path: '/gestion-produits', icon: 'tag'   },
  { label: 'Alertes',  path: '/alertes',          icon: 'alert' },
];

const POLL_INTERVAL = 60_000;
const SIDEBAR_W     = 220;

function useStockAlertCount(active: boolean) {
  const [alertCount, setAlertCount] = useState(0);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!active) return;

    const notify = (name: string, stock: number) => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        new Notification('Alerte stock — Family Store', {
          body: `"${name}" : stock à ${stock} unité${stock > 1 ? 's' : ''} (rupture imminente)`,
          icon: '/favicon.ico',
        });
      }
    };

    const check = async () => {
      try {
        const products = await getAllProducts();
        const low = products.filter(p => p.stock <= p.alertThreshold);
        setAlertCount(low.length);
        for (const p of low) {
          if (!notifiedRef.current.has(p._id)) {
            notifiedRef.current.add(p._id);
            notify(p.name, p.stock);
          }
        }
        for (const id of Array.from(notifiedRef.current)) {
          const p = products.find(x => x._id === id);
          if (p && p.stock > p.alertThreshold) notifiedRef.current.delete(id);
        }
      } catch { /* silently ignore */ }
    };

    if (Notification.permission === 'default') {
      Notification.requestPermission().then(() => check());
    } else {
      check();
    }

    const timer = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [active]);

  return alertCount;
}

// ── Sidebar component ─────────────────────────────────────────────────────────

export default function Sidebar() {
  const navigate  = useNavigate();
  const payload   = getTokenPayload();
  const role      = payload?.role ?? 'caissier';
  const location  = useLocation();
  const isMobile  = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const items = role === 'patron'
    ? PATRON_NAV
    : role === 'gestionnaire'
    ? GESTIONNAIRE_NAV
    : CAISSIER_NAV;

  const alertCount = useStockAlertCount(role === 'gestionnaire' || role === 'patron');

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    navigate('/login');
  };

  const roleLabel = role === 'patron' ? 'Administration'
    : role === 'gestionnaire' ? 'Gestion stock'
    : 'Point de vente';

  const initials = (payload?.name ?? '?')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => { setIsOpen(false); }, [location.pathname]);
  useEffect(() => { if (!isMobile) setIsOpen(false); }, [isMobile]);

  const sidebarStyle: React.CSSProperties = isMobile ? {
    position: 'fixed', top: 0, left: isOpen ? 0 : -(SIDEBAR_W + 16),
    zIndex: 200, height: '100vh', width: SIDEBAR_W,
    background: 'var(--fs-wine-900)', display: 'flex', flexDirection: 'column',
    boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
  } : {
    width: SIDEBAR_W, background: 'var(--fs-wine-900)', height: '100vh',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
    boxShadow: '2px 0 12px rgba(0,0,0,0.18)', zIndex: 10,
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
            background: 'var(--fs-wine-900)', border: 'none', cursor: 'pointer',
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

        {/* ── Logo ── */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CrownMark size={38}/>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontFamily: 'var(--fs-font-display)', fontSize: 16, fontWeight: 600, color: '#f5ebd9', letterSpacing: '0.02em' }}>Family Store</div>
              <div style={{ fontSize: 10, color: 'var(--fs-gold-300)', fontStyle: 'italic', letterSpacing: '0.08em', marginTop: 2 }}>{roleLabel}</div>
            </div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setIsOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', marginBottom: 1,
                  borderRadius: 'var(--fs-r-sm)',
                  background: isActive ? 'var(--fs-wine-700)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(245,235,217,0.75)',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer', textDecoration: 'none',
                  borderLeft: isActive ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                <Icon name={item.icon} size={16} color={isActive ? 'var(--fs-gold-300)' : 'var(--fs-gold-400)'}/>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.path === '/alertes' && alertCount > 0 && (
                  <span style={{ background: 'var(--fs-danger-500)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, fontFamily: 'var(--fs-font-mono)' }}>
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Alert banner (patron) ── */}
        {role === 'patron' && alertCount > 0 && (
          <div
            onClick={() => navigate('/stocks')}
            style={{ margin: '0 10px 4px', padding: '8px 12px', background: 'rgba(194,62,36,0.18)', border: '1px solid rgba(194,62,36,0.3)', borderRadius: 'var(--fs-r-sm)', cursor: 'pointer' }}
          >
            <p style={{ color: '#f9a89a', fontSize: 11, fontWeight: 700 }}>
              <Icon name="alert" size={12} color="#f9a89a"/> {alertCount} alerte{alertCount > 1 ? 's' : ''} stock
            </p>
          </div>
        )}

        {/* ── User + logout ── */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-display)', flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-300)', marginTop: 1, textTransform: 'capitalize' }}>{role}</div>
          </div>
          <button onClick={handleLogout} title="Déconnexion" style={{ background: 'transparent', border: 'none', color: 'var(--fs-gold-300)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 'var(--fs-r-xs)' }}>
            <Icon name="logout" size={16}/>
          </button>
        </div>
      </aside>
    </>
  );
}
