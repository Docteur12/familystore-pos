// Module CAISSE — Point de vente sur tablette (1280×800)
// Layout: sidebar catégories | grille produits | panier actif à droite

const CAISSE_CATEGORIES = [
  { id: 'all',     name: 'Tout',         count: 847, icon: 'grid' },
  { id: 'beaute',  name: 'Beauté',       count: 182, icon: 'star' },
  { id: 'hygiene', name: 'Hygiène',      count: 124, icon: 'boxes' },
  { id: 'parfum',  name: 'Parfumerie',   count: 67,  icon: 'tag' },
  { id: 'epicerie',name: 'Épicerie',     count: 213, icon: 'store' },
  { id: 'boissons',name: 'Boissons',     count: 89,  icon: 'cart' },
  { id: 'bienetre',name: 'Bien-être',    count: 76,  icon: 'book' },
  { id: 'maison',  name: 'Maison',       count: 96,  icon: 'box' },
];

const CAISSE_PRODUCTS = [
  { sku: '8901030895548', name: 'Huile de karité brute',      cat: 'beaute',   price: 3500, stock: 42, hue: 38,  label: 'Karité · 250ml' },
  { sku: '7622210992086', name: 'Savon noir du Cameroun',     cat: 'beaute',   price: 1250, stock: 87, hue: 25,  label: 'Savon · 200g' },
  { sku: '6111242100478', name: 'Beurre de cacao pur',        cat: 'beaute',   price: 2800, stock: 24, hue: 40,  label: 'Cacao · 100g' },
  { sku: '3600523417193', name: 'Masque argile ghassoul',     cat: 'beaute',   price: 4200, stock: 18, hue: 30,  label: 'Argile · 150g' },
  { sku: '3274080005003', name: 'Eau de rose bio',            cat: 'parfum',   price: 5500, stock: 12, hue: 350, label: 'Rose · 200ml' },
  { sku: '3337872414428', name: 'Huile essentielle lavande',  cat: 'parfum',   price: 8900, stock: 9,  hue: 260, label: 'Lavande · 30ml' },
  { sku: '3401560048926', name: 'Gel douche hibiscus',        cat: 'hygiene',  price: 2450, stock: 64, hue: 345, label: 'Hibiscus · 500ml' },
  { sku: '3086126008110', name: 'Dentifrice au clou de girofle', cat: 'hygiene', price: 1850, stock: 38, hue: 15, label: 'Girofle · 75ml' },
  { sku: '8000500310427', name: 'Crème hydratante miel',      cat: 'beaute',   price: 6200, stock: 7,  hue: 45,  label: 'Miel · 50ml' },
  { sku: '5449000000996', name: 'Eau minérale 1,5L',          cat: 'boissons', price: 500,  stock: 156,hue: 200, label: 'Eau · 1,5L' },
  { sku: '3017620422003', name: 'Jus de bissap artisanal',    cat: 'boissons', price: 1800, stock: 28, hue: 340, label: 'Bissap · 1L' },
  { sku: '3560070042166', name: 'Thé vert à la menthe',       cat: 'boissons', price: 2200, stock: 45, hue: 120, label: 'Thé · 100g' },
  { sku: '3033710084005', name: 'Café arabica Éthiopie',      cat: 'epicerie', price: 4500, stock: 22, hue: 25,  label: 'Café · 250g' },
  { sku: '3168930010265', name: 'Miel de baobab',             cat: 'epicerie', price: 7800, stock: 14, hue: 40,  label: 'Miel · 500g' },
  { sku: '3256540000109', name: 'Huile d\'olive extra vierge',cat: 'epicerie', price: 5200, stock: 31, hue: 70,  label: 'Olive · 750ml' },
  { sku: '3029330003106', name: 'Épices ras-el-hanout',       cat: 'epicerie', price: 1950, stock: 52, hue: 20,  label: 'Épices · 50g' },
];

