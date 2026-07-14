import React, { useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Depot {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  localisation: string;
  main: boolean;
}

interface Transfert {
  id: string;
  date: string;
  depotSourceId: string;
  depotSourceName: string;
  depotDestId: string;
  depotDestName: string;
  productId: string;
  productName: string;
  quantite: number;
  statut: 'effectue' | 'en_cours';
  createdAt: string;
}

const LS_DEPOTS = 'fs_depots';
const LS_TRANSFERTS = 'fs_transferts';

const DEFAULT_DEPOTS: Depot[] = [
  { id: '1', name: 'Dépôt principal', address: 'Rue de la Joie, Akwa', city: 'Douala', phone: '+237 6XX XXX XXX', localisation: 'Bâtiment A', main: true },
  { id: '2', name: 'Entrepôt secondaire', address: 'Zone industrielle', city: 'Douala', phone: '+237 6XX XXX XXX', localisation: 'Bâtiment B', main: false },
];

function loadDepots(): Depot[] {
  try { return JSON.parse(localStorage.getItem(LS_DEPOTS) ?? '') as Depot[]; } catch { return DEFAULT_DEPOTS; }
}
function saveDepots(d: Depot[]) { localStorage.setItem(LS_DEPOTS, JSON.stringify(d)); }

function loadTransferts(): Transfert[] {
  try { return JSON.parse(localStorage.getItem(LS_TRANSFERTS) ?? '[]'); } catch { return []; }
}
function saveTransferts(t: Transfert[]) { localStorage.setItem(LS_TRANSFERTS, JSON.stringify(t)); }

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = {
  plus:     'M12 5v14M5 12h14',
  x:        'M18 6L6 18M6 6l12 12',
  home:     'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z',
  phone:    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5 2 2 0 0 1 3.6 2.78l3-.01a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  transfer: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
  map:      'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16M16 6v16',
};

type ViewMode = 'depots' | 'transferts';

// ── Main component ─────────────────────────────────────────────────────────────

export default function StocksDepots() {
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024); // mobile + tablette : agencement empilé du contenu
  const [depots,     setDepots]     = useState<Depot[]>(loadDepots);
  const [transferts, setTransferts] = useState<Transfert[]>(loadTransferts);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [view,       setView]       = useState<ViewMode>('depots');
  const [showForm,   setShowForm]   = useState(false);
  const [showTransf, setShowTransf] = useState(false);

  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '', localisation: '' });
  const [tForm, setTForm] = useState({
    depotSourceId: '',
    depotDestId: '',
    productId: '',
    quantite: '',
    date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    getAllProducts().then(setProducts).catch(() => {});
  }, []);

  const productCount = products.length;

  const handleAddDepot = () => {
    if (!form.name.trim()) return;
    const updated = [...depots, { ...form, id: Date.now().toString(), main: false }];
    setDepots(updated);
    saveDepots(updated);
    setShowForm(false);
    setForm({ name: '', address: '', city: '', phone: '', localisation: '' });
  };

  const handleDeleteDepot = (id: string) => {
    const updated = depots.filter(d => d.id !== id);
    setDepots(updated);
    saveDepots(updated);
  };

  const handleAddTransfert = () => {
    const { depotSourceId, depotDestId, productId, quantite, date } = tForm;
    if (!depotSourceId || !depotDestId || !productId || !quantite || depotSourceId === depotDestId) return;
    const source = depots.find(d => d.id === depotSourceId);
    const dest   = depots.find(d => d.id === depotDestId);
    const prod   = products.find(p => p._id === productId);
    if (!source || !dest || !prod) return;
    const t: Transfert = {
      id: Date.now().toString(),
      date,
      depotSourceId,
      depotSourceName: source.name,
      depotDestId,
      depotDestName: dest.name,
      productId,
      productName: prod.name,
      quantite: parseInt(quantite),
      statut: 'effectue',
      createdAt: new Date().toISOString(),
    };
    const updated = [t, ...transferts];
    setTransferts(updated);
    saveTransferts(updated);
    setShowTransf(false);
    setTForm({ depotSourceId: '', depotDestId: '', productId: '', quantite: '', date: new Date().toISOString().slice(0, 10) });
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 16 }}>
            <div style={{ paddingLeft: isMobile ? 44 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Dépôts</h1>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['depots', 'transferts'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: view === v ? 'none' : '1.5px solid var(--fs-line-2)',
                  background: view === v ? 'var(--fs-wine-700)' : '#fff',
                  color: view === v ? '#fff' : 'var(--fs-ink-500)',
                  fontFamily: 'var(--fs-font-sans)',
                }}>
                  {v === 'depots' ? `Dépôts (${depots.length})` : `Transferts (${transferts.length})`}
                </button>
              ))}
              {view === 'depots' ? (
                <button onClick={() => setShowForm(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <I d={D.plus} size={13}/> Nouveau dépôt
                </button>
              ) : (
                <button onClick={() => setShowTransf(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <I d={D.transfer} size={13}/> Nouveau transfert
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: '0 0 auto', overflowY: 'visible', overflowX: 'auto', padding: isNarrow ? '16px 12px' : '20px 24px' }}>
          {view === 'depots' ? (
            <>
              {/* Add depot form */}
              {showForm && (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 20, boxShadow: 'var(--fs-shadow-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', margin: 0 }}>Nouveau dépôt</p>
                    <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)' }}><I d={D.x} size={15}/></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                    {([
                      { key: 'name',         label: 'Nom *',          placeholder: 'ex: Entrepôt Nord' },
                      { key: 'city',         label: 'Ville',          placeholder: 'ex: Douala' },
                      { key: 'address',      label: 'Adresse',        placeholder: 'ex: Rue de la Joie' },
                      { key: 'phone',        label: 'Téléphone',      placeholder: '+237 6XX XXX XXX' },
                      { key: 'localisation', label: 'Localisation',   placeholder: 'ex: Bâtiment C, Allée A-12' },
                    ] as { key: keyof typeof form; label: string; placeholder: string }[]).map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                        <input value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleAddDepot} style={{ padding: '10px 24px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Enregistrer
                  </button>
                </div>
              )}

              {/* Depot cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {depots.map(depot => (
                  <div key={depot.id} style={{ background: '#fff', border: `1px solid ${depot.main ? 'rgba(122,29,46,0.3)' : 'var(--fs-line)'}`, borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)', position: 'relative' }}>
                    {depot.main && (
                      <div style={{ position: 'absolute', top: 14, right: 14, background: 'var(--fs-wine-50)', color: 'var(--fs-wine-800)', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Principal
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: depot.main ? 'var(--fs-wine-50)' : 'var(--fs-ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: depot.main ? 'var(--fs-wine-700)' : 'var(--fs-ink-400)' }}>
                        <I d={D.home} size={18}/>
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{depot.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>{depot.city}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>{depot.address}</div>
                      {depot.localisation && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fs-ink-500)' }}>
                          <I d={D.map} size={12}/> {depot.localisation}
                        </div>
                      )}
                      {depot.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fs-ink-500)' }}>
                          <I d={D.phone} size={12}/> {depot.phone}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--fs-line)' }}>
                      <div style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)', fontSize: 14 }}>{depot.main ? productCount : 0}</span> références
                      </div>
                      {!depot.main && (
                        <button onClick={() => handleDeleteDepot(depot.id)}
                          style={{ background: 'var(--fs-danger-100)', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: 'var(--fs-danger-700)', cursor: 'pointer', fontWeight: 600 }}>
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Transfer form */}
              {showTransf && (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 20, boxShadow: 'var(--fs-shadow-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', margin: 0 }}>Nouveau transfert inter-dépôt</p>
                    <button onClick={() => setShowTransf(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)' }}><I d={D.x} size={15}/></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : '1fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Dépôt source *</label>
                      <select value={tForm.depotSourceId} onChange={e => setTForm(p => ({ ...p, depotSourceId: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
                        <option value="">— Dépôt —</option>
                        {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Dépôt destination *</label>
                      <select value={tForm.depotDestId} onChange={e => setTForm(p => ({ ...p, depotDestId: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
                        <option value="">— Dépôt —</option>
                        {depots.filter(d => d.id !== tForm.depotSourceId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Produit *</label>
                      <select value={tForm.productId} onChange={e => setTForm(p => ({ ...p, productId: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
                        <option value="">— Produit —</option>
                        {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Quantité *</label>
                      <input type="number" min={1} value={tForm.quantite} onChange={e => setTForm(p => ({ ...p, quantite: e.target.value }))}
                        placeholder="ex: 20"
                        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Date</label>
                      <input type="date" value={tForm.date} onChange={e => setTForm(p => ({ ...p, date: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                    </div>
                  </div>
                  <button onClick={handleAddTransfert} style={{ padding: '10px 24px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Enregistrer le transfert
                  </button>
                </div>
              )}

              {/* Transfers table */}
              {transferts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Aucun transfert enregistré</div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflowX: 'auto', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <table className="fs-grid" style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--fs-ivory)' }}>
                        {['Date', 'Produit', 'Source', 'Destination', 'Quantité', 'Statut'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transferts.map((t, i) => (
                        <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                          <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>{t.date}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{t.productName}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{t.depotSourceName}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{t.depotDestName}</td>
                          <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{t.quantite}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: '#E8F0E5', color: 'var(--fs-success-700)' }}>
                              Effectué
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
