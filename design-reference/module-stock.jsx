// Module STOCK — Gestionnaire de stock sur desktop (1440×900)
// Layout: sidebar | header avec KPIs | tableau produits + panneau détail

const STOCK_PRODUCTS = [
  { sku: '8901030895548', name: 'Huile de karité brute 250ml',      cat: 'Beauté',     supplier: 'Coop. Bamenda',    price: 3500, cost: 2100, stock: 42,  reorder: 20, expiry: '2027-03-15', location: 'A-12', hue: 38 },
  { sku: '7622210992086', name: 'Savon noir du Cameroun 200g',      cat: 'Beauté',     supplier: 'Artisanat Douala', price: 1250, cost: 650,  stock: 87,  reorder: 40, expiry: '2028-11-02', location: 'A-05', hue: 25 },
  { sku: '6111242100478', name: 'Beurre de cacao pur 100g',         cat: 'Beauté',     supplier: 'Coop. Bamenda',    price: 2800, cost: 1600, stock: 24,  reorder: 30, expiry: '2026-08-20', location: 'A-08', hue: 40 },
  { sku: '3600523417193', name: 'Masque argile ghassoul 150g',      cat: 'Beauté',     supplier: 'Import Maroc',     price: 4200, cost: 2500, stock: 18,  reorder: 25, expiry: '2027-05-10', location: 'A-14', hue: 30 },
  { sku: '3274080005003', name: 'Eau de rose bio 200ml',            cat: 'Parfumerie', supplier: 'Import France',    price: 5500, cost: 3200, stock: 12,  reorder: 15, expiry: '2026-06-30', location: 'B-02', hue: 350 },
  { sku: '3337872414428', name: 'Huile essentielle lavande 30ml',   cat: 'Parfumerie', supplier: 'Import France',    price: 8900, cost: 5400, stock: 9,   reorder: 12, expiry: '2028-04-15', location: 'B-06', hue: 260 },
  { sku: '3401560048926', name: 'Gel douche hibiscus 500ml',        cat: 'Hygiène',    supplier: 'Sofaco SA',        price: 2450, cost: 1400, stock: 64,  reorder: 30, expiry: '2027-09-18', location: 'C-03', hue: 345 },
  { sku: '3086126008110', name: 'Dentifrice girofle 75ml',          cat: 'Hygiène',    supplier: 'Sofaco SA',        price: 1850, cost: 950,  stock: 38,  reorder: 25, expiry: '2026-12-05', location: 'C-07', hue: 15 },
  { sku: '8000500310427', name: 'Crème hydratante miel 50ml',       cat: 'Beauté',     supplier: 'Coop. Bamenda',    price: 6200, cost: 3800, stock: 7,   reorder: 15, expiry: '2026-05-22', location: 'A-18', hue: 45 },
  { sku: '5449000000996', name: 'Eau minérale 1,5L',                cat: 'Boissons',   supplier: 'SEMC',             price: 500,  cost: 280,  stock: 156, reorder: 80, expiry: '2026-10-01', location: 'D-01', hue: 200 },
  { sku: '3017620422003', name: 'Jus de bissap artisanal 1L',       cat: 'Boissons',   supplier: 'Coop. Douala',     price: 1800, cost: 1050, stock: 28,  reorder: 40, expiry: '2026-02-14', location: 'D-05', hue: 340 },
  { sku: '3168930010265', name: 'Miel de baobab 500g',              cat: 'Épicerie',   supplier: 'Coop. Garoua',     price: 7800, cost: 4500, stock: 14,  reorder: 20, expiry: '2028-07-08', location: 'E-02', hue: 40 },
];