// ───── Product tile ────────────────────────────────────────────────
function ProductTile({ product, onAdd }) {
  const lowStock = product.stock <= 10;
  return (
    <button onClick={() => onAdd(product)} style={{
      background: 'var(--fs-paper)',
      border: '1px solid var(--fs-line)',
      borderRadius: 'var(--fs-r-md)',
      padding: 0,
      textAlign: 'left',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'transform 0.08s, box-shadow 0.12s, border-color 0.12s',
      position: 'relative',
      boxShadow: 'var(--fs-shadow-sm)',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--fs-gold-400)';
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = 'var(--fs-shadow-md)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--fs-line)';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'var(--fs-shadow-sm)';
    }}>
      {/* Product placeholder — abstract color swatch from hue */}
      <div style={{
        height: 86,
        background: `linear-gradient(135deg, oklch(0.88 0.08 ${product.hue}), oklch(0.75 0.13 ${product.hue}))`,
        position: 'relative',
        borderBottom: '1px solid var(--fs-line)',
      }}>
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
          padding: '3px 7px', borderRadius: 'var(--fs-r-xs)',
          fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-700)',
          fontFamily: 'var(--fs-font-mono)',
        }}>{product.stock}</div>
        {lowStock && (
          <div style={{position:'absolute', top:8, left:8,
                       background:'var(--fs-danger-500)', color:'#fff',
                       padding:'3px 7px', borderRadius:'var(--fs-r-xs)',
                       fontSize:9, fontWeight:700, letterSpacing:'0.04em'}}>STOCK BAS</div>
        )}
      </div>
      <div style={{padding: '10px 12px 12px', display:'flex', flexDirection:'column', gap:4, flex:1}}>
        <div style={{fontSize: 13, fontWeight: 600, color:'var(--fs-ink-900)',
                     lineHeight: 1.25, display:'-webkit-box',
                     WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
          {product.name}
        </div>
        <div style={{fontSize: 10, color: 'var(--fs-ink-400)', fontFamily:'var(--fs-font-mono)'}}>
          {product.label}
        </div>
        <div style={{marginTop:'auto', display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
          <span style={{fontSize: 15, fontWeight: 700, color: 'var(--fs-wine-700)',
                        fontFamily:'var(--fs-font-sans)', fontVariantNumeric:'tabular-nums'}}>
            {fmtXAF(product.price)}
          </span>
          <span style={{fontSize:10, color:'var(--fs-ink-400)', fontWeight:600}}>XAF</span>
        </div>
      </div>
    </button>
  );
}

// ───── Cart line ───────────────────────────────────────────────────
function CartLine({ item, onInc, onDec, onRemove }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 0',
      borderBottom: '1px solid var(--fs-line)',
    }}>
      <div style={{
        width: 44, height: 44, flexShrink: 0,
        borderRadius: 'var(--fs-r-sm)',
        background: `linear-gradient(135deg, oklch(0.88 0.08 ${item.hue}), oklch(0.75 0.13 ${item.hue}))`,
        border: '1px solid var(--fs-line)',
      }}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:600, color:'var(--fs-ink-900)',
                     whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {item.name}
        </div>
        <div style={{fontSize:11, color:'var(--fs-ink-500)', marginTop:2, fontFamily:'var(--fs-font-mono)'}}>
          {fmtXAF(item.price)} × {item.qty}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:4, marginTop:6}}>
          <button onClick={() => onDec(item.sku)} style={{
            width:24, height:24, borderRadius:'var(--fs-r-xs)',
            border:'1px solid var(--fs-line-2)', background:'var(--fs-paper)',
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
          }}>
            <Icon name="minus" size={12}/>
          </button>
          <span style={{minWidth:24, textAlign:'center', fontSize:13, fontWeight:600,
                        fontFamily:'var(--fs-font-mono)'}}>{item.qty}</span>
          <button onClick={() => onInc(item.sku)} style={{
            width:24, height:24, borderRadius:'var(--fs-r-xs)',
            border:'1px solid var(--fs-line-2)', background:'var(--fs-paper)',
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
          }}>
            <Icon name="plus" size={12}/>
          </button>
          <button onClick={() => onRemove(item.sku)} style={{
            marginLeft:'auto', width:24, height:24, borderRadius:'var(--fs-r-xs)',
            border:'none', background:'transparent', color:'var(--fs-danger-500)',
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
          }}>
            <Icon name="trash" size={14}/>
          </button>
        </div>
      </div>
      <div style={{fontSize:14, fontWeight:700, color:'var(--fs-ink-900)',
                   fontFamily:'var(--fs-font-sans)', fontVariantNumeric:'tabular-nums',
                   whiteSpace:'nowrap'}}>
        {fmtXAF(item.price * item.qty)}
      </div>
    </div>
  );
}

