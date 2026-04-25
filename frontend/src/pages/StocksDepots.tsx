import React, { useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts } from '../api/products';

interface Depot {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  main: boolean;
}

const LS_KEY = 'fs_depots';
const DEFAULT_DEPOTS: Depot[] = [
  { id: '1', name: 'Dépôt principal', address: 'Rue de la Joie, Akwa', city: 'Douala', phone: '+237 6XX XXX XXX', main: true },
  { id: '2', name: 'Entrepôt secondaire', address: 'Zone industrielle', city: 'Douala', phone: '+237 6XX XXX XXX', main: false },
];
function loadDepots(): Depot[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '') as Depot[]; } catch { return DEFAULT_DEPOTS; }
}
function saveDepots(d: Depot[]) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = { plus: 'M12 5v14M5 12h14', x: 'M18 6L6 18M6 6l12 12', home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z', phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5 2 2 0 0 1 3.6 2.78l3-.01a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z' };

export default function StocksDepots() {
  const [depots, setDepots]     = useState<Depot[]>(loadDepots);
  const [productCount, setPC]   = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', address: '', city: '', phone: '' });

  useEffect(() => { getAllProducts().then(ps => setPC(ps.length)).catch(() => {}); }, []);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const updated = [...depots, { ...form, id: Date.now().toString(), main: false }];
    setDepots(updated);
    saveDepots(updated);
    setShowForm(false);
    setForm({ name: '', address: '', city: '', phone: '' });
  };

  const handleDelete = (id: string) => {
    const updated = depots.filter(d => d.id !== id);
    setDepots(updated);
    saveDepots(updated);
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Dépôts</h1>
            </div>
            <button onClick={() => setShowForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <I d={D.plus} size={13}/> Nouveau dépôt
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Add form */}
          {showForm && (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 20, boxShadow: 'var(--fs-shadow-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', margin: 0 }}>Nouveau dépôt</p>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)' }}><I d={D.x} size={15}/></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {([
                  { key: 'name', label: 'Nom du dépôt *', placeholder: 'ex: Entrepôt Nord' },
                  { key: 'city', label: 'Ville', placeholder: 'ex: Douala' },
                  { key: 'address', label: 'Adresse', placeholder: 'ex: Rue de la Joie, Akwa' },
                  { key: 'phone', label: 'Téléphone', placeholder: '+237 6XX XXX XXX' },
                ] as { key: keyof typeof form; label: string; placeholder: string }[]).map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                  </div>
                ))}
              </div>
              <button onClick={handleAdd} style={{ padding: '10px 24px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Enregistrer
              </button>
            </div>
          )}

          {/* Depot cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>{depot.address}</div>
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
                    <button onClick={() => handleDelete(depot.id)}
                      style={{ background: 'var(--fs-danger-100)', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: 'var(--fs-danger-700)', cursor: 'pointer', fontWeight: 600 }}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
