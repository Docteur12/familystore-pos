import React, { useCallback, useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product, updateProduct } from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';

type Status = 'rupture' | 'critique' | 'alerte';
function getStatus(p: Product): Status {
  if (p.stock === 0) return 'rupture';
  if (p.stock <= Math.ceil(p.alertThreshold * 0.4)) return 'critique';
  return 'alerte';
}
const STATUS: Record<Status, { label: string; bg: string; color: string }> = {
  rupture:  { label: 'Rupture',  bg: '#FAE5DF', color: '#8B2C1A' },
  critique: { label: 'Critique', bg: '#FEF0E0', color: '#8B5A14' },
  alerte:   { label: 'Alerte',   bg: '#F7ECD4', color: '#8B5A14' },
};

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = {
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  check:   'M20 6L9 17l-5-5',
};

export default function StocksAlertes() {
  const { toasts, addToast, removeToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllProducts();
      const low = all.filter(p => p.stock <= p.alertThreshold)
        .sort((a, b) => (a.stock / a.alertThreshold) - (b.stock / b.alertThreshold));
      setProducts(low);
    } catch { addToast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveThreshold = async (p: Product) => {
    const val = parseInt(editing[p._id] ?? '');
    if (isNaN(val) || val < 0) return;
    setSaving(p._id);
    try {
      await updateProduct(p._id, { alertThreshold: val });
      addToast(`Seuil mis à jour — ${p.name}`, 'success');
      load();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setSaving(null); }
  };

  const ruptures  = products.filter(p => p.stock === 0).length;
  const critiques = products.filter(p => p.stock > 0 && p.stock <= Math.ceil(p.alertThreshold * 0.4)).length;
  const alertes   = products.length - ruptures - critiques;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <StocksSidebar alertCount={products.length}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Alertes & Seuils</h1>
            </div>
            <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600 }}>
              <I d={D.refresh} size={13}/> Actualiser
            </button>
          </div>
        </div>

        {/* Metric cards */}
        <div style={{ display: 'flex', gap: 14, padding: '16px 24px', flexShrink: 0 }}>
          {[
            { label: 'Ruptures',  count: ruptures,  bg: '#FAE5DF', color: '#8B2C1A' },
            { label: 'Critiques', count: critiques, bg: '#FEF0E0', color: '#8B5A14' },
            { label: 'Alertes',   count: alertes,   bg: '#F7ECD4', color: '#8B5A14' },
            { label: 'Total',     count: products.length, bg: 'var(--fs-wine-50)', color: 'var(--fs-wine-800)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 'var(--fs-r-md)', padding: '14px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.count}</span>
                {s.count > 0 && (
                  <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                    {s.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fs-ink-400)' }}>Tous les stocks sont suffisants</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Produit', 'Catégorie', 'Stock actuel', 'Seuil actuel', 'Modifier seuil', 'Statut'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 && i <= 4 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => {
                  const status = getStatus(p);
                  const st = STATUS[status];
                  const isEditing = editing[p._id] !== undefined;
                  return (
                    <tr key={p._id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{p.category ?? '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: p.stock === 0 ? 'var(--fs-danger-700)' : 'var(--fs-warning-700)' }}>
                        {p.stock} <span style={{ fontSize: 11, fontWeight: 400 }}>{p.unit}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>{p.alertThreshold}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <input
                            type="number" min={0}
                            placeholder={String(p.alertThreshold)}
                            value={editing[p._id] ?? ''}
                            onChange={e => setEditing(prev => ({ ...prev, [p._id]: e.target.value }))}
                            style={{ width: 80, padding: '5px 8px', textAlign: 'center', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--fs-font-mono)', outline: 'none' }}
                          />
                          {isEditing && (
                            <button onClick={() => handleSaveThreshold(p)} disabled={saving === p._id}
                              style={{ padding: '5px 8px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: saving === p._id ? 0.6 : 1 }}>
                              <I d={D.check} size={12}/>
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, display: 'inline-block' }}>
                          {st.label}
                        </span>
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
