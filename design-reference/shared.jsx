// Shared primitives for Family Store modules.
// Icons are hand-drawn SVGs (no emoji). Components use CSS vars from tokens.css.

const fmtXAF = (n) => {
  const num = Math.round(Number(n) || 0);
  return num.toLocaleString('fr-FR').replace(/,/g, ' ');
};

// ───── Icon set (stroke-based, 20px default) ─────────────────────────
const Icon = ({ name, size = 20, stroke = 1.6, color = 'currentColor', style }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></>,
    barcode: <><path d="M4 6v12M7 6v12M10 6v12M13 6v12M16 6v12M19 6v12"/></>,
    cart: <><path d="M4 5h2l2.2 10.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L22 8H7"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <><path d="M5 12h14"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 11a3 3 0 0 0 0-6M21 20a5.5 5.5 0 0 0-4-5.3"/></>,
    box: <><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></>,
    boxes: <><path d="M3 8l4-2 4 2v4l-4 2-4-2V8zM13 8l4-2 4 2v4l-4 2-4-2V8zM8 16l4-2 4 2v4l-4 2-4-2v-4z"/></>,
    dashboard: <><path d="M4 13h7V4H4zM13 9h7V4h-7zM13 20h7v-9h-7zM4 20h7v-5H4z"/></>,
    chart: <><path d="M4 20V4M4 20h16"/><path d="M8 16V11M12 16V7M16 16v-4M20 16V9"/></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/></>,
    alert: <><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v5M12 18v.5"/></>,
    check: <><path d="M5 12l5 5L20 7"/></>,
    x: <><path d="M6 6l12 12M18 6L6 18"/></>,
    chevronRight: <><path d="M9 6l6 6-6 6"/></>,
    chevronDown: <><path d="M6 9l6 6 6-6"/></>,
    chevronLeft: <><path d="M15 6l-6 6 6 6"/></>,
    arrowUp: <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7-7"/></>,
    arrowRight: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    download: <><path d="M12 4v12M6 12l6 6 6-6M4 20h16"/></>,
    upload: <><path d="M12 20V8M6 12l6-6 6 6M4 4h16"/></>,
    filter: <><path d="M4 5h16l-6 8v5l-4 2v-7L4 5z"/></>,
    print: <><path d="M6 9V3h12v6M6 18H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2M6 14h12v7H6z"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
    edit: <><path d="M14 4l6 6L8 22H2v-6L14 4z"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    phone: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></>,
    cash: <><rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v6M18 9v6"/></>,
    card: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/></>,
    mobile: <><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/></>,
    tag: <><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.2"/></>,
    star: <><path d="M12 3l2.7 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.7l-5.6 2.7L7.6 14 3 9.7l6.3-.9L12 3z"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    store: <><path d="M3 9l2-5h14l2 5v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9zM5 10v10h14V10"/></>,
    book: <><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4V4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7V4z"/></>,
    file: <><path d="M14 3H6v18h12V8l-4-5z"/><path d="M14 3v5h4"/></>,
    truck: <><path d="M2 7h11v10H2V7zM13 10h5l3 3v4h-8"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></>,
    scan: <><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3M7 12h10"/></>,
  };
  const p = paths[name] || <circle cx="12" cy="12" r="6"/>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
         style={style}>{p}</svg>
  );
};

// ───── Brand lockup (mini + full) ────────────────────────────────────
const Logo = ({ variant = 'mark', size = 36, color = 'var(--fs-wine-700)' }) => {
  if (variant === 'mark') {
    // Compact crown monogram for sidebars/tight spaces
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{flexShrink:0}}>
        <circle cx="24" cy="24" r="22" fill="var(--fs-wine-700)"/>
        <circle cx="24" cy="24" r="22" fill="none" stroke="var(--fs-gold-400)" strokeWidth="1"/>
        {/* crown */}
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
  // 'full' — wordmark
  return (
    <div style={{display:'flex', alignItems:'center', gap:10}}>
      <Logo variant="mark" size={size}/>
      <div style={{lineHeight:1}}>
        <div style={{fontFamily:'var(--fs-font-display)', fontSize:size*0.5, fontWeight:600,
                     color:'var(--fs-wine-700)', letterSpacing:'0.02em'}}>FAMILY STORE</div>
        <div style={{fontFamily:'var(--fs-font-display)', fontSize:size*0.28, fontStyle:'italic',
                     color:'var(--fs-gold-600)', marginTop:2, letterSpacing:'0.08em'}}>by RDCT</div>
      </div>
    </div>
  );
};

// ───── Device frames ─────────────────────────────────────────────────
const TabletFrame = ({ children, width = 1280, height = 800 }) => (
  <div style={{
    width: width + 32, height: height + 32,
    background: 'linear-gradient(180deg, #2a2422 0%, #1a1614 100%)',
    borderRadius: 28, padding: 16,
    boxShadow: '0 30px 80px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.04)',
  }}>
    <div style={{
      width, height, background: 'var(--fs-ivory)',
      borderRadius: 14, overflow: 'hidden', position: 'relative',
    }}>{children}</div>
  </div>
);

