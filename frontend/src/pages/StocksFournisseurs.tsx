import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';
import {
  getFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur,
  FournisseurRecord, FournisseurInput,
} from '../api/fournisseurs';
import ToastContainer, { useToast } from '../components/Toast';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Constants ──────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  'beauté': '#F5C4B2', 'hygiène': '#B8D8EC', 'parfumerie': '#D8C4E8',
  'épicerie': '#EDD8A0', 'boissons': '#B4DCC4', 'alimentation': '#F0D4B0',
  'bien-être': '#A8E0D4', 'maison': '#D4C8B8',
};
const ALL_CATS = ['beauté', 'hygiène', 'parfumerie', 'épicerie', 'boissons', 'alimentation', 'bien-être', 'maison'];
const CONDITIONS = [
  { value: 'comptant', label: 'Comptant' },
  { value: '30j',      label: '30 jours' },
  { value: '60j',      label: '60 jours' },
];

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = {
  plus:   'M12 5v14M5 12h14',
  x:      'M18 6L6 18M6 6l12 12',
  edit:   'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:  'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  truck:  'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
  user:   'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  star:   'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  mail:   'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  map:    'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
};

// ── Stars ──────────────────────────────────────────────────────────────────────

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange?.(n)}
          style={{ background: 'none', border: 'none', cursor: onChange ? 'pointer' : 'default', padding: 1, color: n <= value ? 'var(--fs-gold-400)' : 'var(--fs-line-2)', display: 'flex' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill={n <= value ? 'var(--fs-gold-400)' : 'none'} stroke="var(--fs-gold-400)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d={D.star}/>
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Form modal ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: FournisseurInput = {
  name: '', contact: '', phone: '', email: '', adresse: '',
  conditionsPaiement: 'comptant', remise: '0', note: 3, categories: [],
};

function FournisseurForm({ initial, onSave, onClose }: {
  initial: FournisseurInput;
  onSave: (f: FournisseurInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);

  const toggleCat = (cat: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const inputStyle = { width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'var(--fs-font-sans)' };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 600, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ background: 'var(--fs-wine-700)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <p style={{ fontWeight: 700, color: '#f5ebd9', fontSize: 15, margin: 0 }}>{initial.name ? `Modifier — ${initial.name}` : 'Nouveau fournisseur'}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,235,217,0.7)', cursor: 'pointer', display: 'flex' }}>
            <I d={D.x} size={16}/>
          </button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {([
              { key: 'name',    label: 'Nom *',       placeholder: 'ex: Import Maroc' },
              { key: 'contact', label: 'Contact',      placeholder: 'ex: Ahmed B.' },
              { key: 'phone',   label: 'Téléphone',    placeholder: '+237 6XX XXX XXX' },
              { key: 'email',   label: 'Email',        placeholder: 'contact@fournisseur.com' },
            ] as { key: keyof typeof form; label: string; placeholder: string }[]).map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                <input value={String(form[f.key])} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} style={inputStyle}/>
              </div>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Adresse</label>
            <input value={form.adresse} onChange={e => setForm(prev => ({ ...prev, adresse: e.target.value }))}
              placeholder="ex: Akwa, Douala, Cameroun" style={inputStyle}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Conditions de paiement</label>
              <select value={form.conditionsPaiement} onChange={e => setForm(prev => ({ ...prev, conditionsPaiement: e.target.value as FournisseurRecord['conditionsPaiement'] }))}
                style={{ ...inputStyle, background: '#fff' }}>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Remise commerciale (%)</label>
              <input type="number" min={0} max={100} value={form.remise} onChange={e => setForm(prev => ({ ...prev, remise: e.target.value }))}
                placeholder="0" style={inputStyle}/>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Note de fiabilité</label>
            <Stars value={form.note} onChange={n => setForm(prev => ({ ...prev, note: n }))}/>
          </div>

          <div>
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
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={() => { if (form.name.trim()) onSave(form); }}
            style={{ flex: 1, padding: '11px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Enregistrer
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: '11px', background: 'none', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StocksFournisseurs() {
  const [fournisseurs, setF]    = useState<FournisseurRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch]     = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [editing, setEditing]   = useState<FournisseurRecord | null>(null);
  const [loading, setLoading]   = useState(true);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  // Ouvre le catalogue filtré sur les produits de ce fournisseur.
  const openProducts = (f: FournisseurRecord) => navigate(`/stocks?q=${encodeURIComponent(f.name)}`);

  useEffect(() => { getAllProducts().then(setProducts).catch(() => {}); }, []);
  useEffect(() => {
    getFournisseurs()
      .then(setF)
      .catch(() => addToast('Erreur de chargement des fournisseurs', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Nombre de produits réellement rattachés à ce fournisseur (champ « fournisseur »
  // du produit), cohérent avec la recherche du catalogue. (Avant : comptait par
  // catégorie, ce qui gonflait/faussait le total.)
  const productsFor = (f: FournisseurRecord) =>
    products.filter(p => (p.fournisseur ?? '').trim().toLowerCase() === f.name.trim().toLowerCase()).length;

  const handleSave = async (data: FournisseurInput, id?: string) => {
    try {
      if (id) {
        const updated = await updateFournisseur(id, data);
        setF(prev => prev.map(f => f._id === id ? updated : f));
        addToast('Fournisseur modifié ✓', 'success');
      } else {
        const created = await createFournisseur(data);
        setF(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
        addToast('Fournisseur ajouté ✓', 'success');
      }
      setShowAdd(false);
      setEditing(null);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFournisseur(id);
      setF(prev => prev.filter(f => f._id !== id));
      addToast('Fournisseur supprimé', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const displayed = fournisseurs.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.contact.toLowerCase().includes(search.toLowerCase())
  );

  const condLabel: Record<string, string> = { comptant: 'Comptant', '30j': '30 jours', '60j': '60 jours' };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {showAdd && (
        <FournisseurForm
          initial={EMPTY_FORM}
          onSave={data => handleSave(data)}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editing && (
        <FournisseurForm
          initial={{ name: editing.name, contact: editing.contact, phone: editing.phone, email: editing.email, adresse: editing.adresse, conditionsPaiement: editing.conditionsPaiement, remise: editing.remise, note: editing.note, categories: editing.categories }}
          onSave={data => handleSave(data, editing._id)}
          onClose={() => setEditing(null)}
        />
      )}

      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isMobile ? '12px 16px 12px 56px' : '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Fournisseurs</h1>
            </div>
            <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
              <div style={{ position: 'relative', flex: isMobile ? 1 : undefined }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}><I d={D.search} size={13}/></span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                  style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)', width: isMobile ? '100%' : 220, boxSizing: 'border-box' }}/>
              </div>
              <button onClick={() => setShowAdd(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <I d={D.plus} size={13}/> Nouveau fournisseur
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px' : '20px 24px' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading ? (
                <div style={{ padding: '40px 14px', textAlign: 'center', fontSize: 13, color: 'var(--fs-ink-400)' }}>Chargement…</div>
              ) : displayed.length === 0 ? (
                <div style={{ padding: '40px 14px', textAlign: 'center', fontSize: 13, color: 'var(--fs-ink-400)' }}>
                  {search ? 'Aucun fournisseur ne correspond à la recherche.' : 'Aucun fournisseur. Cliquez sur « Nouveau fournisseur » pour en ajouter un.'}
                </div>
              ) : displayed.map(f => (
                <div key={f._id} onClick={() => openProducts(f)} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 14, boxShadow: 'var(--fs-shadow-sm)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--fs-wine-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fs-wine-700)', flexShrink: 0 }}>
                      <I d={D.truck} size={14}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{f.name}</div>
                      {f.adresse && <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}><I d={D.map} size={10}/>{f.adresse}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); setEditing(f); }}
                        style={{ background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--fs-ink-500)' }}>
                        <I d={D.edit} size={14}/>
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(f._id); }}
                        style={{ background: 'var(--fs-danger-100)', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--fs-danger-700)' }}>
                        <I d={D.trash} size={14}/>
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fs-ink-600)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                      <I d={D.user} size={12}/> {f.contact}
                    </div>
                    {f.email !== '—' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 3 }}>
                        <I d={D.mail} size={10}/> {f.email}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: f.conditionsPaiement === 'comptant' ? '#E8F0E5' : '#F7ECD4', color: f.conditionsPaiement === 'comptant' ? 'var(--fs-success-700)' : '#8B5A14' }}>
                      {condLabel[f.conditionsPaiement] ?? '—'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: parseInt(f.remise) > 0 ? 'var(--fs-wine-700)' : 'var(--fs-ink-400)' }}>
                      Remise {f.remise}%
                    </span>
                    <Stars value={f.note}/>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>
                      {productsFor(f)} produit{productsFor(f) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {f.categories.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {f.categories.map(cat => (
                        <span key={cat} style={{ background: CAT_COLORS[cat] ?? '#ddd', color: 'var(--fs-ink-700)', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>{cat}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
            <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--fs-ivory)' }}>
                  {['Fournisseur', 'Contact', 'Conditions', 'Remise', 'Note', 'Catégories', 'Produits', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px 14px', textAlign: 'center', fontSize: 13, color: 'var(--fs-ink-400)' }}>
                      Chargement…
                    </td>
                  </tr>
                ) : displayed.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px 14px', textAlign: 'center', fontSize: 13, color: 'var(--fs-ink-400)' }}>
                      {search ? 'Aucun fournisseur ne correspond à la recherche.' : 'Aucun fournisseur. Cliquez sur « Nouveau fournisseur » pour en ajouter un.'}
                    </td>
                  </tr>
                ) : displayed.map((f, idx) => (
                  <tr key={f._id} onClick={() => openProducts(f)} title="Voir les produits de ce fournisseur"
                    style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)', cursor: 'pointer' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--fs-wine-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fs-wine-700)', flexShrink: 0 }}>
                          <I d={D.truck} size={14}/>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{f.name}</div>
                          {f.adresse && <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}><I d={D.map} size={10}/>{f.adresse}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--fs-ink-600)', fontWeight: 600 }}>
                        <I d={D.user} size={12}/> {f.contact}
                      </div>
                      {f.email !== '—' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 3 }}>
                          <I d={D.mail} size={10}/> {f.email}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: f.conditionsPaiement === 'comptant' ? '#E8F0E5' : '#F7ECD4', color: f.conditionsPaiement === 'comptant' ? 'var(--fs-success-700)' : '#8B5A14' }}>
                        {condLabel[f.conditionsPaiement] ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: parseInt(f.remise) > 0 ? 'var(--fs-wine-700)' : 'var(--fs-ink-400)' }}>
                      {f.remise}%
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Stars value={f.note}/>
                    </td>
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={e => { e.stopPropagation(); setEditing(f); }}
                          style={{ background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--fs-ink-500)' }}>
                          <I d={D.edit} size={13}/>
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(f._id); }}
                          style={{ background: 'var(--fs-danger-100)', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--fs-danger-700)' }}>
                          <I d={D.trash} size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </main>
    </div>
  );
}
