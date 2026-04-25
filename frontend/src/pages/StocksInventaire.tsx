import React, { useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product, updateProduct } from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';

interface InventaireRow {
  product: Product;
  counted: string;
  dirty: boolean;
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
  check:   'M20 6L9 17l-5-5',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
};

export default function StocksInventaire() {
  const { toasts, addToast, removeToast } = useToast();
  const [rows, setRows]       = useState<InventaireRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [search, setSearch]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const products = await getAllProducts();
      setRows(products.map(p => ({ product: p, counted: String(p.stock), dirty: false })));
    } catch { addToast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const setCounted = (id: string, val: string) => {
    setRows(prev => prev.map(r =>
      r.product._id === id
        ? { ...r, counted: val, dirty: val !== String(r.product.stock) }
        : r
    ));
  };

  const dirtyRows = rows.filter(r => r.dirty && r.counted !== '' && !isNaN(parseInt(r.counted)));

  const handleValidate = async () => {
    if (dirtyRows.length === 0) return;
    setSaving(true);
    let ok = 0; let fail = 0;
    for (const r of dirtyRows) {
      try {
        await updateProduct(r.product._id, { stock: parseInt(r.counted) });
        ok++;
      } catch { fail++; }
    }
    setSaving(false);
    if (ok > 0) addToast(`${ok} produit(s) mis à jour`, 'success');
    if (fail > 0) addToast(`${fail} erreur(s)`, 'error');
    load();
  };

  const displayed = rows.filter(r =>
    !search || r.product.name.toLowerCase().includes(search.toLowerCase())
  );

  const diffColor = (r: InventaireRow) => {
    if (!r.dirty) return 'var(--fs-ink-400)';
    const diff = parseInt(r.counted) - r.product.stock;
    return diff > 0 ? 'var(--fs-success-700)' : diff < 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)';
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Inventaire</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}><I d={D.search} size={13}/></span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                  style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)', width: 220 }}/>
              </div>
              <button onClick={load} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)' }}>
                <I d={D.refresh} size={14}/>
              </button>
              <button onClick={handleValidate} disabled={dirtyRows.length === 0 || saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: dirtyRows.length > 0 ? 'var(--fs-wine-700)' : 'var(--fs-line)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: dirtyRows.length > 0 ? 'pointer' : 'default', opacity: saving ? 0.7 : 1 }}>
                <I d={D.check} size={13}/>
                {saving ? 'Enregistrement…' : `Valider l'inventaire${dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ padding: '10px 24px', background: 'var(--fs-info-100)', borderBottom: '1px solid var(--fs-line)', fontSize: 12, color: 'var(--fs-info-700)', flexShrink: 0 }}>
          Saisissez le stock compté pour chaque produit. Les champs modifiés apparaissent en surbrillance. Cliquez sur "Valider l'inventaire" pour mettre à jour.
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Produit', 'Catégorie', 'Unité', 'Stock théorique', 'Stock compté', 'Écart'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: i >= 3 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, idx) => {
                  const diff = r.dirty && r.counted !== '' ? parseInt(r.counted) - r.product.stock : null;
                  return (
                    <tr key={r.product._id} style={{ background: r.dirty ? 'var(--fs-gold-50)' : idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{r.product.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{r.product.category ?? '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-400)', textAlign: 'center' }}>{r.product.unit}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>
                        {r.product.stock}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <input
                          type="number" min={0}
                          value={r.counted}
                          onChange={e => setCounted(r.product._id, e.target.value)}
                          style={{
                            width: 90, padding: '6px 10px', textAlign: 'center',
                            border: r.dirty ? '2px solid var(--fs-wine-700)' : '1.5px solid var(--fs-line-2)',
                            borderRadius: 8, fontSize: 14, fontWeight: 700,
                            fontFamily: 'var(--fs-font-mono)', outline: 'none',
                            background: r.dirty ? 'var(--fs-wine-50)' : '#fff',
                            color: 'var(--fs-ink-900)',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: diffColor(r) }}>
                        {diff === null ? '—' : diff > 0 ? `+${diff}` : diff === 0 ? '=' : diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