const DesktopFrame = ({ children, width = 1440, height = 900 }) => (
  <div style={{
    width: width + 24, height: height + 48,
    background: '#e6dfd0',
    borderRadius: 12,
    boxShadow: '0 30px 80px rgba(0,0,0,0.22)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  }}>
    <div style={{height:32, display:'flex', alignItems:'center', padding:'0 14px', gap:7,
                 borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
      <span style={{width:11, height:11, borderRadius:'50%', background:'#E56962'}}/>
      <span style={{width:11, height:11, borderRadius:'50%', background:'#E5AE4E'}}/>
      <span style={{width:11, height:11, borderRadius:'50%', background:'#66C266'}}/>
      <span style={{flex:1, textAlign:'center', fontSize:11, color:'#7a7065', fontFamily:'var(--fs-font-sans)'}}>
        Family Store · Espace d'administration
      </span>
    </div>
    <div style={{width, height, background:'var(--fs-ivory)', flex:1, overflow:'hidden'}}>{children}</div>
  </div>
);

// ───── Small UI primitives ───────────────────────────────────────────
const Badge = ({ tone = 'neutral', children, style }) => {
  const tones = {
    neutral: { bg: 'var(--fs-line)',       fg: 'var(--fs-ink-700)' },
    wine:    { bg: 'var(--fs-wine-100)',   fg: 'var(--fs-wine-700)' },
    gold:    { bg: 'var(--fs-gold-100)',   fg: 'var(--fs-gold-700)' },
    success: { bg: 'var(--fs-success-100)',fg: 'var(--fs-success-700)' },
    warning: { bg: 'var(--fs-warning-100)',fg: 'var(--fs-warning-700)' },
    danger:  { bg: 'var(--fs-danger-100)', fg: 'var(--fs-danger-700)' },
    info:    { bg: 'var(--fs-info-100)',   fg: 'var(--fs-info-700)' },
  }[tone] || {};
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: tones.bg, color: tones.fg,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
      padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase',
      fontFamily: 'var(--fs-font-sans)',
      ...style,
    }}>{children}</span>
  );
};

const Btn = ({ variant = 'primary', size = 'md', icon, children, onClick, style, disabled }) => {
  const variants = {
    primary: { bg: 'var(--fs-wine-700)', fg: '#fff', border: 'var(--fs-wine-700)',
               hover: 'var(--fs-wine-800)' },
    secondary: { bg: 'var(--fs-paper)', fg: 'var(--fs-ink-900)', border: 'var(--fs-line-2)',
                 hover: 'var(--fs-ivory)' },
    ghost: { bg: 'transparent', fg: 'var(--fs-ink-700)', border: 'transparent',
             hover: 'var(--fs-line)' },
    gold: { bg: 'var(--fs-gold-500)', fg: '#fff', border: 'var(--fs-gold-500)',
            hover: 'var(--fs-gold-600)' },
    danger: { bg: 'var(--fs-paper)', fg: 'var(--fs-danger-700)', border: 'var(--fs-danger-100)',
              hover: 'var(--fs-danger-100)' },
  }[variant] || {};
  const sizes = {
    sm: { py: 6, px: 10, fs: 12, h: 30 },
    md: { py: 9, px: 14, fs: 13, h: 38 },
    lg: { py: 12, px: 18, fs: 14, h: 46 },
    xl: { py: 16, px: 22, fs: 15, h: 56 },
  }[size] || {};
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: sizes.h, padding: `0 ${sizes.px}px`,
      background: variants.bg, color: variants.fg,
      border: `1px solid ${variants.border}`,
      borderRadius: 'var(--fs-r-sm)',
      fontSize: sizes.fs, fontWeight: 600, letterSpacing: '0.01em',
      fontFamily: 'var(--fs-font-sans)',
      opacity: disabled ? 0.5 : 1,
      transition: 'background 0.12s, transform 0.05s',
      ...style,
    }}>
      {icon && <Icon name={icon} size={sizes.fs + 3} stroke={1.8}/>}
      {children}
    </button>
  );
};

const IconBtn = ({ icon, size = 36, onClick, style, title, tone = 'ghost' }) => {
  const tones = {
    ghost: { bg: 'transparent', fg: 'var(--fs-ink-700)', border: 'transparent' },
    soft:  { bg: 'var(--fs-paper)', fg: 'var(--fs-ink-700)', border: 'var(--fs-line)' },
    wine:  { bg: 'var(--fs-wine-700)', fg: '#fff', border: 'var(--fs-wine-700)' },
  }[tone];
  return (
    <button onClick={onClick} title={title} style={{
      width: size, height: size, borderRadius: 'var(--fs-r-sm)',
      background: tones.bg, color: tones.fg, border: `1px solid ${tones.border}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      <Icon name={icon} size={size * 0.45}/>
    </button>
  );
};

// ───── Export globally for Babel scripts ─────────────────────────────
Object.assign(window, { fmtXAF, Icon, Logo, TabletFrame, DesktopFrame, Badge, Btn, IconBtn });
