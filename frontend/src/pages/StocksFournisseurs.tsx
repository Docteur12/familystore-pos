import React, { useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';

interface Fournisseur {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  categories: string[];
}

const LS_KEY = 'fs_fournisseurs';
const DEFAULT_FOURNISSEURS: Fournisseur[] = [
  { id: '1', name: 'Import Maroc',     contact: 'Ahmed B.',  phone: '+212 6XX XXX XXX', email: 'import@maroc.ma',    categories: ['beauté', 'bien-être'] },
  { id: '2', name: 'Soleco SA',        contact: 'Marie C.',  phone: '+237 6XX XXX XXX', email: 'soleco@cm.net',      categories: ['hygiène'] },
  { id: '3', name: 'Import France',    contact: 'Pierre D.', phone: '+33 6XX XXX XXX',  email: 'import@france.fr',   categories: ['parfumerie'] },
  { id: '4', name: 'Coop. Cameroun',   contact: 'Jean F.',   phone: '+237 6XX XXX XXX', email: 'coop@cameroun.cm',   categories: ['épicerie'] },
  { id: '5', name: 'Coop. Douala',     contact: 'Paul N.',   phone: '+237 6XX XXX XXX', email: 'coop@douala.cm',     categories: ['alimentation'] },
  { id: '6', name: 'SABC',            contact: 'Responsable', phone: '+237 2XX XXX XXX', email: 'sabc@sabc.cm',      categories: ['boissons'] },
  { id: '7', name: 'Fournisseur Local',contact: 'N/A',        phone: '+237 6XX XXX XXX', email: '—',                  categories: ['maison'] },
];

function loadFournisseurs(): Fournisseur[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '') as Fournisseur[]; }
  catch { return DEFAULT_FOURNISSEURS; }
}
function saveFournisseurs(f: Fournisseur[]) { localStorage.setItem(LS_KEY, JSON.stringify(f)); }

const CAT_COLORS: Record<string, string> = {
  'beauté': '#F5C4B2', 'hygiène': '#B8D8EC', 'parfumerie': '#D8C4E8',
  'épicerie': '#EDD8A0', 'boissons': '#B4DCC4', 'alimentation': '#F0D4B0',
  'bien-être': '#A8E0D4', 'maison': '#D4C8B8',
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
  plus:    'M12 5v14M5 12h14',
  x:       'M18 6L6 18M6 6l12 12',
  user:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  truck:   'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
  phone:   'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5 2 2 0 0 1 3.6 2.78l3-.01a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  mail:    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  search:  'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
};

const ALL_CATS = ['beauté', 'hygiène', 'parfumerie', 'épicerie', 'boissons', 'alimentation', 'bien-être', 'maison'];

export default function StocksFournisseurs() {
  const [fournisseurs, setF]    = useState<Fournisseur[]>(loadFournisseurs);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch]     = useState('');
  const [form, setForm]         = useState({ name: '', contact: '', phone: '', email: '', categories: [] as string[] });

  useEffect(() => { getAllProducts().then(setProducts).catch(() => {}); }, []);

  const productsFor = (f: Fournisseur) =>
    products.filter(p => f.categories.includes(p.category?.toLowerCase() ?? '')).length;

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const updated = [...fournisseurs, { ...form, id: Date.now().toString() }];
    setF(updated);
    saveFournisseurs(updated);
    setShowForm(false);
    setForm({ name: '', contact: '', phone: '', email: '', categories: [] });
  };

  const handleDelete = (id: string) => {
    const updated = fournisseurs.filter(f => f.id !== id);
    setF(updated);
    saveFournisseurs(updated);
  };

  const toggleCat = (cat: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const displayed = fournisseurs.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.contact.toLowerCase().includes(search.toLowerCase())
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
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Fournisseurs</h1>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}><I d={D.search} size={13}/></span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                  style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)', width: 220 }}/>
              </div>
              <button onClick={() => setShowForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <I d={D.plus} size={13}/> Nouveau fournisseur
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Add form */}
          {showForm && (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 20, boxShadow: 'var(--fs-shadow-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', margin: 0 }}>Nouveau fournisseur</p>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)' }}><I d={D.x} size={15}/></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {([
                  { key: 'name',    label: 'Nom *',         placeholder: 'ex: Import Maroc' },
                  { key: 'contact', label: 'Contact',       placeholder: 'ex: Ahmed B.' },
                  { key: 'phone',   label: 'Téléphone',     placeholder: '+237 6XX XXX XXX' },
                  { key: 'email',   label: 'Email',         placeholder: 'contact@fournisseur.com' },
                ] as { key: keyof Omit<typeof form, 'categories'>; label: string; placeholder: string }[]).map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Catégories fournies</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ALL_CATS.map(cat => (
                    <button key={cat} onClick={() => toggleCat(cat)} style={{
                      padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: form.categories.includes(cat) ? 'none' : '1.5px solid var(--fs-line-2)',
                      background: form.categories.includes(cat) ? (CAT_COLORS[cat] ?? '#ddd') : '#fff',
                      color: 'var(--fs-ink-700)',
                    }}>{cat}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleAdd}
                style={{ padding: '10px 24px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Enregistrer
              </button>
            </div>
          )}

          {/* Table */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Fournisseur', 'Contact', 'Téléphone', 'Email', 'Catégories', 'Produits', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', background: 'var(--fs-ivory)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((f, idx) => (
                  <tr key={f.id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--fs-wine-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fs-wine-700)', flexShrink: 0 }}>
                          <I d={D.truck} size={14}/>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{f.name}</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fs-ink-500)' }}>
                        <I d={D.user} size={12}/> {f.contact}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{f.phone}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--fs-ink-400)', fontFamily: 'var(--fs-font-mono)' }}>{f.email}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {f.categories.map(cat => (
                          <span key={cat} style={{ background: CAT_COLORS[cat] ?? '#ddd', color: 'var(--fs-ink-700)', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>{cat}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>
                      {productsFor(f)}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => handleDelete(f.id)}
                        style={{ background: 'var(--fs-danger-100)', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: 'var(--fs-danger-700)', cursor: 'pointer', fontWeight: 600 }}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
