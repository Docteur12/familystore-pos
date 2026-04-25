// Module ADMIN — Espace administration (1440×900)
// Dashboard avec KPIs, graphiques, personnel, journal des ventes

function AdminScreen() {
  const [activeNav, setActiveNav] = React.useState('dashboard');

  return (
    <div className="fs-app" style={{width:'100%', height:'100%', display:'flex',
                                     background:'var(--fs-ivory)'}}>
      <AdminSidebar active={activeNav} onNav={setActiveNav}/>
      <main style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden'}}>
        <AdminTopBar/>
        <div style={{flex:1, overflow:'auto', padding:'20px 28px 28px'}} className="fs-scroll">
          <AdminDashboard/>
        </div>
      </main>
    </div>
  );
}

function AdminSidebar({ active, onNav }) {
  const groups = [
    {
      title: 'Pilotage',
      items: [
        { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard' },
        { id: 'rapports',  label: 'Rapports & analyses', icon: 'chart' },
        { id: 'ventes',    label: 'Journal des ventes', icon: 'receipt' },
        { id: 'compta',    label: 'Comptabilité', icon: 'book' },
      ],
    },
    {
      title: 'Personnel',
      items: [
        { id: 'equipe',    label: 'Équipe', icon: 'users', badge: '12' },
        { id: 'caissiers', label: 'Caissiers', icon: 'user' },
        { id: 'gestionnaires', label: 'Gestionnaires', icon: 'user' },
        { id: 'roles',     label: 'Rôles & accès', icon: 'lock' },
      ],
    },
    {
      title: 'Système',
      items: [
        { id: 'magasin',   label: 'Paramètres magasin', icon: 'store' },
        { id: 'audit',     label: 'Audit & logs', icon: 'file' },
        { id: 'export',    label: 'Exports', icon: 'download' },
      ],
    },
  ];
  return (
    <aside style={{width:236, background:'var(--fs-wine-900)',
                   display:'flex', flexDirection:'column', color:'#f5ebd9'}}>
      <div style={{padding:'20px 18px 18px', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <Logo variant="mark" size={38}/>
          <div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:16, fontWeight:600,
                         color:'#fff', letterSpacing:'0.02em'}}>Family Store</div>
            <div style={{fontSize:10, color:'var(--fs-gold-300)', fontStyle:'italic',
                         letterSpacing:'0.08em'}}>Administration</div>
          </div>
        </div>
      </div>

      <div style={{flex:1, overflow:'auto', padding:'14px 8px'}} className="fs-scroll">
        {groups.map(g => (
          <div key={g.title} style={{marginBottom:14}}>
            <div style={{padding:'0 10px 6px', fontSize:10, color:'var(--fs-gold-300)',
                         letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600}}>
              {g.title}
            </div>
            {g.items.map(it => (
              <button key={it.id} onClick={()=>onNav(it.id)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'8px 12px', marginBottom:1,
                background: active===it.id ? 'var(--fs-wine-700)' : 'transparent',
                color: active===it.id ? '#fff' : '#f5ebd9',
                border:'none', borderRadius:'var(--fs-r-sm)',
                fontSize:12.5, fontWeight: active===it.id ? 600 : 500,
                textAlign:'left', cursor:'pointer',
                borderLeft: active===it.id ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
              }}>
                <Icon name={it.icon} size={15} color={active===it.id?'var(--fs-gold-300)':'var(--fs-gold-400)'}/>
                <span style={{flex:1}}>{it.label}</span>
                {it.badge && <span style={{fontSize:10, color:'var(--fs-gold-300)',
                                            fontFamily:'var(--fs-font-mono)'}}>{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={{padding:12, borderTop:'1px solid rgba(255,255,255,0.08)',
                   display:'flex', alignItems:'center', gap:10}}>
        <div style={{width:34, height:34, borderRadius:'50%', background:'var(--fs-gold-500)',
                     display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
                     fontSize:13, fontWeight:700, fontFamily:'var(--fs-font-display)'}}>RC</div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:12, fontWeight:600, color:'#fff'}}>Rose C.</div>
          <div style={{fontSize:10, color:'var(--fs-gold-300)'}}>Administrateur</div>
        </div>
        <button style={{background:'transparent', border:'none', color:'var(--fs-gold-300)',
                        cursor:'pointer', padding:4}}>
          <Icon name="logout" size={16}/>
        </button>
      </div>
    </aside>
  );
}

function AdminTopBar() {
  return (
    <div style={{height:64, background:'var(--fs-paper)',
                 borderBottom:'1px solid var(--fs-line)',
                 display:'flex', alignItems:'center', padding:'0 28px', gap:16}}>
      <div style={{flex:1}}>
        <div style={{fontSize:11, color:'var(--fs-ink-400)', letterSpacing:'0.08em',
                     textTransform:'uppercase', fontWeight:600}}>
          Tableau de bord
        </div>
        <div style={{fontFamily:'var(--fs-font-display)', fontSize:24, fontWeight:600,
                     color:'var(--fs-ink-900)', marginTop:2}}>
          Bonjour Rose, voici l'activité du jour
        </div>
      </div>

      <div style={{display:'flex', alignItems:'center', gap:6,
                   background:'var(--fs-ivory)', border:'1px solid var(--fs-line-2)',
                   borderRadius:'var(--fs-r-md)', padding:'0 12px', height:40}}>
        <Icon name="calendar" size={14} color="var(--fs-ink-500)"/>
        <span style={{fontSize:12, fontWeight:600}}>Sam. 25 avril 2026</span>
        <span style={{fontSize:11, color:'var(--fs-ink-400)', marginLeft:6}}>·</span>
        <span style={{fontSize:11, color:'var(--fs-ink-500)'}}>7 derniers jours</span>
        <Icon name="chevronDown" size={14} color="var(--fs-ink-500)"/>
      </div>

      <Btn variant="secondary" size="md" icon="download">Exporter</Btn>

      <div style={{width:1, height:30, background:'var(--fs-line)'}}/>

      <IconBtn icon="bell" tone="soft" size={40}/>
      <IconBtn icon="settings" tone="soft" size={40}/>
    </div>
  );
}

function AdminDashboard() {
  return (
    <>
      {/* KPI row */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:18}}>
        <BigKPI label="Chiffre d'affaires" value="4 287 500" suffix="XAF" trend="+12,4 %" trendTone="success"
                sub="vs. semaine dernière" accent/>
        <BigKPI label="Tickets encaissés" value="342" trend="+28 tickets" trendTone="success"
                sub="56 aujourd'hui"/>
        <BigKPI label="Panier moyen" value="12 536" suffix="XAF" trend="+3,1 %" trendTone="success"
                sub="toutes caisses"/>
        <BigKPI label="Bénéfice brut" value="1 624 100" suffix="XAF" trend="38 % de marge" trendTone="neutral"
                sub="après coût d'achat"/>
      </div>

      {/* Chart + top products */}
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:14, marginBottom:18}}>
        <SalesChart/>
        <TopProducts/>
      </div>

      {/* Staff + recent transactions + payment mix */}
      <div style={{display:'grid', gridTemplateColumns:'1.1fr 1.4fr 1fr', gap:14}}>
        <StaffPanel/>
        <RecentTransactions/>
        <PaymentMix/>
      </div>
    </>
  );
}

function BigKPI({ label, value, suffix, trend, trendTone, sub, accent }) {
  const tones = {
    success: 'var(--fs-success-700)',
    neutral: 'var(--fs-ink-500)',
    danger: 'var(--fs-danger-700)',
  };
  return (
    <div style={{
      background: accent ? 'linear-gradient(135deg, var(--fs-wine-800), var(--fs-wine-700))' : 'var(--fs-paper)',
      color: accent ? '#fff' : 'var(--fs-ink-900)',
      border: accent ? 'none' : '1px solid var(--fs-line)',
      borderRadius:'var(--fs-r-md)', padding:'16px 20px',
      boxShadow: accent ? 'var(--fs-shadow-md)' : 'var(--fs-shadow-sm)',
      position:'relative', overflow:'hidden',
    }}>
      {accent && (
        <div style={{position:'absolute', top:-20, right:-20, width:120, height:120,
                     background:'radial-gradient(circle, var(--fs-gold-500) 0%, transparent 70%)',
                     opacity:0.18, pointerEvents:'none'}}/>
      )}
      <div style={{fontSize:11, color: accent ? 'var(--fs-gold-300)' : 'var(--fs-ink-500)',
                   letterSpacing:'0.06em', fontWeight:600, marginBottom:6}}>
        {label}
      </div>
      <div style={{display:'flex', alignItems:'baseline', gap:6}}>
        <span style={{fontFamily:'var(--fs-font-display)', fontSize:32, fontWeight:700,
                      letterSpacing:'-0.01em', fontVariantNumeric:'tabular-nums',
                      color: accent ? '#fff' : 'var(--fs-ink-900)'}}>
          {value}
        </span>
        {suffix && <span style={{fontSize:12, fontWeight:500,
                                  color: accent ? 'var(--fs-gold-300)' : 'var(--fs-ink-500)'}}>
          {suffix}
        </span>}
      </div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                   marginTop:8}}>
        <span style={{fontSize:11, fontWeight:600,
                      color: accent ? 'var(--fs-gold-300)' : tones[trendTone] || tones.neutral}}>
          <Icon name="arrowUp" size={11} style={{marginRight:3, verticalAlign:'middle'}}/>
          {trend}
        </span>
        <span style={{fontSize:10, color: accent ? 'rgba(255,255,255,0.6)' : 'var(--fs-ink-400)'}}>
          {sub}
        </span>
      </div>
    </div>
  );
}

function SalesChart() {
  // Simulated 7-day sales
  const data = [
    { d: 'Dim', v: 520000, t: 42 },
    { d: 'Lun', v: 480000, t: 38 },
    { d: 'Mar', v: 610000, t: 49 },
    { d: 'Mer', v: 590000, t: 47 },
    { d: 'Jeu', v: 680000, t: 54 },
    { d: 'Ven', v: 750000, t: 58 },
    { d: 'Sam', v: 657500, t: 54 },
  ];
  const max = Math.max(...data.map(d => d.v));
  const w = 600, h = 200, pad = { t:20, r:20, b:30, l:60 };
  const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
  const pts = data.map((d, i) => ({
    x: pad.l + (i / (data.length - 1)) * innerW,
    y: pad.t + innerH - (d.v / max) * innerH,
    ...d,
  }));
  const linePath = pts.map((p,i) => `${i===0?'M':'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L ${pts[pts.length-1].x},${pad.t+innerH} L ${pts[0].x},${pad.t+innerH} Z`;

  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'18px 22px',
                 boxShadow:'var(--fs-shadow-sm)'}}>
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                   marginBottom:14}}>
        <div>
          <div style={{fontFamily:'var(--fs-font-display)', fontSize:17, fontWeight:600,
                       color:'var(--fs-ink-900)'}}>
            Ventes sur 7 jours
          </div>
          <div style={{fontSize:11, color:'var(--fs-ink-500)', marginTop:2}}>
            Chiffre d'affaires journalier · toutes caisses
          </div>
        </div>
        <div style={{display:'flex', gap:4, background:'var(--fs-ivory)', padding:3,
                     borderRadius:'var(--fs-r-sm)'}}>
          {['7j','30j','90j','1 an'].map((p,i) => (
            <button key={p} style={{
              padding:'4px 10px', fontSize:11, fontWeight:600, border:'none',
              borderRadius:'var(--fs-r-xs)', cursor:'pointer',
              background: i===0 ? 'var(--fs-paper)' : 'transparent',
              color: i===0 ? 'var(--fs-wine-700)' : 'var(--fs-ink-500)',
              boxShadow: i===0 ? 'var(--fs-shadow-sm)' : 'none',
            }}>{p}</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%', height:'auto', display:'block'}}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fs-wine-700)" stopOpacity="0.20"/>
            <stop offset="100%" stopColor="var(--fs-wine-700)" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* Y grid lines */}
        {[0,0.25,0.5,0.75,1].map((r,i) => (
          <g key={i}>
            <line x1={pad.l} x2={w-pad.r}
                  y1={pad.t + innerH*(1-r)} y2={pad.t + innerH*(1-r)}
                  stroke="var(--fs-line)" strokeWidth="1" strokeDasharray={r===0?"":"2 3"}/>
            <text x={pad.l-8} y={pad.t + innerH*(1-r) + 3}
                  fontSize="10" fill="var(--fs-ink-400)" textAnchor="end"
                  fontFamily="var(--fs-font-mono)">
              {Math.round(max*r/1000)}k
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#areaGrad)"/>
        <path d={linePath} fill="none" stroke="var(--fs-wine-700)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="var(--fs-paper)" stroke="var(--fs-wine-700)" strokeWidth="2"/>
            <text x={p.x} y={h-10} fontSize="10" fill="var(--fs-ink-500)" textAnchor="middle"
                  fontFamily="var(--fs-font-sans)" fontWeight="600">{p.d}</text>
          </g>
        ))}
        {/* Highlight peak */}
        <circle cx={pts[5].x} cy={pts[5].y} r="6" fill="var(--fs-gold-500)"/>
        <text x={pts[5].x} y={pts[5].y - 10} fontSize="10" fill="var(--fs-wine-700)"
              textAnchor="middle" fontWeight="700" fontFamily="var(--fs-font-mono)">
          {Math.round(pts[5].v/1000)}k
        </text>
      </svg>
    </div>
  );
}

