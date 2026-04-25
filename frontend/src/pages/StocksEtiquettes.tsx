import React, { useEffect, useRef, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';

function skuOf(p: Product): string {
  if (p.barcode) return p.barcode;
  return p._id.slice(-9).toUpperCase().replace(/(.{3})/g, '$1-').slice(0, 11);
}

function Barcode({ value }: { value: string }) {
  // Simple barcode visualization (bars)
  const chars = value.replace(/-/g, '');
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: 32, gap: 1 }}>
      {chars.split('').map((c, i) => {
        const w = (c.charCodeAt(0) % 2) === 0 ? 2 : 1;
        const h = 24 + (c.charCodeAt(0) % 8);
        return <div key={i} style={{ width: w, height: h, background: 'var(--fs-ink-900)', borderRadius: 0.5 }}/>;
      })}
    </div>
  );
}

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
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
};

const CAT_COLORS: Record<string, string> = {
  'beauté': '#F5C4B2', 'hygiène': '#B8D8EC', 'parfumerie': '#D8C4E8',
  'épicerie': '#EDD8A0', 'boissons': '#B4DCC4', 'alimentation': '#F0D4B0',
  'bien-être': '#A8E0D4', 'maison': '#D4C8B8',
};
const catColor = (c?: string) => CAT_COLORS[c?.toLowerCase() ?? ''] ?? '#DDD4C8';

function LabelCard({ product }: { product: Product }) {
  const sku = skuOf(product);
  const color = catColor(product.category);
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--fs-line)',
      borderRadius: 10,
      padding: '14px 16px',
      boxShadow: 'var(--fs-shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Category color strip */}
      <div style={{ height: 4, borderRadius: 2, background: color, marginBottom: 4 }}/>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', lineHeight: 1.3 }}>{product.name}</div>
      <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{product.category ?? 'Non classé'}</div>

      {/* Barcode */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', background: 'var(--fs-ivory)', borderRadius: 6 }}>
        <Barcode value={sku}/>
        <div style={{ fontSize: 10, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)', marginTop: 4, letterSpacing: '0.1em' }}>{sku}</div>
      </div>

      {/* Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600 }}>PRIX DE VENTE</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-800)' }}>
            {product.price.toLocaleString('fr-FR')} <span style={{ fontSize: 11, fontWeight: 600 }}>XAF</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600 }}>UNITÉ</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-700)' }}>{product.unit}</div>
        </div>
      </div>

      {/* Print button */}
      <button
        onClick={() => {
          const win = window.open('', '_blank', 'width=400,height=300');
          if (!win) return;
          win.document.write(`
            <html><head><title>Étiquette — ${product.name}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .name { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
              .sku  { font-size: 12px; font-family: monospace; letter-spacing: 2px; text-align: center; margin: 10px 0; }
              .price{ font-size: 22px; font-weight: 900; }
              .strip{ height: 5px; background: ${color}; border-radius: 2px; margin-bottom: 10px; }
              .cat  { font-size: 10px; color: #888; text-transform: uppercase; }
              .center { text-align: center; }
            </style></head>
            <body>
              <div class="strip"></div>
              <div class="name">${product.name}</div>
              <div class="cat">${product.category ?? ''}</div>
              <div class="sku">${sku}</div>
              <div class="price">${product.price.toLocaleString('fr-FR')} XAF</div>
              <script>window.onload = () => { window.print(); window.close(); }<\/script>
            </body></html>
          `);
          win.document.close();
        }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, background: 'none', color: 'var(--fs-wine-700)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        <I d={D.print} size={13}/> Imprimer étiquette
      </button>
    </div>
  );
}

export default function StocksEtiquettes() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    getAllProducts().then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const displayed = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    skuOf(p).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Étiquettes / SKU</h1>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}><I d={D.search} size={13}/></span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher produit ou SKU..."
                style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)', width: 260 }}/>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {displayed.map(p => <LabelCard key={p._id} product={p}/>)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
