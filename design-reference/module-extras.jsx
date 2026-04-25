// Écrans additionnels — flux de paiement, ticket, réception, login, gestion personnel, rapport

// ═══════════════════════════════════════════════════════════════════
// CAISSE · Écran de paiement Mobile Money (modal sur la caisse)
// ═══════════════════════════════════════════════════════════════════
function MobileMoneyPaymentScreen() {
  const total = 47550;
  return (
    <div className="fs-app" style={{width:'100%', height:'100%', position:'relative',
                                     background:'rgba(31,26,26,0.55)', display:'flex',
                                     alignItems:'center', justifyContent:'center'}}>
      {/* Faded backdrop showing the cart underneath */}
      <div style={{position:'absolute', inset:0, background:'var(--fs-ivory)',
                   backgroundImage:'repeating-linear-gradient(45deg, transparent 0 12px, rgba(122,29,46,0.02) 12px 13px)',
                   opacity:0.4}}/>

      <div style={{position:'relative', width:560, background:'var(--fs-paper)',
                   borderRadius:'var(--fs-r-lg)', boxShadow:'var(--fs-shadow-lg)',
                   overflow:'hidden', border:'1px solid var(--fs-line)'}}>
        {/* Wine header */}
        <div style={{background:'linear-gradient(135deg, var(--fs-wine-800), var(--fs-wine-700))',
                     color:'#fff', padding:'18px 24px',
                     display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:11, color:'var(--fs-gold-300)', letterSpacing:'0.1em',
                         fontWeight:600}}>PAIEMENT MOBILE MONEY</div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:22, fontWeight:600,
                         marginTop:4}}>Ticket #TK-24-000847</div>
          </div>
          <IconBtn icon="x" size={36} tone="ghost" style={{color:'#fff', borderColor:'rgba(255,255,255,0.2)'}}/>
        </div>

        {/* Amount */}
        <div style={{padding:'24px 24px 20px', textAlign:'center',
                     background:'var(--fs-ivory)', borderBottom:'1px solid var(--fs-line)'}}>
          <div style={{fontSize:11, color:'var(--fs-ink-500)', letterSpacing:'0.08em',
                       fontWeight:600, marginBottom:4}}>MONTANT À PAYER</div>
          <div style={{fontFamily:'var(--fs-font-display)', fontSize:48, fontWeight:700,
                       color:'var(--fs-wine-700)', fontVariantNumeric:'tabular-nums',
                       letterSpacing:'-0.02em'}}>
            {fmtXAF(total)}
            <span style={{fontSize:18, color:'var(--fs-gold-600)', marginLeft:8,
                          fontFamily:'var(--fs-font-sans)'}}>XAF</span>
          </div>
        </div>

        {/* Operator selection */}
        <div style={{padding:'18px 24px'}}>
          <div style={{fontSize:11, color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                       fontWeight:600, marginBottom:10, textTransform:'uppercase'}}>
            1 · Opérateur
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:18}}>
            {[
              { name:'Orange Money', short:'OM', color:'#FF7900' },
              { name:'MTN MoMo', short:'MTN', color:'#FFCC00', selected:true },
              { name:'Wave', short:'Wave', color:'#1E76FF' },
            ].map(op => (
              <button key={op.short} style={{
                padding:'14px 8px', borderRadius:'var(--fs-r-sm)',
                background: op.selected ? 'var(--fs-paper)' : 'var(--fs-paper)',
                border: op.selected ? `2px solid ${op.color}` : '1px solid var(--fs-line-2)',
                display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer',
              }}>
                <div style={{width:36, height:36, borderRadius:8, background:op.color,
                             color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                             fontSize:11, fontWeight:700, letterSpacing:'0.04em'}}>
                  {op.short}
                </div>
                <span style={{fontSize:11, fontWeight:600, color:'var(--fs-ink-900)'}}>{op.name}</span>
              </button>
            ))}
          </div>

          <div style={{fontSize:11, color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                       fontWeight:600, marginBottom:10, textTransform:'uppercase'}}>
            2 · Numéro de téléphone
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:6}}>
            <div style={{padding:'12px 14px', background:'var(--fs-ivory)',
                         border:'1px solid var(--fs-line-2)', borderRadius:'var(--fs-r-sm)',
                         fontSize:14, fontWeight:600, color:'var(--fs-ink-700)',
                         display:'flex', alignItems:'center', gap:8}}>
              <Icon name="phone" size={14}/>
              +237
            </div>
            <div style={{flex:1, padding:'12px 14px', background:'var(--fs-ivory)',
                         border:'2px solid var(--fs-gold-400)', borderRadius:'var(--fs-r-sm)',
                         fontFamily:'var(--fs-font-mono)', fontSize:18, fontWeight:600,
                         color:'var(--fs-ink-900)', letterSpacing:'0.08em'}}>
              6 78 45 12 90<span style={{borderRight:'2px solid var(--fs-wine-700)',
                                          marginLeft:4, animation:'blink 1s infinite'}}>&nbsp;</span>
            </div>
          </div>
          <div style={{fontSize:11, color:'var(--fs-ink-500)', marginBottom:18}}>
            Le client recevra une demande sur son téléphone — il devra valider avec son code PIN.
          </div>

          {/* Status / instruction */}
          <div style={{background:'var(--fs-gold-50)', border:'1px solid var(--fs-gold-300)',
                       borderRadius:'var(--fs-r-sm)', padding:'12px 14px',
                       display:'flex', alignItems:'center', gap:12, marginBottom:18}}>
            <div style={{width:32, height:32, borderRadius:'50%', background:'var(--fs-gold-500)',
                         color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                         flexShrink:0}}>
              <Icon name="clock" size={16}/>
            </div>
            <div style={{flex:1, fontSize:12, color:'var(--fs-ink-700)'}}>
              <strong>En attente de validation client</strong> · expire dans 1:42
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{padding:'14px 24px', background:'var(--fs-ivory)',
                     borderTop:'1px solid var(--fs-line)', display:'flex', gap:8}}>
          <Btn variant="secondary" size="lg" style={{flex:1}}>Retour</Btn>
          <Btn variant="primary" size="lg" icon="check" style={{flex:2}}>
            Confirmer la transaction
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CAISSE · Ticket / Reçu imprimé (vue thermique 80mm)
// ═══════════════════════════════════════════════════════════════════
function TicketReceipt() {
  const items = [
    { n: 'Huile karité 250ml', q: 2, p: 3500 },
    { n: 'Beurre cacao 100g', q: 1, p: 2800 },
    { n: 'Jus bissap 1L', q: 3, p: 1800 },
    { n: 'Miel de baobab', q: 1, p: 7800 },
  ];
  const total = items.reduce((s,i) => s + i.q*i.p, 0);
  return (
    <div className="fs-app" style={{width:'100%', height:'100%', display:'flex',
                                     alignItems:'center', justifyContent:'center',
                                     background:'#1f1a1a', padding:30}}>
      <div style={{width:340, background:'#fff', padding:'24px 22px',
                   fontFamily:'"JetBrains Mono", ui-monospace, monospace', fontSize:11,
                   color:'#1f1a1a',
                   boxShadow:'0 30px 60px rgba(0,0,0,0.4)',
                   backgroundImage:'repeating-linear-gradient(180deg, transparent 0 22px, rgba(0,0,0,0.015) 22px 23px)',
                   position:'relative'}}>
        {/* Notched top edge */}
        <div style={{position:'absolute', top:-1, left:0, right:0, height:8,
                     backgroundImage:'linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%), linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%)',
                     backgroundSize:'12px 12px', backgroundPosition:'0 0, 6px 6px',
                     backgroundColor:'#1f1a1a'}}/>

        {/* Header */}
        <div style={{textAlign:'center', borderBottom:'1px dashed #1f1a1a', paddingBottom:14, marginBottom:14}}>
          <div style={{fontFamily:'"Cormorant Garamond", serif', fontSize:22, fontWeight:700,
                       letterSpacing:'0.06em', color:'#7A1D2E'}}>FAMILY STORE</div>
          <div style={{fontFamily:'"Cormorant Garamond", serif', fontStyle:'italic',
                       fontSize:11, color:'#8A6329', marginTop:2}}>by RDCT</div>
          <div style={{fontSize:10, marginTop:6, lineHeight:1.5}}>
            Akwa, Boulevard de la Liberté<br/>
            Douala, Cameroun · Tél : 233 42 78 90<br/>
            NIU : M111712345678X · RC/DLA/2023/B/0421
          </div>
        </div>

        {/* Meta */}
        <div style={{fontSize:10, lineHeight:1.7, marginBottom:12}}>
          <Row l="Ticket n°" r="TK-24-000847"/>
          <Row l="Date" r="25/04/2026 14:23"/>
          <Row l="Caissière" r="Aïcha N. (C01)"/>
          <Row l="Mode" r="Mobile Money · MTN"/>
        </div>

        <div style={{borderTop:'1px dashed #1f1a1a', borderBottom:'1px dashed #1f1a1a',
                     padding:'10px 0', marginBottom:10}}>
          {items.map((it, i) => (
            <div key={i} style={{marginBottom:6}}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{fontWeight:600}}>{it.n}</span>
                <span style={{fontWeight:600}}>{fmtXAF(it.q*it.p)}</span>
              </div>
              <div style={{fontSize:9, color:'#6B5F5C'}}>
                {it.q} × {fmtXAF(it.p)}
              </div>
            </div>
          ))}
        </div>

        <div style={{marginBottom:10}}>
          <Row l="Sous-total HT" r={fmtXAF(total*0.84)}/>
          <Row l="TVA 19,25 %" r={fmtXAF(total*0.16)}/>
          <Row l="Remise" r="— 0"/>
        </div>

        <div style={{borderTop:'2px solid #1f1a1a', borderBottom:'2px solid #1f1a1a',
                     padding:'10px 0', marginBottom:14,
                     display:'flex', justifyContent:'space-between',
                     fontFamily:'"Cormorant Garamond", serif',
                     fontSize:18, fontWeight:700}}>
          <span>TOTAL</span>
          <span>{fmtXAF(total)} XAF</span>
        </div>

        <div style={{fontSize:10, lineHeight:1.6, marginBottom:14}}>
          <Row l="Reçu Mobile" r="MTN-58463921"/>
          <Row l="Tél. client" r="+237 6 78 45 12 90"/>
        </div>

        {/* Barcode */}
        <div style={{textAlign:'center', marginBottom:10}}>
          <svg width="200" height="40" viewBox="0 0 200 40">
            {Array.from({length:48}).map((_,i) => (
              <rect key={i} x={i*4} y="0" width={Math.random()>0.5?2:1} height="40" fill="#1f1a1a"/>
            ))}
          </svg>
          <div style={{fontSize:9, letterSpacing:'0.2em', marginTop:2}}>TK24000847</div>
        </div>

        <div style={{textAlign:'center', fontSize:10, fontStyle:'italic',
                     fontFamily:'"Cormorant Garamond", serif',
                     borderTop:'1px dashed #1f1a1a', paddingTop:12,
                     color:'#7A1D2E'}}>
          Beauté · Saveurs · Bien-être<br/>
          Merci de votre visite — à bientôt !
        </div>
      </div>
    </div>
  );
}
function Row({l,r}) {
  return <div style={{display:'flex', justifyContent:'space-between'}}>
    <span>{l}</span><span>{r}</span></div>;
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN / Verrouillage caisse — clavier numérique
// ═══════════════════════════════════════════════════════════════════
function LoginScreen() {
  const pin = ['•','•','•','','','',''];
  const filled = 3;
  const dots = Array.from({length:6});
  return (
    <div className="fs-app" style={{width:'100%', height:'100%', display:'flex',
                                     background:'linear-gradient(135deg, var(--fs-wine-900) 0%, var(--fs-wine-700) 100%)',
                                     position:'relative', overflow:'hidden'}}>
      {/* Decorative gold ornament */}
      <svg style={{position:'absolute', top:-100, right:-100, width:500, height:500, opacity:0.06}}
           viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#B8893E" strokeWidth="0.3"/>
        <circle cx="50" cy="50" r="30" fill="none" stroke="#B8893E" strokeWidth="0.3"/>
        <circle cx="50" cy="50" r="20" fill="none" stroke="#B8893E" strokeWidth="0.3"/>
      </svg>

      {/* Left: brand */}
      <div style={{flex:1.2, display:'flex', flexDirection:'column', justifyContent:'center',
                   padding:'0 80px', color:'#fff', position:'relative'}}>
        <Logo variant="mark" size={68} style={{marginBottom:30}}/>
        <div style={{fontFamily:'var(--fs-font-display)', fontSize:54, fontWeight:600,
                     lineHeight:1.05, color:'#fff', marginBottom:8, letterSpacing:'-0.01em'}}>
          Family Store
        </div>
        <div style={{fontFamily:'var(--fs-font-display)', fontStyle:'italic', fontSize:20,
                     color:'var(--fs-gold-300)', letterSpacing:'0.06em', marginBottom:24}}>
          by RDCT — Beauté · Saveurs · Bien-être
        </div>
        <div className="fs-gold-rule" style={{maxWidth:200, marginBottom:24}}/>
        <div style={{fontSize:14, color:'rgba(255,255,255,0.75)', maxWidth:380, lineHeight:1.6}}>
          Espace de caisse · Akwa, Douala<br/>
          Sam. 25 avril 2026 — 08:14
        </div>
        <div style={{position:'absolute', bottom:30, fontSize:11, color:'var(--fs-gold-300)',
                     letterSpacing:'0.1em', fontWeight:600}}>
          VERSION 2.4.1 · CAISSE 01
        </div>
      </div>

      {/* Right: PIN keypad */}
      <div style={{flex:1, background:'var(--fs-ivory)', display:'flex',
                   flexDirection:'column', alignItems:'center', justifyContent:'center',
                   padding:40, position:'relative'}}>
        <div style={{width:90, height:90, borderRadius:'50%', background:'var(--fs-wine-700)',
                     color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                     fontSize:32, fontWeight:700, fontFamily:'var(--fs-font-display)',
                     boxShadow:'0 8px 24px rgba(122,29,46,0.3)', marginBottom:14}}>
          AN
        </div>
        <div style={{fontFamily:'var(--fs-font-display)', fontSize:24, fontWeight:600,
                     color:'var(--fs-ink-900)'}}>Aïcha Nguemo</div>
        <div style={{fontSize:13, color:'var(--fs-ink-500)', marginBottom:30}}>
          Caissière · Caisse 01
        </div>

        <div style={{fontSize:11, color:'var(--fs-ink-500)', letterSpacing:'0.1em',
                     fontWeight:600, marginBottom:14}}>
          ENTREZ VOTRE CODE PIN
        </div>
        <div style={{display:'flex', gap:12, marginBottom:36}}>
          {dots.map((_,i) => (
            <div key={i} style={{width:14, height:14, borderRadius:'50%',
                                  background: i < filled ? 'var(--fs-wine-700)' : 'transparent',
                                  border:'2px solid var(--fs-wine-700)',
                                  transition:'background 0.15s'}}/>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 76px)', gap:12, marginBottom:18}}>
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n,i) => (
            n === '' ? <div key={i}/> :
            <button key={i} style={{
              width:76, height:76, borderRadius:'50%',
              background: n==='⌫' ? 'transparent' : 'var(--fs-paper)',
              border: n==='⌫' ? 'none' : '1px solid var(--fs-line-2)',
              fontSize: n==='⌫' ? 22 : 24, fontWeight:600,
              fontFamily:'var(--fs-font-display)',
              color:'var(--fs-ink-900)',
              cursor:'pointer', boxShadow: n==='⌫' ? 'none' : 'var(--fs-shadow-sm)',
            }}>{n}</button>
          ))}
        </div>

        <button style={{fontSize:12, color:'var(--fs-wine-700)', background:'none',
                        border:'none', cursor:'pointer', fontWeight:600,
                        textDecoration:'underline', textUnderlineOffset:3}}>
          Changer d'utilisateur
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STOCK · Réception fournisseur
// ═══════════════════════════════════════════════════════════════════
function StockReceptionScreen() {
  const lines = [
    { sku:'8901030895548', name:'Huile de karité brute 250ml',  expected:50, received:50, status:'ok',    cost:2100 },
    { sku:'7622210992086', name:'Savon noir du Cameroun 200g',  expected:120,received:120,status:'ok',    cost:650 },
    { sku:'6111242100478', name:'Beurre de cacao pur 100g',     expected:30, received:28, status:'short', cost:1600 },
    { sku:'8000500310427', name:'Crème hydratante miel 50ml',   expected:24, received:24, status:'ok',    cost:3800 },
    { sku:'3168930010265', name:'Miel de baobab 500g',          expected:20, received:22, status:'over',  cost:4500 },
  ];
  return (
    <div className="fs-app" style={{width:'100%', height:'100%', display:'flex',
                                     background:'var(--fs-ivory)'}}>
      <StockSidebar active="receptions" onNav={()=>{}}/>
      <main style={{flex:1, display:'flex', flexDirection:'column', minWidth:0}}>
        <div style={{height:64, background:'var(--fs-paper)',
                     borderBottom:'1px solid var(--fs-line)',
                     display:'flex', alignItems:'center', padding:'0 28px', gap:16}}>
          <button style={{background:'none', border:'1px solid var(--fs-line-2)',
                          width:36, height:36, borderRadius:'var(--fs-r-sm)',
                          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'}}>
            <Icon name="chevronLeft" size={16}/>
          </button>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:'var(--fs-ink-400)', letterSpacing:'0.08em',
                         textTransform:'uppercase', fontWeight:600}}>
              Réceptions · Bon de livraison
            </div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:24, fontWeight:600,
                         marginTop:2}}>
              BL-2026-0142 · Coopérative Bamenda
            </div>
          </div>
          <Badge tone="warning">EN COURS DE CONTRÔLE</Badge>
          <Btn variant="secondary" size="md" icon="print">Imprimer BL</Btn>
          <Btn variant="primary" size="md" icon="check">Valider la réception</Btn>
        </div>

        <div style={{flex:1, display:'flex', gap:16, padding:'18px 28px', minHeight:0}}>
          <div style={{flex:1, display:'flex', flexDirection:'column', gap:14, minWidth:0}}>
            {/* Supplier card */}
            <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                         borderRadius:'var(--fs-r-md)', padding:18,
                         display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:18}}>
              <div>
                <div style={{fontSize:10, color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                             fontWeight:600, marginBottom:4}}>FOURNISSEUR</div>
                <div style={{fontFamily:'var(--fs-font-display)', fontSize:18, fontWeight:600,
                             color:'var(--fs-wine-700)'}}>Coopérative Bamenda</div>
                <div style={{fontSize:11, color:'var(--fs-ink-500)', marginTop:2}}>
                  Mme Solange Tcham · +237 6 78 45 12 90<br/>
                  Bamenda · Province Nord-Ouest
                </div>
              </div>
              <Field label="N° BL" value="BL-2026-0142"/>
              <Field label="Réceptionné le" value="25 avr. 2026 · 09:42"/>
              <Field label="Par" value="Samuel Onana"/>
            </div>

            {/* Lines */}
            <div style={{flex:1, background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                         borderRadius:'var(--fs-r-md)', overflow:'hidden',
                         display:'flex', flexDirection:'column'}}>
              <div style={{padding:'12px 18px', borderBottom:'1px solid var(--fs-line)',
                           display:'flex', alignItems:'center'}}>
                <div style={{flex:1}}>
                  <span style={{fontFamily:'var(--fs-font-display)', fontSize:16, fontWeight:600}}>
                    Lignes du bon de livraison
                  </span>
                  <span style={{fontSize:11, color:'var(--fs-ink-500)', marginLeft:8}}>
                    5 références · 244 unités attendues
                  </span>
                </div>
                <Btn variant="ghost" size="sm" icon="scan">Scanner</Btn>
                <Btn variant="ghost" size="sm" icon="plus">Ajouter ligne</Btn>
              </div>
              <div style={{flex:1, overflow:'auto'}} className="fs-scroll">
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                  <thead>
                    <tr style={{background:'var(--fs-ivory)'}}>
                      {['Produit','SKU','Lot','DLU','Attendu','Reçu','Écart','Coût u.','Total'].map(h => (
                        <th key={h} style={{textAlign:['Attendu','Reçu','Écart','Coût u.','Total'].includes(h)?'right':'left',
                                            padding:'10px 14px', fontSize:10, color:'var(--fs-ink-500)',
                                            letterSpacing:'0.06em', fontWeight:600, textTransform:'uppercase'}}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(l => {
                      const diff = l.received - l.expected;
                      return (
                        <tr key={l.sku} style={{borderTop:'1px solid var(--fs-line)'}}>
                          <td style={{padding:'12px 14px', fontWeight:600}}>{l.name}</td>
                          <td style={{padding:'12px 14px', fontFamily:'var(--fs-font-mono)',
                                      fontSize:10, color:'var(--fs-ink-500)'}}>{l.sku.slice(-6)}</td>
                          <td style={{padding:'12px 14px', fontFamily:'var(--fs-font-mono)'}}>L26-0142</td>
                          <td style={{padding:'12px 14px', fontFamily:'var(--fs-font-mono)',
                                      color:'var(--fs-ink-500)'}}>2027-03</td>
                          <td style={{padding:'12px 14px', textAlign:'right',
                                      fontFamily:'var(--fs-font-mono)'}}>{l.expected}</td>
                          <td style={{padding:'12px 14px', textAlign:'right'}}>
                            <input value={l.received} readOnly style={{
                              width:60, padding:'4px 8px', textAlign:'right',
                              fontFamily:'var(--fs-font-mono)', fontWeight:600,
                              border:`1px solid ${l.status==='ok'?'var(--fs-line-2)':l.status==='short'?'var(--fs-danger-500)':'var(--fs-warning-500)'}`,
                              borderRadius:'var(--fs-r-xs)',
                              background: l.status==='ok'?'var(--fs-paper)':l.status==='short'?'var(--fs-danger-100)':'var(--fs-warning-100)',
                              color:'var(--fs-ink-900)',
                            }}/>
                          </td>
                          <td style={{padding:'12px 14px', textAlign:'right'}}>
                            {diff !== 0 && (
                              <Badge tone={diff < 0 ? 'danger' : 'warning'}>
                                {diff > 0 ? '+' : ''}{diff}
                              </Badge>
                            )}
                            {diff === 0 && <Icon name="check" size={14} color="var(--fs-success-500)"/>}
                          </td>
                          <td style={{padding:'12px 14px', textAlign:'right',
                                      fontFamily:'var(--fs-font-mono)', color:'var(--fs-ink-500)'}}>
                            {fmtXAF(l.cost)}
                          </td>
                          <td style={{padding:'12px 14px', textAlign:'right',
                                      fontFamily:'var(--fs-font-mono)', fontWeight:700}}>
                            {fmtXAF(l.cost * l.received)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{padding:'14px 18px', background:'var(--fs-ivory)',
                           borderTop:'1px solid var(--fs-line)',
                           display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{fontSize:12, color:'var(--fs-ink-500)'}}>
                  244 unités attendues · 244 reçues · 2 écarts détectés
                </div>
                <div style={{fontFamily:'var(--fs-font-display)', fontSize:22, fontWeight:700,
                             color:'var(--fs-wine-700)'}}>
                  Total : {fmtXAF(lines.reduce((s,l)=>s+l.cost*l.received, 0))} XAF
                </div>
              </div>
            </div>
          </div>

          {/* Side panel — anomalies */}
          <aside style={{width:300, display:'flex', flexDirection:'column', gap:12}}>
            <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                         borderRadius:'var(--fs-r-md)', padding:'14px 18px'}}>
              <div style={{fontFamily:'var(--fs-font-display)', fontSize:15, fontWeight:600,
                           marginBottom:8}}>Synthèse</div>
              <div style={{display:'flex', flexDirection:'column', gap:8, fontSize:12}}>
                <SumRow l="Lignes conformes" v="3 / 5" tone="success"/>
                <SumRow l="Manquants" v="2 unités" tone="danger"/>
                <SumRow l="Surplus" v="2 unités" tone="warning"/>
                <SumRow l="Valeur réception" v="365 200 XAF" tone="neutral"/>
              </div>
            </div>

            <div style={{background:'var(--fs-danger-100)', border:'1px solid var(--fs-danger-500)',
                         borderRadius:'var(--fs-r-md)', padding:'12px 14px'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                <Icon name="alert" size={16} color="var(--fs-danger-700)"/>
                <span style={{fontSize:12, fontWeight:700, color:'var(--fs-danger-700)',
                              letterSpacing:'0.04em'}}>2 ANOMALIES DÉTECTÉES</span>
              </div>
              <div style={{fontSize:11, color:'var(--fs-danger-700)', lineHeight:1.5}}>
                <strong>Beurre de cacao :</strong> 2 unités manquantes (28/30)<br/>
                <strong>Miel de baobab :</strong> 2 unités en plus (22/20)
              </div>
              <button style={{marginTop:10, fontSize:11, color:'var(--fs-danger-700)',
                              background:'transparent', border:'1px solid var(--fs-danger-500)',
                              padding:'5px 10px', borderRadius:'var(--fs-r-xs)',
                              fontWeight:600, cursor:'pointer'}}>
                Signaler au fournisseur
              </button>
            </div>

            <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                         borderRadius:'var(--fs-r-md)', padding:'14px 18px'}}>
              <div style={{fontFamily:'var(--fs-font-display)', fontSize:15, fontWeight:600,
                           marginBottom:8}}>Notes du réceptionniste</div>
              <div style={{fontSize:11, color:'var(--fs-ink-700)', lineHeight:1.6,
                           background:'var(--fs-ivory)', padding:'10px 12px',
                           borderRadius:'var(--fs-r-sm)', border:'1px solid var(--fs-line)'}}>
                Carton n°3 légèrement abîmé à la livraison — contenu intact, pas de
                produit endommagé. Photo prise et jointe au BL.
              </div>
              <button style={{marginTop:8, fontSize:11, color:'var(--fs-wine-700)',
                              background:'transparent', border:'none', cursor:'pointer',
                              fontWeight:600}}>+ Ajouter une note</button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
function Field({label, value}) {
  return (
    <div>
      <div style={{fontSize:10, color:'var(--fs-ink-500)', letterSpacing:'0.06em',
                   fontWeight:600, marginBottom:3}}>{label.toUpperCase()}</div>
      <div style={{fontSize:13, fontWeight:600, color:'var(--fs-ink-900)'}}>{value}</div>
    </div>
  );
}
function SumRow({l, v, tone}) {
  const colors = { success:'var(--fs-success-700)', danger:'var(--fs-danger-700)',
                   warning:'var(--fs-warning-700)', neutral:'var(--fs-ink-900)' };
  return <div style={{display:'flex', justifyContent:'space-between'}}>
    <span style={{color:'var(--fs-ink-500)'}}>{l}</span>
    <span style={{fontWeight:700, color:colors[tone], fontFamily:'var(--fs-font-mono)'}}>{v}</span>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN · Gestion personnel — création caissier
// ═══════════════════════════════════════════════════════════════════
function StaffManagementScreen() {
  return (
    <div className="fs-app" style={{width:'100%', height:'100%', display:'flex',
                                     background:'var(--fs-ivory)'}}>
      <AdminSidebar active="caissiers" onNav={()=>{}}/>
      <main style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden'}}>
        <div style={{height:64, background:'var(--fs-paper)',
                     borderBottom:'1px solid var(--fs-line)',
                     display:'flex', alignItems:'center', padding:'0 28px', gap:16}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:'var(--fs-ink-400)', letterSpacing:'0.08em',
                         textTransform:'uppercase', fontWeight:600}}>
              Personnel · Caissiers et gestionnaires
            </div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:24, fontWeight:600,
                         marginTop:2}}>
              Équipe Family Store · 12 collaborateurs
            </div>
          </div>
          <Btn variant="secondary" size="md" icon="filter">Filtrer</Btn>
          <Btn variant="primary" size="md" icon="plus">Ajouter un collaborateur</Btn>
        </div>

        <div style={{flex:1, display:'flex', overflow:'hidden'}}>
          {/* List */}
          <div style={{flex:1, padding:'18px 28px', overflow:'auto', minWidth:0}} className="fs-scroll">
            <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
              {[
                { name:'Aïcha Nguemo', role:'Caissière senior', dept:'Caisse', station:'C01',
                  hired:'12 mars 2024', sales30:1284, status:'active', sel:true, init:'AN', color:'var(--fs-wine-700)',
                  perms:['Caisse','Remises ≤ 10%','Annulation ticket'] },
                { name:'Marie Tchapda', role:'Caissière', dept:'Caisse', station:'C02',
                  hired:'08 sep. 2024', sales30:892, status:'active', init:'MT', color:'var(--fs-gold-600)',
                  perms:['Caisse','Annulation ticket'] },
                { name:'Samuel Onana', role:'Gestionnaire stock', dept:'Stock', station:'Dépôt',
                  hired:'03 nov. 2023', sales30:0, status:'active', init:'SO', color:'var(--fs-info-500)',
                  perms:['Stock','Réceptions','Inventaire','Fournisseurs'] },
                { name:'Jean Domkam', role:'Caissier', dept:'Caisse', station:'C03',
                  hired:'15 jan. 2026', sales30:421, status:'pause', init:'JD', color:'var(--fs-success-500)',
                  perms:['Caisse'] },
                { name:'Fatou Kouassi', role:'Caissière', dept:'Caisse', station:'—',
                  hired:'22 fév. 2025', sales30:678, status:'off', init:'FK', color:'#8C7F7B',
                  perms:['Caisse','Remises ≤ 5%'] },
                { name:'Patrick Mbarga', role:'Responsable rayons', dept:'Stock', station:'Dépôt',
                  hired:'14 juil. 2024', sales30:0, status:'active', init:'PM', color:'#6B5F5C',
                  perms:['Stock','Étiquetage'] },
              ].map((p, i) => (
                <button key={i} style={{
                  background: p.sel ? 'var(--fs-paper)' : 'var(--fs-paper)',
                  border: p.sel ? '2px solid var(--fs-wine-700)' : '1px solid var(--fs-line)',
                  borderRadius:'var(--fs-r-md)', padding:'14px 16px', cursor:'pointer',
                  textAlign:'left', display:'flex', flexDirection:'column', gap:8,
                  boxShadow: p.sel ? 'var(--fs-shadow-md)' : 'var(--fs-shadow-sm)',
                }}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div style={{position:'relative'}}>
                      <div style={{width:42, height:42, borderRadius:'50%', background:p.color,
                                    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                                    fontSize:14, fontWeight:700, fontFamily:'var(--fs-font-display)'}}>
                        {p.init}
                      </div>
                      <div style={{position:'absolute', bottom:-1, right:-1, width:12, height:12,
                                    borderRadius:'50%', border:'2px solid var(--fs-paper)',
                                    background: p.status==='active'?'var(--fs-success-500)':p.status==='pause'?'var(--fs-warning-500)':'var(--fs-ink-300)'}}/>
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'var(--fs-ink-900)'}}>{p.name}</div>
                      <div style={{fontSize:11, color:'var(--fs-ink-500)'}}>{p.role}</div>
                    </div>
                    <Badge tone={p.dept==='Caisse'?'wine':p.dept==='Stock'?'gold':'neutral'}>{p.dept}</Badge>
                  </div>
                  <div style={{display:'flex', gap:14, fontSize:11, color:'var(--fs-ink-500)'}}>
                    <span>📅 {p.hired}</span>
                    <span>📍 {p.station}</span>
                    {p.sales30 > 0 && <span style={{color:'var(--fs-wine-700)', fontWeight:600}}>
                      {p.sales30} ventes / 30j</span>}
                  </div>
                  <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                    {p.perms.map(perm => (
                      <span key={perm} style={{fontSize:10, padding:'2px 7px',
                                              background:'var(--fs-ivory)',
                                              border:'1px solid var(--fs-line)',
                                              borderRadius:'var(--fs-r-xs)',
                                              color:'var(--fs-ink-700)', fontWeight:500}}>
                        {perm}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right side: New cashier form */}
          <aside style={{width:380, background:'var(--fs-paper)',
                         borderLeft:'1px solid var(--fs-line)',
                         display:'flex', flexDirection:'column', overflow:'hidden'}}>
            <div style={{padding:'18px 22px', borderBottom:'1px solid var(--fs-line)',
                         background:'var(--fs-wine-50)'}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Icon name="plus" size={16} color="var(--fs-wine-700)"/>
                <span style={{fontSize:11, fontWeight:700, color:'var(--fs-wine-700)',
                              letterSpacing:'0.08em'}}>NOUVEAU COLLABORATEUR</span>
              </div>
              <div style={{fontFamily:'var(--fs-font-display)', fontSize:19, fontWeight:600,
                           marginTop:6}}>Créer un compte caissier</div>
            </div>
            <div style={{flex:1, overflow:'auto', padding:'18px 22px'}} className="fs-scroll">
              <FormSection title="Identité">
                <FormRow label="Prénom" value="Esther" placeholder="Prénom"/>
                <FormRow label="Nom" value="Bidias" placeholder="Nom"/>
                <FormRow label="Téléphone" value="+237 6 91 23 45 67" mono/>
                <FormRow label="Email" value="esther.b@familystore.cm" mono/>
              </FormSection>
              <FormSection title="Poste">
                <FormSelect label="Rôle" value="Caissière"/>
                <FormSelect label="Département" value="Caisse"/>
                <FormSelect label="Caisse assignée" value="Caisse 04 (nouvelle)"/>
                <FormRow label="Date d'embauche" value="25/04/2026" mono/>
              </FormSection>
              <FormSection title="Sécurité">
                <FormRow label="Code PIN (4 chiffres)" value="••••" mono/>
                <FormRow label="Identifiant" value="esther.b" mono/>
                <div style={{display:'flex', flexDirection:'column', gap:6, marginTop:4}}>
                  <PermToggle label="Caisse · Encaissement" on/>
                  <PermToggle label="Annulation de ticket" on/>
                  <PermToggle label="Accorder remise (≤ 5 %)" on/>
                  <PermToggle label="Accorder remise (≤ 10 %)"/>
                  <PermToggle label="Fermeture de caisse / Z"/>
                </div>
              </FormSection>
            </div>
            <div style={{padding:14, borderTop:'1px solid var(--fs-line)',
                         background:'var(--fs-ivory)', display:'flex', gap:8}}>
              <Btn variant="secondary" size="md" style={{flex:1}}>Annuler</Btn>
              <Btn variant="primary" size="md" icon="check" style={{flex:2}}>
                Créer le compte
              </Btn>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
function FormSection({title, children}) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:10, color:'var(--fs-ink-400)', letterSpacing:'0.1em',
                   fontWeight:700, marginBottom:10, textTransform:'uppercase'}}>{title}</div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>{children}</div>
    </div>
  );
}
function FormRow({label, value, mono, placeholder}) {
  return (
    <div>
      <div style={{fontSize:10, color:'var(--fs-ink-500)', marginBottom:4, fontWeight:600}}>
        {label}
      </div>
      <input value={value} placeholder={placeholder} readOnly style={{
        width:'100%', padding:'8px 10px', fontSize:13,
        fontFamily: mono ? 'var(--fs-font-mono)' : 'var(--fs-font-sans)',
        border:'1px solid var(--fs-line-2)', borderRadius:'var(--fs-r-sm)',
        background:'var(--fs-paper)', color:'var(--fs-ink-900)', fontWeight:500,
        outline:'none',
      }}/>
    </div>
  );
}
function FormSelect({label, value}) {
  return (
    <div>
      <div style={{fontSize:10, color:'var(--fs-ink-500)', marginBottom:4, fontWeight:600}}>
        {label}
      </div>
      <div style={{display:'flex', alignItems:'center', padding:'8px 10px', fontSize:13,
                   border:'1px solid var(--fs-line-2)', borderRadius:'var(--fs-r-sm)',
                   background:'var(--fs-paper)', color:'var(--fs-ink-900)', fontWeight:500}}>
        <span style={{flex:1}}>{value}</span>
        <Icon name="chevronDown" size={14} color="var(--fs-ink-500)"/>
      </div>
    </div>
  );
}
function PermToggle({label, on}) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:10,
                 padding:'7px 10px', borderRadius:'var(--fs-r-xs)',
                 background:'var(--fs-ivory)', border:'1px solid var(--fs-line)'}}>
      <div style={{width:30, height:18, background: on?'var(--fs-wine-700)':'var(--fs-line-2)',
                   borderRadius:9, position:'relative', transition:'background 0.15s', flexShrink:0}}>
        <div style={{position:'absolute', top:2, left: on?14:2, width:14, height:14,
                     background:'#fff', borderRadius:'50%', transition:'left 0.15s',
                     boxShadow:'0 1px 2px rgba(0,0,0,0.2)'}}/>
      </div>
      <span style={{fontSize:12, color: on?'var(--fs-ink-900)':'var(--fs-ink-500)',
                    fontWeight: on?600:500}}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN · Rapport mensuel détaillé
// ═══════════════════════════════════════════════════════════════════
function MonthlyReportScreen() {
  // 30 days simulated bars
  const days = Array.from({length:30}, (_,i) => ({
    d: i+1,
    v: 350000 + Math.sin(i*0.4)*120000 + Math.random()*180000 + (i>20?80000:0),
  }));
  const max = Math.max(...days.map(d => d.v));
  return (
    <div className="fs-app" style={{width:'100%', height:'100%', display:'flex',
                                     background:'var(--fs-ivory)'}}>
      <AdminSidebar active="rapports" onNav={()=>{}}/>
      <main style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <div style={{height:64, background:'var(--fs-paper)',
                     borderBottom:'1px solid var(--fs-line)',
                     display:'flex', alignItems:'center', padding:'0 28px', gap:16}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:'var(--fs-ink-400)', letterSpacing:'0.08em',
                         textTransform:'uppercase', fontWeight:600}}>
              Rapports & analyses · Mensuel
            </div>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:24, fontWeight:600, marginTop:2}}>
              Rapport mensuel — Avril 2026
            </div>
          </div>
          <div style={{display:'flex', gap:6, background:'var(--fs-ivory)', padding:3,
                       borderRadius:'var(--fs-r-sm)'}}>
            {['Avril','Mars','Février','Janvier'].map((m,i) => (
              <button key={m} style={{
                padding:'5px 12px', fontSize:11, fontWeight:600, border:'none',
                borderRadius:'var(--fs-r-xs)', cursor:'pointer',
                background: i===0?'var(--fs-paper)':'transparent',
                color: i===0?'var(--fs-wine-700)':'var(--fs-ink-500)',
                boxShadow: i===0?'var(--fs-shadow-sm)':'none',
              }}>{m}</button>
            ))}
          </div>
          <Btn variant="secondary" size="md" icon="download">PDF</Btn>
          <Btn variant="primary" size="md" icon="download">Excel</Btn>
        </div>

        <div style={{flex:1, overflow:'auto', padding:'20px 28px'}} className="fs-scroll">
          {/* Hero KPIs */}
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:14, marginBottom:18}}>
            <div style={{background:'linear-gradient(135deg, var(--fs-wine-800), var(--fs-wine-700))',
                         color:'#fff', borderRadius:'var(--fs-r-md)', padding:'24px 28px',
                         position:'relative', overflow:'hidden'}}>
              <div style={{position:'absolute', top:-40, right:-40, width:200, height:200,
                           background:'radial-gradient(circle, var(--fs-gold-500) 0%, transparent 70%)',
                           opacity:0.2}}/>
              <div style={{fontSize:11, color:'var(--fs-gold-300)', letterSpacing:'0.1em',
                           fontWeight:600}}>CHIFFRE D'AFFAIRES · AVRIL 2026</div>
              <div style={{fontFamily:'var(--fs-font-display)', fontSize:54, fontWeight:700,
                           letterSpacing:'-0.02em', marginTop:8, fontVariantNumeric:'tabular-nums'}}>
                14,82M
                <span style={{fontSize:18, color:'var(--fs-gold-300)', marginLeft:10,
                              fontFamily:'var(--fs-font-sans)'}}>XAF</span>
              </div>
              <div style={{display:'flex', gap:24, marginTop:12, fontSize:12, color:'rgba(255,255,255,0.85)'}}>
                <span><strong style={{color:'var(--fs-gold-300)'}}>+18,3 %</strong> vs mars</span>
                <span><strong style={{color:'var(--fs-gold-300)'}}>+24,1 %</strong> vs avril 2025</span>
                <span>Objectif : <strong>14,5M</strong> · 102 %</span>
              </div>
            </div>
            <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                         borderRadius:'var(--fs-r-md)', padding:'18px 22px'}}>
              <div style={{fontSize:11, color:'var(--fs-ink-500)', fontWeight:600,
                           letterSpacing:'0.06em'}}>BÉNÉFICE NET</div>
              <div style={{fontFamily:'var(--fs-font-display)', fontSize:30, fontWeight:700,
                           color:'var(--fs-success-700)', marginTop:6}}>
                5,63M <span style={{fontSize:13, color:'var(--fs-ink-500)',
                                     fontFamily:'var(--fs-font-sans)'}}>XAF</span>
              </div>
              <div style={{fontSize:11, color:'var(--fs-success-700)', fontWeight:600, marginTop:6}}>
                Marge nette : 38,0 %
              </div>
            </div>
            <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                         borderRadius:'var(--fs-r-md)', padding:'18px 22px'}}>
              <div style={{fontSize:11, color:'var(--fs-ink-500)', fontWeight:600,
                           letterSpacing:'0.06em'}}>TICKETS · PANIER MOYEN</div>
              <div style={{fontFamily:'var(--fs-font-display)', fontSize:30, fontWeight:700,
                           color:'var(--fs-ink-900)', marginTop:6}}>
                1 184 <span style={{fontSize:13, color:'var(--fs-gold-600)',
                                    fontFamily:'var(--fs-font-sans)'}}>tickets</span>
              </div>
              <div style={{fontSize:11, color:'var(--fs-ink-500)', fontWeight:600, marginTop:6}}>
                Panier : <strong style={{color:'var(--fs-ink-900)'}}>12 514 XAF</strong>
              </div>
            </div>
          </div>

          {/* Daily chart */}
          <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                       borderRadius:'var(--fs-r-md)', padding:'18px 22px', marginBottom:18}}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between',
                         marginBottom:14}}>
              <div>
                <div style={{fontFamily:'var(--fs-font-display)', fontSize:17, fontWeight:600}}>
                  Ventes journalières · 30 jours
                </div>
                <div style={{fontSize:11, color:'var(--fs-ink-500)', marginTop:2}}>
                  Pic le 18 avril (week-end de Pâques) — 832 K XAF
                </div>
              </div>
              <div style={{fontSize:11, color:'var(--fs-ink-500)'}}>
                Moyenne quotidienne : <strong style={{color:'var(--fs-wine-700)'}}>494 K XAF</strong>
              </div>
            </div>
            <svg viewBox="0 0 1380 200" style={{width:'100%', height:200, display:'block'}}>
              {[0.25,0.5,0.75,1].map((r,i) => (
                <line key={i} x1="40" x2="1380" y1={20 + 160*(1-r)} y2={20 + 160*(1-r)}
                      stroke="var(--fs-line)" strokeWidth="1" strokeDasharray="2 3"/>
              ))}
              {days.map((d,i) => {
                const x = 50 + i*44;
                const h = (d.v/max)*150;
                const isWeekend = (i % 7 === 5 || i % 7 === 6);
                return (
                  <g key={i}>
                    <rect x={x} y={170-h} width="32" height={h}
                          fill={isWeekend?'var(--fs-gold-500)':'var(--fs-wine-700)'}
                          rx="2"/>
                    {(i%5===0 || i===days.length-1) && (
                      <text x={x+16} y="190" textAnchor="middle" fontSize="10"
                            fill="var(--fs-ink-500)" fontFamily="var(--fs-font-mono)">
                        {d.d}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div style={{display:'flex', gap:18, marginTop:8, fontSize:11, color:'var(--fs-ink-500)'}}>
              <span style={{display:'flex', alignItems:'center', gap:6}}>
                <span style={{width:10, height:10, background:'var(--fs-wine-700)', borderRadius:2}}/>
                Jours de semaine
              </span>
              <span style={{display:'flex', alignItems:'center', gap:6}}>
                <span style={{width:10, height:10, background:'var(--fs-gold-500)', borderRadius:2}}/>
                Week-ends
              </span>
            </div>
          </div>

          {/* Three columns: by category, by cashier, by hour */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:18}}>
            <CategoryBreakdown/>
            <CashierLeaderboard/>
            <HourHeatmap/>
          </div>

          {/* P&L summary */}
          <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                       borderRadius:'var(--fs-r-md)', padding:'18px 22px'}}>
            <div style={{fontFamily:'var(--fs-font-display)', fontSize:17, fontWeight:600,
                         marginBottom:14}}>
              Compte de résultat · Avril 2026
            </div>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <tbody>
                {[
                  ['Chiffre d\'affaires HT', 12428000, 'positive'],
                  ['TVA collectée (19,25 %)', 2392000, 'neutral'],
                  ['Total encaissé', 14820000, 'bold'],
                  null,
                  ['— Coût d\'achat des marchandises', -7706000, 'negative'],
                  ['— Salaires et charges', -1480000, 'negative'],
                  ['— Loyer & charges fixes', -650000, 'negative'],
                  ['— Mobile Money & frais bancaires', -148000, 'negative'],
                  null,
                  ['BÉNÉFICE NET', 5634000, 'final'],
                ].map((row, i) => {
                  if (!row) return <tr key={i}><td colSpan="2" style={{height:8}}/></tr>;
                  const [label, val, type] = row;
                  return (
                    <tr key={i} style={{borderBottom: type==='final'?'2px solid var(--fs-wine-700)':type==='bold'?'1px solid var(--fs-line-2)':'1px solid var(--fs-line)'}}>
                      <td style={{padding:'10px 0',
                                  fontWeight: type==='bold'||type==='final'?700:500,
                                  fontSize: type==='final'?15:13,
                                  color: type==='final'?'var(--fs-wine-700)':'var(--fs-ink-900)',
                                  fontFamily: type==='final'?'var(--fs-font-display)':'var(--fs-font-sans)'}}>
                        {label}
                      </td>
                      <td style={{padding:'10px 0', textAlign:'right',
                                  fontFamily:'var(--fs-font-mono)',
                                  fontWeight: type==='bold'||type==='final'?700:500,
                                  fontSize: type==='final'?17:13,
                                  color: type==='negative'?'var(--fs-danger-700)':type==='final'?'var(--fs-success-700)':'var(--fs-ink-900)'}}>
                        {val>0 && type!=='negative' ? '' : ''}{fmtXAF(val)} XAF
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function CategoryBreakdown() {
  const cats = [
    { n:'Beauté', v:5234000, pct:35.3, color:'var(--fs-wine-700)' },
    { n:'Épicerie', v:3876000, pct:26.2, color:'var(--fs-gold-500)' },
    { n:'Hygiène', v:2148000, pct:14.5, color:'var(--fs-info-500)' },
    { n:'Boissons', v:1924000, pct:13.0, color:'var(--fs-success-500)' },
    { n:'Parfumerie', v:986000, pct:6.7, color:'var(--fs-warning-500)' },
    { n:'Autres', v:632000, pct:4.3, color:'var(--fs-ink-400)' },
  ];
  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'18px 20px'}}>
      <div style={{fontFamily:'var(--fs-font-display)', fontSize:16, fontWeight:600, marginBottom:2}}>
        Par catégorie
      </div>
      <div style={{fontSize:11, color:'var(--fs-ink-500)', marginBottom:14}}>
        Répartition du CA mensuel
      </div>
      <div style={{display:'flex', height:10, borderRadius:5, overflow:'hidden', marginBottom:14}}>
        {cats.map((c,i) => (
          <div key={i} style={{width:`${c.pct}%`, background:c.color}}/>
        ))}
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:7}}>
        {cats.map((c,i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
            <span style={{width:10, height:10, background:c.color, borderRadius:2, flexShrink:0}}/>
            <span style={{flex:1, fontWeight:500, color:'var(--fs-ink-700)'}}>{c.n}</span>
            <span style={{fontFamily:'var(--fs-font-mono)', color:'var(--fs-ink-500)', fontSize:11}}>
              {fmtXAF(c.v)}
            </span>
            <span style={{fontFamily:'var(--fs-font-mono)', fontWeight:700,
                          color:'var(--fs-ink-900)', minWidth:38, textAlign:'right'}}>
              {c.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashierLeaderboard() {
  const cashiers = [
    { name:'Aïcha N.', sales:412, ca:5184000, avg:12583, init:'AN', color:'var(--fs-wine-700)' },
    { name:'Marie T.', sales:298, ca:3712000, avg:12456, init:'MT', color:'var(--fs-gold-600)' },
    { name:'Jean D.', sales:241, ca:2986000, avg:12390, init:'JD', color:'var(--fs-success-500)' },
    { name:'Fatou K.', sales:233, ca:2938000, avg:12609, init:'FK', color:'var(--fs-info-500)' },
  ];
  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'18px 20px'}}>
      <div style={{fontFamily:'var(--fs-font-display)', fontSize:16, fontWeight:600, marginBottom:2}}>
        Classement caissiers
      </div>
      <div style={{fontSize:11, color:'var(--fs-ink-500)', marginBottom:14}}>
        Performance individuelle · CA généré
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {cashiers.map((c,i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:10,
                                padding:'8px 10px', borderRadius:'var(--fs-r-sm)',
                                background: i===0?'var(--fs-gold-50)':'transparent',
                                border: i===0?'1px solid var(--fs-gold-300)':'1px solid transparent'}}>
            <div style={{width:24, fontSize:14, fontWeight:700,
                         color: i===0?'var(--fs-gold-700)':'var(--fs-ink-400)',
                         fontFamily:'var(--fs-font-display)'}}>
              {i+1}
            </div>
            <div style={{width:32, height:32, borderRadius:'50%', background:c.color,
                         color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                         fontSize:11, fontWeight:700, fontFamily:'var(--fs-font-display)'}}>
              {c.init}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600}}>{c.name}</div>
              <div style={{fontSize:10, color:'var(--fs-ink-500)', fontFamily:'var(--fs-font-mono)'}}>
                {c.sales} ventes · panier {fmtXAF(c.avg)}
              </div>
            </div>
            <div style={{fontFamily:'var(--fs-font-mono)', fontWeight:700, fontSize:12,
                         color:'var(--fs-wine-700)'}}>
              {fmtXAF(c.ca)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourHeatmap() {
  return (
    <div style={{background:'var(--fs-paper)', border:'1px solid var(--fs-line)',
                 borderRadius:'var(--fs-r-md)', padding:'18px 20px'}}>
      <div style={{fontFamily:'var(--fs-font-display)', fontSize:16, fontWeight:600, marginBottom:2}}>
        Affluence horaire
      </div>
      <div style={{fontSize:11, color:'var(--fs-ink-500)', marginBottom:14}}>
        Pic d'affluence : 11h–13h et 17h–19h
      </div>
      <div style={{display:'grid', gridTemplateColumns:'auto repeat(12, 1fr)', gap:2,
                   fontSize:9, fontFamily:'var(--fs-font-mono)', color:'var(--fs-ink-500)'}}>
        <div/>
        {['8','10','12','14','16','18','20','','','','',''].slice(0,12).map((h,i) => (
          <div key={i} style={{textAlign:'center'}}>{i%2===0?h:''}</div>
        ))}
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d,r) => (
          <React.Fragment key={r}>
            <div style={{paddingRight:6, color:'var(--fs-ink-700)'}}>{d}</div>
            {Array.from({length:12}).map((_,c) => {
              // simulated intensity
              let i = Math.sin((c-3)*0.6)*0.4 + 0.5 + Math.sin((c-9)*0.7)*0.3;
              if (r === 5) i += 0.25; // saturday peak
              if (r === 6) i -= 0.15; // sunday low
              i = Math.max(0.05, Math.min(1, i));
              return (
                <div key={c} style={{
                  height:20, borderRadius:2,
                  background: `oklch(${0.96 - i*0.45} ${0.04 + i*0.13} 20)`,
                }}/>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:6, marginTop:14,
                   fontSize:10, color:'var(--fs-ink-500)'}}>
        <span>Faible</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
          <div key={i} style={{width:18, height:10, borderRadius:2,
                                background:`oklch(${0.96 - i*0.45} ${0.04 + i*0.13} 20)`}}/>
        ))}
        <span>Élevée</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  MobileMoneyPaymentScreen, TicketReceipt, LoginScreen,
  StockReceptionScreen, StaffManagementScreen, MonthlyReportScreen,
});
