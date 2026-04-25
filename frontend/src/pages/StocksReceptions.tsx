import React, { useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';
import { addStockWithMovement } from '../api/stock';
import ToastContainer, { useToast } from '../components/Toast';

interface Reception {
  id: string;
  date: string;
  product: string;
  qty: number;
  fournisseur: string;
  bl: string;
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
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  plus:   'M12 5v14M5 12h14',
  pkg:    'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zM12 22V11.5M3 6.5l9 5 9-5',
};

const SUPPLIERS = ['Import Maroc', 'Soleco SA', 'Import France', 'Coop. Cameroun', 'Coop. Douala', 'SABC', 'Fournisseur Local', 'Coop. Locale'];

const LS_KEY = 'fs_receptions';
function loadReceptions(): Reception[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
function saveReceptions(list: Reception[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export default function StocksReceptions() {
  const { toasts, addToast, removeToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [receptions, setReceptions] = useState<Reception[]>(loadReceptions);

  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty]           = useState('');
  const [fournisseur, setFourn] = useState('');
  const [bl, setBl]             = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading]   = useState(false);

  useEffect(() => { getAllProducts().then(setProducts).catch(() => {}); }, []);

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? '').includes(search)
  );

  const handleSubmit = async () => {
    if (!selected || !qty || parseInt(qty) <= 0) return;
    setLoading(true);
    try {
      await addStockWithMovement(selected._id, parseInt(qty));
      const rec: Reception = {
        id: Date.now().toString(),
        date,
        product: selected.name,
        qty: parseInt(qty),
        fournisseur: fournisseur || 'Non renseigné',
        bl: bl || '—',
      };
      const updated = [rec, ...receptions];
      setReceptions(updated);
      saveReceptions(updated);
      addToast(`+${qty} ${selected.unit} — ${selected.name}`, 'success');
      setSelected(null); setQty(''); setFourn(''); setBl('');
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Réceptions</h1>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
          {/* Form panel */}
          <div style={{ width: 380, borderRight: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--fs-line)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Nouveau bon de réception</p>

              {/* Search product */}
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Produit *</label>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}><I d={D.search} size={13}/></span>
                <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
                  placeholder="Nom ou code-barres..."
                  style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)' }}/>
              </div>

              {/* Product list */}
              {search && !selected && (
                <div style={{ border: '1px solid var(--fs-line)', borderRadius: 8, overflow: 'hidden', maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
                  {filtered.length === 0 ? (
                    <p style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-300)' }}>Aucun produit</p>
                  ) : filtered.map(p => (
                    <button key={p._id} onClick={() => { setSelected(p); setSearch(p.name); }}
                      style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--fs-line)' }}>
                      <I d={D.pkg} size={13}/>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Stock : {p.stock} {p.unit}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div style={{ background: 'var(--fs-wine-50)', border: '1px solid rgba(122,29,46,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--fs-wine-800)', fontWeight: 600 }}>
                  {selected.name} — stock actuel : {selected.stock} {selected.unit}
                </div>
              )}

              {/* Qty */}
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Quantité reçue *</label>
              <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} placeholder="ex: 50"
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>

              {/* Fournisseur */}
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Fournisseur</label>
              <select value={fournisseur} onChange={e => setFourn(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
                <option value="">— Sélectionner —</option>
                {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Date + BL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>N° BL</label>
                  <input type="text" value={bl} onChange={e => setBl(e.target.value)} placeholder="BL-2026-001"
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                </div>
              </div>

              <button onClick={handleSubmit} disabled={!selected || !qty || loading}
                style={{ width: '100%', padding: '11px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (!selected || !qty || loading) ? 0.5 : 1 }}>
                {loading ? 'Enregistrement…' : `Enregistrer la réception`}
              </button>
            </div>
          </div>

          {/* Receptions table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Réceptions récentes</p>
            {receptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fs-ink-300)', fontSize: 14 }}>
                Aucune réception enregistrée
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Produit', 'Qté reçue', 'Fournisseur', 'N° BL'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', background: '#fff', position: 'sticky', top: 0 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receptions.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>{r.date}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{r.product}</td>
                      <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>+{r.qty}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{r.fournisseur}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>{r.bl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