// ───── Caisse main screen ──────────────────────────────────────────
function CaisseScreen() {
  const [activeCat, setActiveCat] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [cart, setCart] = React.useState([
    { ...CAISSE_PRODUCTS[0], qty: 2 },
    { ...CAISSE_PRODUCTS[2], qty: 1 },
    { ...CAISSE_PRODUCTS[10], qty: 3 },
    { ...CAISSE_PRODUCTS[13], qty: 1 },
  ]);

  const addToCart = (p) => setCart(c => {
    const existing = c.find(x => x.sku === p.sku);
    if (existing) return c.map(x => x.sku === p.sku ? {...x, qty: x.qty + 1} : x);
    return [...c, { ...p, qty: 1 }];
  });
  const inc = (sku) => setCart(c => c.map(x => x.sku === sku ? {...x, qty: x.qty + 1} : x));
  const dec = (sku) => setCart(c => c.map(x => x.sku === sku ? {...x, qty: Math.max(1, x.qty - 1)} : x));
  const remove = (sku) => setCart(c => c.filter(x => x.sku !== sku));

  const filtered = CAISSE_PRODUCTS.filter(p =>
    (activeCat === 'all' || p.cat === activeCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search))
  );

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = 0;
  const total = subtotal - discount;

  return (
    <div className="fs-app" style={{
      width: '100%', height: '100%', display: 'flex',
      background: 'var(--fs-ivory)',
    }}>
      {/* ─── Left: Categories rail ─────────────────────────── */}
      <aside style={{
        width: 200, background: 'var(--fs-wine-900)',
        display: 'flex', flexDirection: 'column',
        color: '#f5ebd9',
      }}>
        <div style={{padding: '20px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)'}}>
          <Logo variant="mark" size={38}/>
          <div style={{marginTop:12, fontFamily:'var(--fs-font-display)', fontSize:18,
                       color:'#f5ebd9', letterSpacing:'0.02em'}}>Family Store</div>
          <div style={{fontSize:10, color:'var(--fs-gold-300)', fontStyle:'italic', marginTop:2,
                       letterSpacing:'0.08em'}}>Point de vente</div>
        </div>

        <div style={{padding: '14px 12px 6px', fontSize: 10, color:'var(--fs-gold-300)',
                     letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600}}>
          Catégories
        </div>
        <div style={{flex:1, overflow:'auto', padding:'0 8px'}} className="fs-scroll">
          {CAISSE_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', marginBottom: 2,
              background: activeCat === cat.id ? 'var(--fs-wine-700)' : 'transparent',
              color: activeCat === cat.id ? '#fff' : '#f5ebd9',
              border: 'none', borderRadius: 'var(--fs-r-sm)',
              fontSize: 13, fontWeight: activeCat === cat.id ? 600 : 500,
              textAlign: 'left', cursor: 'pointer',
              transition: 'background 0.12s',
              borderLeft: activeCat === cat.id ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
            }}>
              <Icon name={cat.icon} size={16} color={activeCat === cat.id ? 'var(--fs-gold-300)' : 'var(--fs-gold-400)'}/>
              <span style={{flex:1}}>{cat.name}</span>
              <span style={{fontSize:10, color:'var(--fs-gold-300)', fontFamily:'var(--fs-font-mono)'}}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)',
                     display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:32, height:32, borderRadius:'50%',
                       background:'var(--fs-gold-500)', display:'flex', alignItems:'center',
                       justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700,
                       fontFamily:'var(--fs-font-display)'}}>AN</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:12, fontWeight:600, color:'#fff'}}>Aïcha N.</div>
            <div style={{fontSize:10, color:'var(--fs-gold-300)'}}>Caissière · Caisse 01</div>
          </div>
          <button style={{background:'transparent', border:'none', color:'var(--fs-gold-300)',
                          cursor:'pointer', padding:4}}>
            <Icon name="logout" size={16}/>
          </button>
        </div>
      </aside>

      {/* ─── Middle: Products grid ─────────────────────────── */}
      <main style={{flex:1, display:'flex', flexDirection:'column', minWidth:0}}>
        {/* Search bar */}
        <div style={{padding: '14px 20px', background:'var(--fs-paper)',
                     borderBottom:'1px solid var(--fs-line)',
                     display:'flex', alignItems:'center', gap:10}}>
          <div style={{flex:1, display:'flex', alignItems:'center', gap:10,
                       background:'var(--fs-ivory)',
                       border:'1px solid var(--fs-line-2)',
                       borderRadius:'var(--fs-r-md)',
                       padding:'0 14px', height:44}}>
            <Icon name="search" size={18} color="var(--fs-ink-400)"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
                   placeholder="Rechercher un produit, scanner un code-barres…"
                   style={{flex:1, border:'none', outline:'none', background:'transparent',
                           fontSize:14, color:'var(--fs-ink-900)', height:'100%'}}/>
            <div style={{display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
                         background:'var(--fs-gold-100)', borderRadius:'var(--fs-r-xs)',
                         fontSize:10, fontWeight:600, color:'var(--fs-gold-700)',
                         letterSpacing:'0.06em'}}>
              <Icon name="scan" size={13}/>
              SCANNER PRÊT
            </div>
          </div>
          <IconBtn icon="grid" tone="soft" size={44} title="Vue grille"/>
          <IconBtn icon="list" tone="soft" size={44} title="Vue liste"/>
        </div>

        {/* Products grid */}
        <div style={{flex:1, overflow:'auto', padding:'16px 20px'}} className="fs-scroll">
          <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between',
                       marginBottom:12}}>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:20,
                         fontWeight:600, color:'var(--fs-ink-900)'}}>
              {CAISSE_CATEGORIES.find(c => c.id === activeCat)?.name}
              <span style={{marginLeft:10, fontSize:13, color:'var(--fs-ink-400)',
                            fontFamily:'var(--fs-font-sans)', fontWeight:500}}>
                {filtered.length} produit{filtered.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12,
                         color:'var(--fs-ink-500)'}}>
              <Icon name="filter" size={14}/>
              Trier par popularité
              <Icon name="chevronDown" size={14}/>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12}}>
            {filtered.map(p => <ProductTile key={p.sku} product={p} onAdd={addToCart}/>)}
          </div>
        </div>
      </main>

      {/* ─── Right: Active cart ────────────────────────────── */}
      <aside style={{width: 360, background:'var(--fs-paper)',
                     borderLeft:'1px solid var(--fs-line)',
                     display:'flex', flexDirection:'column'}}>
        {/* Header */}
        <div style={{padding:'16px 20px 14px', borderBottom:'1px solid var(--fs-line)',
                     display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:20,
                         fontWeight:600, color:'var(--fs-wine-700)'}}>
              Ticket en cours
            </div>
            <div style={{fontSize:11, color:'var(--fs-ink-500)', marginTop:2,
                         fontFamily:'var(--fs-font-mono)'}}>
              #TK-24-000847 · 14:23
            </div>
          </div>
          <div style={{width:36, height:36, borderRadius:'50%',
                       background:'var(--fs-wine-700)', color:'#fff',
                       display:'flex', alignItems:'center', justifyContent:'center',
                       fontSize:14, fontWeight:700, fontFamily:'var(--fs-font-mono)'}}>
            {cart.reduce((s,i)=>s+i.qty, 0)}
          </div>
        </div>

        {/* Customer row */}
        <button style={{
          margin:'10px 14px 0', padding:'10px 12px',
          background: 'var(--fs-gold-50)',
          border: '1px dashed var(--fs-gold-400)',
          borderRadius:'var(--fs-r-sm)',
          display:'flex', alignItems:'center', gap:10, cursor:'pointer',
        }}>
          <div style={{width:28, height:28, borderRadius:'50%',
                       background:'var(--fs-gold-500)', display:'flex',
                       alignItems:'center', justifyContent:'center', color:'#fff'}}>
            <Icon name="user" size={15}/>
          </div>
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontSize:12, fontWeight:600, color:'var(--fs-ink-900)'}}>
              Associer un client fidélité
            </div>
            <div style={{fontSize:10, color:'var(--fs-ink-500)'}}>
              Facultatif · +5% sur les achats
            </div>
          </div>
          <Icon name="chevronRight" size={14} color="var(--fs-gold-600)"/>
        </button>

        {/* Cart lines */}
        <div style={{flex:1, overflow:'auto', padding:'6px 14px'}} className="fs-scroll">
          {cart.map(item => (
            <CartLine key={item.sku} item={item} onInc={inc} onDec={dec} onRemove={remove}/>
          ))}
        </div>

        {/* Totals */}
        <div style={{padding:'12px 18px', background:'var(--fs-ivory)',
                     borderTop:'1px solid var(--fs-line)'}}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:12,
                       color:'var(--fs-ink-500)', marginBottom:4}}>
            <span>Sous-total ({cart.reduce((s,i)=>s+i.qty, 0)} articles)</span>
            <span className="fs-mono">{fmtXAF(subtotal)}</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:12,
                       color:'var(--fs-ink-500)', marginBottom:4}}>
            <span>TVA incluse (19,25%)</span>
            <span className="fs-mono">{fmtXAF(subtotal * 0.1614)}</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:12,
                       color:'var(--fs-ink-500)', marginBottom:10}}>
            <span>Remise</span>
            <span className="fs-mono">— {fmtXAF(discount)}</span>
          </div>

          <div className="fs-gold-rule" style={{marginBottom:10}}/>

          <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between',
                       marginBottom:14}}>
            <span style={{fontFamily:'var(--fs-font-display)', fontSize:18,
                          fontWeight:600, color:'var(--fs-ink-900)'}}>
              TOTAL
            </span>
            <span style={{fontFamily:'var(--fs-font-display)', fontSize:30,
                          fontWeight:700, color:'var(--fs-wine-700)',
                          fontVariantNumeric:'tabular-nums'}}>
              {fmtXAF(total)}
              <span style={{fontSize:13, marginLeft:6, color:'var(--fs-gold-600)',
                            fontFamily:'var(--fs-font-sans)'}}>XAF</span>
            </span>
          </div>

          {/* Payment methods */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8}}>
            <button style={{padding:'10px 4px', background:'var(--fs-paper)',
                            border:'1px solid var(--fs-line-2)', borderRadius:'var(--fs-r-sm)',
                            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                            cursor:'pointer'}}>
              <Icon name="cash" size={18} color="var(--fs-ink-700)"/>
              <span style={{fontSize:10, fontWeight:600, color:'var(--fs-ink-700)'}}>Espèces</span>
            </button>
            <button style={{padding:'10px 4px', background:'var(--fs-paper)',
                            border:'1px solid var(--fs-line-2)', borderRadius:'var(--fs-r-sm)',
                            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                            cursor:'pointer'}}>
              <Icon name="mobile" size={18} color="var(--fs-ink-700)"/>
              <span style={{fontSize:10, fontWeight:600, color:'var(--fs-ink-700)'}}>Mobile M.</span>
            </button>
            <button style={{padding:'10px 4px', background:'var(--fs-paper)',
                            border:'1px solid var(--fs-line-2)', borderRadius:'var(--fs-r-sm)',
                            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                            cursor:'pointer'}}>
              <Icon name="card" size={18} color="var(--fs-ink-700)"/>
              <span style={{fontSize:10, fontWeight:600, color:'var(--fs-ink-700)'}}>Carte</span>
            </button>
          </div>

          <Btn variant="primary" size="xl" icon="check" style={{width:'100%', fontSize:16}}>
            Encaisser {fmtXAF(total)} XAF
          </Btn>

          <div style={{display:'flex', gap:6, marginTop:8}}>
            <Btn variant="ghost" size="sm" icon="pause" style={{flex:1, fontSize:11}}>
              Mettre en attente
            </Btn>
            <Btn variant="ghost" size="sm" icon="x" style={{flex:1, fontSize:11, color:'var(--fs-danger-700)'}}>
              Annuler le ticket
            </Btn>
          </div>
        </div>
      </aside>
    </div>
  );
}

window.CaisseScreen = CaisseScreen;
