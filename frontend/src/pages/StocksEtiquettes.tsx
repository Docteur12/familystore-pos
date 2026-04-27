import React, { useEffect, useRef, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';

// ── Barcode canvas renderer ────────────────────────────────────────────────────
// Simple Code39 encoding (5 bars + 4 spaces per char, narrow/wide pattern)

const CODE39_MAP: Record<string, string> = {
  '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn',
  '4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw',
  '8':'wnnwnnwnn','9':'nnwwnnwnn','A':'wnnnnwnnw','B':'nnwnnwnnw',
  'C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn',
  'G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
  'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww',
  'O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn',
  'S':'nnwnnnwwn','T':'nnnnwnwwn','-':'nnnnnwwwn',' ':'nwnnwnwnn',
  '*':'nwnnwwwnn',
};
const NARROW = 2; const WIDE = 5;

function drawCode39(canvas: HTMLCanvasElement, text: string, color = '#111') {
  const encoded = `*${text.toUpperCase()}*`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let x = 8;
  const h = canvas.height - 4;
  for (let c = 0; c < encoded.length; c++) {
    const pattern = CODE39_MAP[encoded[c]];
    if (!pattern) continue;
    for (let i = 0; i < 9; i++) {
      const w = pattern[i] === 'w' ? WIDE : NARROW;
      if (i % 2 === 0) { // bar
        ctx.fillStyle = color;
        ctx.fillRect(x, 2, w, h);
      }
      x += w;
    }
    x += NARROW; // inter-char gap
  }
}

function BarcodeCanvas({ value, width = 200, height = 44 }: { value: string; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawCode39(ref.current, value);
  }, [value]);
  return <canvas ref={ref} width={width} height={height} style={{ display: 'block', imageRendering: 'pixelated' }}/>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function skuOf(p: Product): string {
  if (p.barcode) return p.barcode;
  return p._id.slice(-9).toUpperCase().replace(/(.{3})/g, '$1-').slice(0, 11);
}

const CAT_COLORS: Record<string, string> = {
  'beauté': '#F5C4B2', 'hygiène': '#B8D8EC', 'parfumerie': '#D8C4E8',
  'épicerie': '#EDD8A0', 'boissons': '#B4DCC4', 'alimentation': '#F0D4B0',
  'bien-être': '#A8E0D4', 'maison': '#D4C8B8',
};
const catColor = (c?: string) => CAT_COLORS[c?.toLowerCase() ?? ''] ?? '#DDD4C8';

function fmtN(n: number) { return n.toLocaleString('fr-FR'); }

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = {
  search:  'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  print:   'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  check:   'M20 6L9 17l-5-5',
};

type Template = 'mini' | 'standard' | 'grande';
const TEMPLATES: { id: Template; label: string; size: string }[] = [
  { id: 'mini',     label: 'Mini',     size: '57×32 mm' },
  { id: 'standard', label: 'Standard', size: '90×50 mm' },
  { id: 'grande',   label: 'Grande',   size: '100×70 mm' },
];

// ── Label card ────────────────────────────────────────────────────────────────

function LabelCard({ product, template, selected, onToggle }: {
  product: Product;
  template: Template;
  selected: boolean;
  onToggle: () => void;
}) {
  const sku   = skuOf(product);
  const color = catColor(product.category);
  const isLarge = template === 'grande';
  const isMini  = template === 'mini';

  return (
    <div style={{
      background: '#fff', border: `2px solid ${selected ? 'var(--fs-wine-700)' : 'var(--fs-line)'}`,
      borderRadius: 10, padding: isMini ? '10px 12px' : isLarge ? '16px 18px' : '12px 14px',
      boxShadow: selected ? '0 0 0 3px rgba(122,29,46,0.15)' : 'var(--fs-shadow-sm)',
      cursor: 'pointer', position: 'relative',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }} onClick={onToggle}>
      {/* Checkbox */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        width: 18, height: 18, borderRadius: 4,
        border: selected ? '2px solid var(--fs-wine-700)' : '2px solid var(--fs-line-2)',
        background: selected ? 'var(--fs-wine-700)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        {selected && <I d={D.check} size={11}/>}
      </div>

      {/* Category strip */}
      <div style={{ height: 3, borderRadius: 2, background: color, marginBottom: 8 }}/>

      <div style={{ fontSize: isMini ? 11 : isLarge ? 15 : 12, fontWeight: 700, color: 'var(--fs-ink-900)', lineHeight: 1.3, marginBottom: 4, paddingRight: 24 }}>
        {product.name}
      </div>

      {!isMini && (
        <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
          {product.category ?? 'Non classé'}
        </div>
      )}

      {/* Barcode */}
      <div style={{ background: 'var(--fs-ivory)', borderRadius: 6, padding: '6px 8px', marginBottom: 8, textAlign: 'center', overflow: 'hidden' }}>
        <BarcodeCanvas value={sku.replace(/-/g, '')} width={isMini ? 160 : isLarge ? 220 : 190} height={isMini ? 28 : isLarge ? 48 : 36}/>
        <div style={{ fontSize: 9, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)', marginTop: 3, letterSpacing: '0.1em' }}>{sku}</div>
      </div>

      {/* Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          {!isMini && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', fontWeight: 600, marginBottom: 1 }}>PRIX DE VENTE</div>}
          <div style={{ fontSize: isMini ? 14 : isLarge ? 20 : 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-800)' }}>
            {fmtN(product.price)} <span style={{ fontSize: isMini ? 9 : 11, fontWeight: 600 }}>XAF</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {!isMini && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', fontWeight: 600, marginBottom: 1 }}>UNITÉ</div>}
          <div style={{ fontSize: isMini ? 10 : 12, fontWeight: 700, color: 'var(--fs-ink-600)' }}>{product.unit}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StocksEtiquettes() {
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [template,  setTemplate]  = useState<Template>('standard');
  const [selected,  setSelected]  = useState<Set<string>>(new Set());

  useEffect(() => {
    getAllProducts().then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const displayed = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    skuOf(p).toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === displayed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map(p => p._id)));
    }
  };

  const handleBatchPrint = () => {
    const toPrint = products.filter(p => selected.has(p._id));
    if (toPrint.length === 0) return;

    const sizes: Record<Template, string> = { mini: '57mm 32mm', standard: '90mm 50mm', grande: '100mm 70mm' };
    const fontSizes: Record<Template, { name: number; price: number; sku: number }> = {
      mini:     { name: 11, price: 14, sku: 8 },
      standard: { name: 13, price: 18, sku: 9 },
      grande:   { name: 16, price: 24, sku: 10 },
    };
    const fs = fontSizes[template];

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>Étiquettes — Family Store</title>
      <style>
        @page { size: ${sizes[template]}; margin: 3mm; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .label { page-break-after: always; padding: 4px; }
        .strip { height: 3px; border-radius: 2px; margin-bottom: 6px; }
        .name  { font-size: ${fs.name}px; font-weight: bold; margin-bottom: 3px; }
        .cat   { font-size: 8px; color: #999; text-transform: uppercase; margin-bottom: 6px; }
        .bc    { background: #f5f5f0; border-radius: 4px; padding: 4px; text-align: center; margin-bottom: 6px; }
        .sku   { font-size: ${fs.sku}px; font-family: monospace; letter-spacing: 0.1em; }
        .price { font-size: ${fs.price}px; font-weight: 900; color: #7a1d2e; }
        .row   { display: flex; justify-content: space-between; align-items: baseline; }
        .unit  { font-size: 10px; color: #666; }
        .bars  { display: flex; align-items: flex-end; justify-content: center; gap: 1px; height: ${template === 'mini' ? 20 : template === 'grande' ? 32 : 26}px; }
        .bar   { background: #111; border-radius: 0.5px; }
        @media print { body { background: none; } }
      </style></head>
      <body>
        ${toPrint.map(p => {
          const sku = skuOf(p);
          const col = catColor(p.category);
          const chars = sku.replace(/-/g, '').slice(0, 14);
          const bars = chars.split('').map((c, i) => {
            const w = (c.charCodeAt(0) % 2 === 0) ? 3 : 1.5;
            const h = 60 + (c.charCodeAt(0) % 40);
            return `<div class="bar" style="width:${w}px;height:${h}%"></div>`;
          }).join('');
          return `
            <div class="label">
              <div class="strip" style="background:${col}"></div>
              <div class="name">${p.name}</div>
              <div class="cat">${p.category ?? ''}</div>
              <div class="bc">
                <div class="bars">${bars}</div>
                <div class="sku">${sku}</div>
              </div>
              <div class="row">
                <div class="price">${fmtN(p.price)} <span style="font-size:10px;font-weight:600">XAF</span></div>
                <div class="unit">${p.unit}</div>
              </div>
            </div>
          `;
        }).join('')}
        <script>window.onload = () => { window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Étiquettes / SKU</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: template === t.id ? 'none' : '1.5px solid var(--fs-line-2)',
                  background: template === t.id ? 'var(--fs-wine-700)' : '#fff',
                  color: template === t.id ? '#fff' : 'var(--fs-ink-500)',
                  fontFamily: 'var(--fs-font-sans)',
                }}>
                  {t.label} <span style={{ opacity: 0.7, fontSize: 10 }}>{t.size}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}><I d={D.search} size={13}/></span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                  style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)', width: 200 }}/>
              </div>
              {selected.size > 0 && (
                <button onClick={handleBatchPrint}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' }}>
                  <I d={D.print} size={13}/> Imprimer ({selected.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Select all bar */}
        {displayed.length > 0 && (
          <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '8px 24px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-600)', fontFamily: 'var(--fs-font-sans)' }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, border: '2px solid var(--fs-wine-700)', background: selected.size === displayed.length ? 'var(--fs-wine-700)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                {selected.size === displayed.length && <I d={D.check} size={10}/>}
              </div>
              Tout sélectionner ({displayed.length})
            </button>
            {selected.size > 0 && (
              <span style={{ fontSize: 12, color: 'var(--fs-wine-700)', fontWeight: 600 }}>
                {selected.size} étiquette(s) sélectionnée(s)
              </span>
            )}
          </div>
        )}

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${template === 'mini' ? 200 : template === 'grande' ? 280 : 240}px, 1fr))`, gap: 14 }}>
              {displayed.map(p => (
                <LabelCard key={p._id} product={p} template={template} selected={selected.has(p._id)} onToggle={() => toggle(p._id)}/>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