function TopProducts() {
  const items = [
    { name: 'Savon noir du Cameroun', sales: 127, revenue: 158750, hue: 25 },
    { name: 'Eau minérale 1,5L', sales: 98, revenue: 49000, hue: 200 },
    { name: 'Gel douche hibiscus', sales: 64, revenue: 156800, hue: 345 },
    { name: 'Huile de karité', sales: 52, revenue: 182000, hue: 38 },
    { name: 'Dentifrice girofle', sales: 48, revenue: 88800, hue: 15 },
  ];
  const maxSales = Math.max(...items.map(i => i.sales));
  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'18px 20px',
                 boxShadow:'var(--fs-shadow-sm)'}}>
      <div style={{fontFamily:'var(--fs-font-display)', fontSize:17, fontWeight:600,
                   color:'var(--fs-ink-900)', marginBottom:2}}>
        Meilleures ventes
      </div>
      <div style={{fontSize:11, color:'var(--fs-ink-500)', marginBottom:14}}>
        Par volume · 7 derniers jours
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {items.map((it, i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:28, height:28, borderRadius:'var(--fs-r-sm)',
                         background:`linear-gradient(135deg, oklch(0.88 0.08 ${it.hue}), oklch(0.75 0.13 ${it.hue}))`,
                         border:'1px solid var(--fs-line)', flexShrink:0}}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600, color:'var(--fs-ink-900)',
                           whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                {it.name}
              </div>
              <div style={{height:3, background:'var(--fs-line)', borderRadius:2, marginTop:4}}>
                <div style={{width:`${(it.sales/maxSales)*100}%`, height:'100%',
                             background:'var(--fs-gold-500)', borderRadius:2}}/>
              </div>
            </div>
            <div style={{textAlign:'right', flexShrink:0}}>
              <div style={{fontSize:12, fontWeight:700, fontFamily:'var(--fs-font-mono)',
                           color:'var(--fs-ink-900)'}}>{it.sales}</div>
              <div style={{fontSize:10, color:'var(--fs-ink-500)', fontFamily:'var(--fs-font-mono)'}}>
                {fmtXAF(it.revenue)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffPanel() {
  const staff = [
    { name: 'Aïcha N.', role: 'Caissière', status: 'active', station: 'Caisse 01', sales: 18, hours: '08:00–16:00', initials: 'AN', color:'var(--fs-wine-700)' },
    { name: 'Marie T.', role: 'Caissière', status: 'active', station: 'Caisse 02', sales: 14, hours: '09:00–17:00', initials: 'MT', color:'var(--fs-gold-600)' },
    { name: 'Samuel O.', role: 'Gestionnaire', status: 'active', station: 'Stock', sales: 0, hours: '07:00–15:00', initials: 'SO', color:'var(--fs-info-500)' },
    { name: 'Jean D.', role: 'Caissier', status: 'pause', station: 'Caisse 03', sales: 9, hours: '10:00–18:00', initials: 'JD', color:'var(--fs-success-500)' },
    { name: 'Fatou K.', role: 'Caissière', status: 'off', station: '—', sales: 0, hours: 'Repos', initials: 'FK', color:'var(--fs-ink-400)' },
  ];
  const statusDot = {
    active: 'var(--fs-success-500)',
    pause: 'var(--fs-warning-500)',
    off: 'var(--fs-ink-300)',
  };
  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'18px 20px',
                 boxShadow:'var(--fs-shadow-sm)', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                   marginBottom:14}}>
        <div>
          <div style={{fontFamily:'var(--fs-font-display)', fontSize:17, fontWeight:600,
                       color:'var(--fs-ink-900)'}}>
            Équipe en service
          </div>
          <div style={{fontSize:11, color:'var(--fs-ink-500)', marginTop:2}}>
            4 présents · 1 au repos
          </div>
        </div>
        <Btn variant="ghost" size="sm" icon="plus">Ajouter</Btn>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:8, flex:1}}>
        {staff.map((s,i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:10,
                                padding:'8px 10px', borderRadius:'var(--fs-r-sm)',
                                background: s.status==='off' ? 'var(--fs-ivory)' : 'transparent',
                                border:'1px solid transparent'}}>
            <div style={{position:'relative', flexShrink:0}}>
              <div style={{width:32, height:32, borderRadius:'50%', background:s.color,
                           color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                           fontSize:11, fontWeight:700, fontFamily:'var(--fs-font-display)',
                           opacity: s.status==='off'?0.5:1}}>
                {s.initials}
              </div>
              <div style={{position:'absolute', bottom:-1, right:-1, width:10, height:10,
                           borderRadius:'50%', background: statusDot[s.status],
                           border:'2px solid var(--fs-paper)'}}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600, color:'var(--fs-ink-900)'}}>
                {s.name}
              </div>
              <div style={{fontSize:10, color:'var(--fs-ink-500)'}}>
                {s.role} · {s.station}
              </div>
            </div>
            <div style={{textAlign:'right', flexShrink:0}}>
              <div style={{fontSize:10, color:'var(--fs-ink-500)', fontFamily:'var(--fs-font-mono)'}}>
                {s.hours}
              </div>
              {s.sales > 0 && (
                <div style={{fontSize:10, color:'var(--fs-wine-700)', fontWeight:600,
                             fontFamily:'var(--fs-font-mono)', marginTop:1}}>
                  {s.sales} ventes
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentTransactions() {
  const txns = [
    { id:'TK-24-000847', cashier:'Aïcha N.', station:'C01', total:21750, method:'cash', items:4, time:'14:23', status:'ok' },
    { id:'TK-24-000846', cashier:'Marie T.', station:'C02', total:8350, method:'mobile', items:2, time:'14:19', status:'ok' },
    { id:'TK-24-000845', cashier:'Aïcha N.', station:'C01', total:15200, method:'card', items:6, time:'14:12', status:'ok' },
    { id:'TK-24-000844', cashier:'Jean D.', station:'C03', total:32400, method:'cash', items:11, time:'14:05', status:'ok' },
    { id:'TK-24-000843', cashier:'Marie T.', station:'C02', total:4500, method:'mobile', items:1, time:'13:58', status:'refund' },
    { id:'TK-24-000842', cashier:'Aïcha N.', station:'C01', total:12900, method:'cash', items:3, time:'13:51', status:'ok' },
    { id:'TK-24-000841', cashier:'Jean D.', station:'C03', total:27800, method:'card', items:8, time:'13:44', status:'ok' },
  ];
  const methodIcon = { cash:'cash', mobile:'mobile', card:'card' };
  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'18px 0 0',
                 boxShadow:'var(--fs-shadow-sm)', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                   padding:'0 20px 14px'}}>
        <div>
          <div style={{fontFamily:'var(--fs-font-display)', fontSize:17, fontWeight:600}}>
            Dernières transactions
          </div>
          <div style={{fontSize:11, color:'var(--fs-ink-500)', marginTop:2}}>
            Journal des ventes en temps réel
          </div>
        </div>
        <Btn variant="ghost" size="sm" icon="arrowRight">Tout voir</Btn>
      </div>
      <div style={{flex:1}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:11.5}}>
          <thead>
            <tr style={{background:'var(--fs-ivory)', borderTop:'1px solid var(--fs-line)',
                        borderBottom:'1px solid var(--fs-line)'}}>
              {['Ticket','Caisse','Articles','Paiement','Heure','Total'].map(h => (
                <th key={h} style={{textAlign: h==='Total'?'right':'left',
                                    padding:'8px 16px', fontSize:10,
                                    color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                                    fontWeight:600, textTransform:'uppercase'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txns.map((t,i) => (
              <tr key={t.id} style={{borderBottom:'1px solid var(--fs-line)'}}>
                <td style={{padding:'9px 16px'}}>
                  <div style={{fontFamily:'var(--fs-font-mono)', fontSize:11,
                               color:'var(--fs-ink-900)', fontWeight:600}}>
                    {t.id.slice(-6)}
                  </div>
                  <div style={{fontSize:10, color:'var(--fs-ink-500)'}}>{t.cashier}</div>
                </td>
                <td style={{padding:'9px 16px', fontFamily:'var(--fs-font-mono)',
                           color:'var(--fs-ink-700)'}}>{t.station}</td>
                <td style={{padding:'9px 16px', color:'var(--fs-ink-700)'}}>{t.items} art.</td>
                <td style={{padding:'9px 16px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <Icon name={methodIcon[t.method]} size={13} color="var(--fs-ink-500)"/>
                    <span style={{fontSize:11, color:'var(--fs-ink-700)', textTransform:'capitalize'}}>
                      {t.method==='mobile'?'Mobile M.':t.method==='cash'?'Espèces':'Carte'}
                    </span>
                  </div>
                </td>
                <td style={{padding:'9px 16px', fontFamily:'var(--fs-font-mono)',
                           color:'var(--fs-ink-500)'}}>{t.time}</td>
                <td style={{padding:'9px 16px', textAlign:'right'}}>
                  <span style={{fontFamily:'var(--fs-font-mono)', fontWeight:700,
                               color: t.status==='refund'?'var(--fs-danger-700)':'var(--fs-ink-900)'}}>
                    {t.status==='refund'?'− ':''}{fmtXAF(t.total)}
                  </span>
                  {t.status==='refund' && (
                    <span style={{fontSize:9, marginLeft:6,
                                  color:'var(--fs-danger-700)',
                                  background:'var(--fs-danger-100)',
                                  padding:'1px 5px', borderRadius:3, fontWeight:700}}>
                      REMB.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentMix() {
  const methods = [
    { label: 'Espèces',     pct: 42, value: 1800750, color: 'var(--fs-wine-700)', icon: 'cash' },
    { label: 'Mobile Money', pct: 38, value: 1629250, color: 'var(--fs-gold-500)', icon: 'mobile' },
    { label: 'Carte bancaire', pct: 20, value: 857500, color: 'var(--fs-info-500)', icon: 'card' },
  ];
  const cx = 80, cy = 80, r = 60, inner = 42;
  let cumAngle = -Math.PI/2;
  const arcs = methods.map(m => {
    const angle = (m.pct/100) * Math.PI*2;
    const start = cumAngle;
    const end = cumAngle + angle;
    cumAngle = end;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const x3 = cx + inner * Math.cos(end), y3 = cy + inner * Math.sin(end);
    const x4 = cx + inner * Math.cos(start), y4 = cy + inner * Math.sin(start);
    return {
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4} Z`,
      ...m,
    };
  });
  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'18px 20px',
                 boxShadow:'var(--fs-shadow-sm)'}}>
      <div style={{fontFamily:'var(--fs-font-display)', fontSize:17, fontWeight:600,
                   color:'var(--fs-ink-900)'}}>
        Modes de paiement
      </div>
      <div style={{fontSize:11, color:'var(--fs-ink-500)', marginTop:2, marginBottom:10}}>
        Répartition · 7 derniers jours
      </div>
      <div style={{display:'flex', justifyContent:'center', margin:'4px 0 12px'}}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color}/>)}
          <text x={cx} y={cy-3} textAnchor="middle" fontSize="10"
                fill="var(--fs-ink-500)" fontWeight="600" letterSpacing="0.06em">TOTAL</text>
          <text x={cx} y={cy+14} textAnchor="middle" fontSize="15"
                fill="var(--fs-ink-900)" fontWeight="700" fontFamily="var(--fs-font-display)">
            4,3M
          </text>
          <text x={cx} y={cy+26} textAnchor="middle" fontSize="8"
                fill="var(--fs-gold-600)" fontWeight="600">XAF</text>
        </svg>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        {methods.map((m,i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:10}}>
            <span style={{width:10, height:10, borderRadius:2, background:m.color, flexShrink:0}}/>
            <Icon name={m.icon} size={13} color="var(--fs-ink-500)"/>
            <span style={{flex:1, fontSize:12, color:'var(--fs-ink-700)', fontWeight:500}}>
              {m.label}
            </span>
            <span style={{fontSize:12, fontWeight:700, fontFamily:'var(--fs-font-mono)',
                          color:'var(--fs-ink-900)'}}>{m.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.AdminScreen = AdminScreen;