function StockScreen() {
  const [selectedSku, setSelectedSku] = React.useState(STOCK_PRODUCTS[2].sku);
  const [activeNav, setActiveNav] = React.useState('produits');
  const [filter, setFilter] = React.useState('all');

  const selected = STOCK_PRODUCTS.find(p => p.sku === selectedSku);

  const filteredProducts = STOCK_PRODUCTS.filter(p => {
    if (filter === 'low') return p.stock < p.reorder;
    if (filter === 'expiring') {
      const days = (new Date(p.expiry) - new Date('2026-04-25')) / (1000*60*60*24);
      return days < 180;
    }
    return true;
  });

  const lowStockCount = STOCK_PRODUCTS.filter(p => p.stock < p.reorder).length;
  const expiringCount = STOCK_PRODUCTS.filter(p => {
    const days = (new Date(p.expiry) - new Date('2026-04-25')) / (1000*60*60*24);
    return days < 180;
  }).length;
  const totalValue = STOCK_PRODUCTS.reduce((s, p) => s + p.cost * p.stock, 0);

  const stockRatio = (s, r) => Math.min(100, (s / (r * 2)) * 100);
  const stockTone = (s, r) => s < r * 0.5 ? 'danger' : s < r ? 'warning' : 'success';

  return (
    <div className="fs-app" style={{width:'100%', height:'100%', display:'flex',
                                     background:'var(--fs-ivory)'}}>
      <StockSidebar active={activeNav} onNav={setActiveNav}/>

      <main style={{flex:1, display:'flex', flexDirection:'column', minWidth:0}}>
        {/* Top bar */}
        <div style={{height:64, background:'var(--fs-paper)',
                     borderBottom:'1px solid var(--fs-line)',
                     display:'flex', alignItems:'center', padding:'0 28px', gap:20}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:'var(--fs-ink-400)', letterSpacing:'0.08em',
                         textTransform:'uppercase', fontWeight:600}}>
              Gestion de stock
            </div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:24, fontWeight:600,
                         color:'var(--fs-ink-900)', marginTop:2}}>
              Catalogue produits
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10,
                       background:'var(--fs-ivory)', border:'1px solid var(--fs-line-2)',
                       borderRadius:'var(--fs-r-md)', padding:'0 14px', height:40, width:320}}>
            <Icon name="search" size={16} color="var(--fs-ink-400)"/>
            <input placeholder="Rechercher SKU, nom, fournisseur…" style={{
              flex:1, border:'none', outline:'none', background:'transparent',
              fontSize:13, height:'100%'
            }}/>
          </div>
          <Btn variant="secondary" size="md" icon="download">Exporter</Btn>
          <Btn variant="primary" size="md" icon="plus">Nouveau produit</Btn>
          <div style={{width:1, height:30, background:'var(--fs-line)'}}/>
          <div style={{position:'relative'}}>
            <IconBtn icon="bell" tone="soft" size={40}/>
            <span style={{position:'absolute', top:-2, right:-2, width:16, height:16,
                          borderRadius:'50%', background:'var(--fs-danger-500)', color:'#fff',
                          fontSize:9, fontWeight:700, display:'flex', alignItems:'center',
                          justifyContent:'center', border:'2px solid var(--fs-paper)'}}>
              {lowStockCount}
            </span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{width:34, height:34, borderRadius:'50%', background:'var(--fs-wine-700)',
                         color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                         fontSize:12, fontWeight:700, fontFamily:'var(--fs-font-display)'}}>SO</div>
            <div style={{lineHeight:1.2}}>
              <div style={{fontSize:12, fontWeight:600}}>Samuel O.</div>
              <div style={{fontSize:10, color:'var(--fs-ink-500)'}}>Gestionnaire</div>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12,
                     padding:'18px 28px 0'}}>
          <KPICard label="Références actives" value="847" trend="+12" trendTone="success" icon="boxes"/>
          <KPICard label="Valeur du stock" value={fmtXAF(totalValue)} suffix="XAF" trend="+4,2 %" trendTone="success" icon="chart"/>
          <KPICard label="Stock faible" value={String(lowStockCount)} trend={`${lowStockCount} à réapprovisionner`} trendTone="warning" icon="alert"/>
          <KPICard label="Péremption < 6 mois" value={String(expiringCount)} trend="À surveiller" trendTone="danger" icon="clock"/>
        </div>

        {/* Main split: table + detail */}
        <div style={{flex:1, display:'flex', gap:16, padding:'18px 28px', minHeight:0}}>
          {/* Products table */}
          <div style={{flex:1, background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                       borderRadius:'var(--fs-r-md)', overflow:'hidden',
                       display:'flex', flexDirection:'column', minWidth:0}}>
            <div style={{padding:'12px 16px', borderBottom:'1px solid var(--fs-line)',
                         display:'flex', alignItems:'center', gap:8}}>
              {[
                {id:'all', label:'Tous', count: STOCK_PRODUCTS.length},
                {id:'low', label:'Stock bas', count: lowStockCount, tone:'warning'},
                {id:'expiring', label:'Péremption proche', count: expiringCount, tone:'danger'},
              ].map(tab => (
                <button key={tab.id} onClick={()=>setFilter(tab.id)} style={{
                  padding:'6px 12px', borderRadius:'var(--fs-r-sm)',
                  background: filter===tab.id ? 'var(--fs-wine-700)' : 'transparent',
                  color: filter===tab.id ? '#fff' : 'var(--fs-ink-700)',
                  border: filter===tab.id ? '1px solid var(--fs-wine-700)' : '1px solid var(--fs-line)',
                  fontSize:12, fontWeight:600, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:6,
                }}>
                  {tab.label}
                  <span style={{fontSize:10, padding:'1px 5px', borderRadius:3,
                               background: filter===tab.id ? 'rgba(255,255,255,0.15)' : 'var(--fs-line)',
                               fontFamily:'var(--fs-font-mono)'}}>{tab.count}</span>
                </button>
              ))}
              <div style={{flex:1}}/>
              <Btn variant="ghost" size="sm" icon="filter">Filtres</Btn>
              <Btn variant="ghost" size="sm" icon="refresh"/>
            </div>

            <div style={{overflow:'auto', flex:1}} className="fs-scroll">
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                <thead>
                  <tr style={{background:'var(--fs-ivory)', borderBottom:'1px solid var(--fs-line)'}}>
                    {['Produit','SKU','Emplac.','Prix','Stock','Seuil','Péremption','']
                      .map(h => (
                      <th key={h} style={{
                        textAlign: h==='Prix'||h==='Stock'||h==='Seuil' ? 'right' : 'left',
                        padding:'10px 12px', fontSize:10, color:'var(--fs-ink-500)',
                        letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600,
                        position:'sticky', top:0, background:'var(--fs-ivory)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const isSelected = p.sku === selectedSku;
                    const tone = stockTone(p.stock, p.reorder);
                    const ratio = stockRatio(p.stock, p.reorder);
                    const daysToExpiry = Math.round((new Date(p.expiry) - new Date('2026-04-25')) / (1000*60*60*24));
                    return (
                      <tr key={p.sku} onClick={()=>setSelectedSku(p.sku)} style={{
                        cursor:'pointer',
                        background: isSelected ? 'var(--fs-wine-50)' : 'transparent',
                        borderBottom:'1px solid var(--fs-line)',
                        borderLeft: isSelected ? '3px solid var(--fs-wine-700)' : '3px solid transparent',
                      }}>
                        <td style={{padding:'10px 12px'}}>
                          <div style={{display:'flex', alignItems:'center', gap:10}}>
                            <div style={{width:32, height:32, borderRadius:'var(--fs-r-sm)',
                                         background:`linear-gradient(135deg, oklch(0.88 0.08 ${p.hue}), oklch(0.75 0.13 ${p.hue}))`,
                                         border:'1px solid var(--fs-line)', flexShrink:0}}/>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:12, fontWeight:600, color:'var(--fs-ink-900)',
                                           whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                                           maxWidth:240}}>{p.name}</div>
                              <div style={{fontSize:10, color:'var(--fs-ink-500)'}}>{p.cat} · {p.supplier}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'10px 12px', fontFamily:'var(--fs-font-mono)',
                                   fontSize:10, color:'var(--fs-ink-500)'}}>{p.sku.slice(-6)}</td>
                        <td style={{padding:'10px 12px', fontFamily:'var(--fs-font-mono)',
                                   fontSize:11}}>{p.location}</td>
                        <td style={{padding:'10px 12px', textAlign:'right', fontFamily:'var(--fs-font-mono)',
                                   fontWeight:600, color:'var(--fs-ink-900)'}}>
                          {fmtXAF(p.price)}
                        </td>
                        <td style={{padding:'10px 12px', textAlign:'right'}}>
                          <div style={{display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end'}}>
                            <div style={{width:50, height:4, background:'var(--fs-line)',
                                         borderRadius:2, overflow:'hidden'}}>
                              <div style={{width:`${ratio}%`, height:'100%',
                                           background: tone==='danger'?'var(--fs-danger-500)'
                                                     : tone==='warning'?'var(--fs-warning-500)'
                                                                        :'var(--fs-success-500)'}}/>
                            </div>
                            <span style={{fontFamily:'var(--fs-font-mono)', fontWeight:600,
                                         color: tone==='danger'?'var(--fs-danger-700)'
                                              : tone==='warning'?'var(--fs-warning-700)'
                                                                 :'var(--fs-ink-900)',
                                         minWidth:28}}>
                              {p.stock}
                            </span>
                          </div>
                        </td>
                        <td style={{padding:'10px 12px', textAlign:'right',
                                   fontFamily:'var(--fs-font-mono)', color:'var(--fs-ink-400)'}}>
                          {p.reorder}
                        </td>
                        <td style={{padding:'10px 12px'}}>
                          <Badge tone={daysToExpiry < 90 ? 'danger' : daysToExpiry < 180 ? 'warning' : 'neutral'}>
                            {daysToExpiry < 365 ? `${daysToExpiry} j` : p.expiry.slice(0,7)}
                          </Badge>
                        </td>
                        <td style={{padding:'10px 12px'}}>
                          <Icon name="chevronRight" size={14} color="var(--fs-ink-400)"/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail panel */}
          {selected && <StockDetail product={selected} stockRatio={stockRatio} stockTone={stockTone}/>}
        </div>
      </main>
    </div>
  );
}

// ───── Sidebar ─────
function StockSidebar({ active, onNav }) {
  const items = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard' },
    { id: 'produits',  label: 'Catalogue produits', icon: 'boxes' },
    { id: 'receptions',label: 'Réceptions', icon: 'truck' },
    { id: 'inventaire',label: 'Inventaire', icon: 'grid' },
    { id: 'alertes',   label: 'Alertes & seuils', icon: 'alert', badge: 4 },
    { id: 'etiquettes',label: 'Étiquettes / SKU', icon: 'tag' },
    { id: 'depots',    label: 'Dépôts', icon: 'store' },
    { id: 'fournisseurs', label: 'Fournisseurs', icon: 'users' },
  ];
  return (
    <aside style={{width:228, background:'var(--fs-paper)',
                   borderRight:'1px solid var(--fs-line)',
                   display:'flex', flexDirection:'column'}}>
      <div style={{padding:'20px 18px 16px', borderBottom:'1px solid var(--fs-line)'}}>
        <Logo variant="full" size={34}/>
      </div>
      <div style={{padding:'16px 12px 6px', fontSize:10, color:'var(--fs-ink-400)',
                   letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600}}>
        Gestion
      </div>
      <div style={{padding:'0 8px', flex:1}}>
        {items.map(it => (
          <button key={it.id} onClick={()=>onNav(it.id)} style={{
            width:'100%', display:'flex', alignItems:'center', gap:10,
            padding:'9px 12px', marginBottom:1,
            background: active===it.id ? 'var(--fs-wine-50)' : 'transparent',
            color: active===it.id ? 'var(--fs-wine-700)' : 'var(--fs-ink-700)',
            border:'none', borderRadius:'var(--fs-r-sm)',
            fontSize:13, fontWeight: active===it.id ? 600 : 500,
            textAlign:'left', cursor:'pointer',
            borderLeft: active===it.id ? '2px solid var(--fs-wine-700)' : '2px solid transparent',
          }}>
            <Icon name={it.icon} size={16}/>
            <span style={{flex:1}}>{it.label}</span>
            {it.badge && <span style={{background:'var(--fs-danger-500)', color:'#fff',
                                        fontSize:10, padding:'1px 6px', borderRadius:8,
                                        fontWeight:700}}>{it.badge}</span>}
          </button>
        ))}
      </div>
      <div style={{padding:14, borderTop:'1px solid var(--fs-line)',
                   background:'var(--fs-gold-50)'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
          <Icon name="store" size={14} color="var(--fs-gold-700)"/>
          <span style={{fontSize:10, fontWeight:700, color:'var(--fs-gold-700)',
                        letterSpacing:'0.08em'}}>DÉPÔT PRINCIPAL</span>
        </div>
        <div style={{fontSize:12, fontWeight:600, color:'var(--fs-ink-900)'}}>
          Akwa · Douala
        </div>
        <div style={{fontSize:10, color:'var(--fs-ink-500)', marginTop:2}}>
          3 dépôts · 847 références
        </div>
      </div>
    </aside>
  );
}

// ───── KPI card ─────
function KPICard({ label, value, suffix, trend, trendTone = 'neutral', icon }) {
  const tones = {
    success: 'var(--fs-success-700)',
    warning: 'var(--fs-warning-700)',
    danger: 'var(--fs-danger-700)',
    neutral: 'var(--fs-ink-500)',
  };
  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'14px 18px',
                 display:'flex', flexDirection:'column', gap:4,
                 boxShadow:'var(--fs-shadow-sm)'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <span style={{fontSize:11, color:'var(--fs-ink-500)', letterSpacing:'0.04em',
                      fontWeight:600}}>{label}</span>
        <Icon name={icon} size={16} color="var(--fs-gold-600)"/>
      </div>
      <div style={{fontFamily:'var(--fs-font-display)', fontSize:28, fontWeight:700,
                   color:'var(--fs-ink-900)', letterSpacing:'-0.01em',
                   fontVariantNumeric:'tabular-nums'}}>
        {value}
        {suffix && <span style={{fontSize:13, color:'var(--fs-ink-500)', marginLeft:4,
                                 fontFamily:'var(--fs-font-sans)', fontWeight:500}}>{suffix}</span>}
      </div>
      <div style={{fontSize:11, color: tones[trendTone], fontWeight:600}}>
        {trend}
      </div>
    </div>
  );
}

// ───── Detail panel ─────
function StockDetail({ product, stockRatio, stockTone }) {
  const tone = stockTone(product.stock, product.reorder);
  const ratio = stockRatio(product.stock, product.reorder);
  const margin = ((product.price - product.cost) / product.price * 100).toFixed(1);
  const daysToExpiry = Math.round((new Date(product.expiry) - new Date('2026-04-25')) / (1000*60*60*24));

  return (
    <div style={{width:340, background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', display:'flex', flexDirection:'column',
                 overflow:'hidden', flexShrink:0}}>
      <div style={{padding:'16px 18px', borderBottom:'1px solid var(--fs-line)',
                   background:'var(--fs-ivory)'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
          <Badge tone="wine">{product.cat}</Badge>
          <Badge tone={tone}>{tone==='danger'?'Stock critique':tone==='warning'?'À surveiller':'Stock OK'}</Badge>
        </div>
        <div style={{fontFamily:'var(--fs-font-display)', fontSize:20, fontWeight:600,
                     color:'var(--fs-ink-900)', lineHeight:1.25}}>
          {product.name}
        </div>
        <div style={{fontFamily:'var(--fs-font-mono)', fontSize:11, color:'var(--fs-ink-500)',
                     marginTop:4}}>
          {product.sku}
        </div>
      </div>

      <div style={{height:160, background:`linear-gradient(135deg, oklch(0.88 0.08 ${product.hue}), oklch(0.72 0.14 ${product.hue}))`,
                   position:'relative', borderBottom:'1px solid var(--fs-line)'}}>
        <div style={{position:'absolute', bottom:10, left:14,
                     background:'rgba(255,255,255,0.9)', backdropFilter:'blur(4px)',
                     padding:'4px 8px', borderRadius:'var(--fs-r-xs)',
                     fontSize:10, fontWeight:600, fontFamily:'var(--fs-font-mono)'}}>
          Emplacement {product.location}
        </div>
      </div>

      <div style={{flex:1, overflow:'auto', padding:'14px 18px', display:'flex',
                   flexDirection:'column', gap:14}} className="fs-scroll">
        {/* Stock level */}
        <section>
          <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between',
                       marginBottom:8}}>
            <span style={{fontSize:10, color:'var(--fs-ink-500)', letterSpacing:'0.08em',
                          textTransform:'uppercase', fontWeight:600}}>Niveau de stock</span>
            <span style={{fontFamily:'var(--fs-font-display)', fontSize:24, fontWeight:700,
                          color: tone==='danger'?'var(--fs-danger-700)':tone==='warning'?'var(--fs-warning-700)':'var(--fs-ink-900)',
                          fontVariantNumeric:'tabular-nums'}}>
              {product.stock} <span style={{fontSize:11, color:'var(--fs-ink-500)',
                                             fontFamily:'var(--fs-font-sans)', fontWeight:500}}>unités</span>
            </span>
          </div>
          <div style={{height:8, background:'var(--fs-line)', borderRadius:4, overflow:'hidden',
                       marginBottom:6}}>
            <div style={{width:`${ratio}%`, height:'100%',
                         background: tone==='danger'?'var(--fs-danger-500)':tone==='warning'?'var(--fs-warning-500)':'var(--fs-success-500)',
                         transition:'width 0.3s'}}/>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:10,
                       color:'var(--fs-ink-400)', fontFamily:'var(--fs-font-mono)'}}>
            <span>0</span>
            <span>Seuil : {product.reorder}</span>
            <span>Max : {product.reorder*2}</span>
          </div>
        </section>

        <div style={{height:1, background:'var(--fs-line)'}}/>

        {/* Financial */}
        <section style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <div style={{fontSize:10, color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                         textTransform:'uppercase', fontWeight:600, marginBottom:4}}>
              Prix de vente
            </div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:20, fontWeight:700,
                         color:'var(--fs-wine-700)', fontVariantNumeric:'tabular-nums'}}>
              {fmtXAF(product.price)}
              <span style={{fontSize:10, color:'var(--fs-gold-600)', marginLeft:3,
                            fontFamily:'var(--fs-font-sans)'}}>XAF</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:10, color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                         textTransform:'uppercase', fontWeight:600, marginBottom:4}}>
              Coût achat
            </div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:20, fontWeight:700,
                         color:'var(--fs-ink-700)', fontVariantNumeric:'tabular-nums'}}>
              {fmtXAF(product.cost)}
              <span style={{fontSize:10, color:'var(--fs-ink-400)', marginLeft:3,
                            fontFamily:'var(--fs-font-sans)'}}>XAF</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:10, color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                         textTransform:'uppercase', fontWeight:600, marginBottom:4}}>
              Marge
            </div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:20, fontWeight:700,
                         color:'var(--fs-success-700)', fontVariantNumeric:'tabular-nums'}}>
              {margin}<span style={{fontSize:12}}>%</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:10, color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                         textTransform:'uppercase', fontWeight:600, marginBottom:4}}>
              Valeur stock
            </div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:20, fontWeight:700,
                         color:'var(--fs-ink-700)', fontVariantNumeric:'tabular-nums'}}>
              {fmtXAF(product.cost * product.stock)}
              <span style={{fontSize:10, color:'var(--fs-ink-400)', marginLeft:3,
                            fontFamily:'var(--fs-font-sans)'}}>XAF</span>
            </div>
          </div>
        </section>

        <div style={{height:1, background:'var(--fs-line)'}}/>

        {/* Meta */}
        <section style={{display:'flex', flexDirection:'column', gap:8, fontSize:12}}>
          <MetaRow icon="truck" label="Fournisseur" value={product.supplier}/>
          <MetaRow icon="store" label="Emplacement" value={`Dépôt principal · ${product.location}`}/>
          <MetaRow icon="calendar" label="Péremption" value={`${product.expiry} · ${daysToExpiry} jours`}
                   tone={daysToExpiry < 180 ? 'warning' : 'neutral'}/>
          <MetaRow icon="clock" label="Dernière entrée" value="12 avril 2026 · +40 unités"/>
          <MetaRow icon="chart" label="Vitesse de vente" value="~4 unités / jour"/>
        </section>

        <div style={{height:1, background:'var(--fs-line)'}}/>

        <section>
          <div style={{fontSize:10, color:'var(--fs-ink-500)', letterSpacing:'0.08em',
                       textTransform:'uppercase', fontWeight:600, marginBottom:8}}>
            Mouvements récents
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {[
              { d:'25 avr.', t:'Vente', qty:-1, bal:24 },
              { d:'24 avr.', t:'Vente', qty:-3, bal:25 },
              { d:'23 avr.', t:'Vente', qty:-2, bal:28 },
              { d:'12 avr.', t:'Réception', qty:+40, bal:30 },
            ].map((m,i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:10, fontSize:11}}>
                <span style={{color:'var(--fs-ink-400)', fontFamily:'var(--fs-font-mono)',
                             width:44}}>{m.d}</span>
                <span style={{flex:1, color:'var(--fs-ink-700)'}}>{m.t}</span>
                <span style={{fontFamily:'var(--fs-font-mono)', fontWeight:600,
                             color: m.qty<0?'var(--fs-danger-700)':'var(--fs-success-700)',
                             minWidth:32, textAlign:'right'}}>
                  {m.qty>0?'+':''}{m.qty}
                </span>
                <span style={{color:'var(--fs-ink-400)', fontFamily:'var(--fs-font-mono)',
                             minWidth:28, textAlign:'right'}}>{m.bal}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div style={{padding:12, borderTop:'1px solid var(--fs-line)',
                   background:'var(--fs-ivory)', display:'flex', gap:6}}>
        <Btn variant="primary" size="sm" icon="plus" style={{flex:1}}>Réception</Btn>
        <Btn variant="secondary" size="sm" icon="edit">Modifier</Btn>
        <Btn variant="secondary" size="sm" icon="print"/>
      </div>
    </div>
  );
}

function MetaRow({ icon, label, value, tone = 'neutral' }) {
  const toneColor = tone==='warning' ? 'var(--fs-warning-700)' : 'var(--fs-ink-900)';
  return (
    <div style={{display:'flex', alignItems:'center', gap:10}}>
      <Icon name={icon} size={14} color="var(--fs-ink-400)"/>
      <span style={{flex:1, fontSize:11, color:'var(--fs-ink-500)'}}>{label}</span>
      <span style={{fontSize:11, fontWeight:600, color:toneColor}}>{value}</span>
    </div>
  );
}

window.StockScreen = StockScreen;
