import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { createUser, deleteUser, getUsers, updateUser, UserRecord } from '../api/auth';
import { getCaisses, CaisseRecord } from '../api/caisses';
import { getAllProducts, deleteProduct, Product } from '../api/products';
import NouveauProduitModal from '../components/NouveauProduitModal';
import { getDemandes, DemandeStock, ajusterStockEntrepot, getAllReceptions, ReceptionFull } from '../api/magazinier';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#C2566B','#7A9EC2','#7AB87A','#C2A07A','#9A7AC2','#7ABFBF','#C2B07A'];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

function I({ d, size = 14 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}
const D = {
  plus:     'M12 5v14M5 12h14',
  edit:     'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:    'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  eye:      'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  close:    'M18 6L6 18M6 6l12 12',
  pkg:      'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zM12 22V11.5M3 6.5l9 5 9-5',
  truck:    'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
  mail:     'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  warehouse:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  users:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  search:   'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  alert:    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  reset:    'M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38',
};

function Field({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}/>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function MagazinierCard({ user, selected, onEdit, onDelete }: {
  user: UserRecord; selected: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const color = avatarColor(user.name);
  return (
    <div style={{ background: '#fff', border: selected ? '2.5px solid var(--fs-wine-700)' : '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: selected ? '0 0 0 3px rgba(122,29,46,0.08)' : 'var(--fs-shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
          {initials(user.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{user.name}</div>
          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onEdit} title="Modifier" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--fs-line)', background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I d={D.edit} size={12}/>
          </button>
          <button onClick={onDelete} title="Supprimer" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--fs-line)', background: '#fff', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I d={D.trash} size={12}/>
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'var(--fs-ivory)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--fs-wine-700)' }}><I d={D.pkg} size={13}/></span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Accès</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-800)' }}>Réceptions · Envois</div>
          </div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}/>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Actif</span>
        </div>
      </div>
      {user.assignedLocation && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fs-ink-500)' }}>🏭 {user.assignedLocation}</div>
      )}
    </div>
  );
}

// ── Edit panel ────────────────────────────────────────────────────────────────

function EditPanel({ user, caisses, onSaved, onCancel, onDeleted, isNarrow }: {
  user: UserRecord; caisses: CaisseRecord[]; onSaved: () => void; onCancel: () => void; onDeleted: () => void; isNarrow: boolean;
}) {
  const nameParts = user.name.split(' ');
  const [prenom, setPrenom]   = useState(nameParts[0] ?? '');
  const [nom, setNom]         = useState(nameParts.slice(1).join(' ') ?? '');
  const [location, setLocation] = useState(user.assignedLocation || '');
  const [pwd, setPwd]         = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]     = useState('');

  const handleSave = async () => {
    const fullName = `${prenom} ${nom}`.trim();
    if (!fullName) { setError('Le nom est obligatoire.'); return; }
    setLoading(true); setError('');
    try {
      const patch: { name?: string; password?: string; assignedLocation?: string } = { assignedLocation: location };
      if (fullName !== user.name) patch.name = fullName;
      if (pwd.length >= 4) patch.password = pwd;
      await updateUser(user._id, patch);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await deleteUser(user._id); onDeleted(); }
    catch { setDeleting(false); setConfirm(false); }
  };

  return (
    <div style={{ width: isNarrow ? '100%' : 320, borderLeft: isNarrow ? 'none' : '1px solid var(--fs-line)', borderTop: isNarrow ? '1px solid var(--fs-line)' : 'none', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Modification</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{user.name}</div>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}><I d={D.close} size={16}/></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Identité</p>
        <Field label="Prénom" value={prenom} onChange={setPrenom}/>
        <Field label="Nom" value={nom} onChange={setNom}/>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Affectation</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>🏭 Dépôt / Entrepôt assigné</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="ex: Dépôt principal, Entrepôt Nord…"
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}
          />
        </div>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Nouveau mot de passe</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Mot de passe (laisser vide pour ne pas changer)</label>
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••"
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
            <button onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
              <I d={D.eye} size={14}/>
            </button>
          </div>
        </div>
      </div>

      {!confirm ? (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setConfirm(true)} style={{ padding: '10px 14px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)' }}>
            <I d={D.trash} size={12}/>
          </button>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}>Annuler</button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-wine-700)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      ) : (
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--fs-line)', flexShrink: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-700)', margin: '0 0 10px' }}>Supprimer <strong>{user.name}</strong> ?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: '9px', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)' }}>Annuler</button>
            <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-700)', color: '#fff', opacity: deleting ? 0.7 : 1 }}>
              {deleting ? '…' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create panel ──────────────────────────────────────────────────────────────

function CreatePanel({ caisses, onCreated, onCancel, isNarrow }: { caisses: CaisseRecord[]; onCreated: () => void; onCancel: () => void; isNarrow: boolean }) {
  const [form, setForm] = useState({ prenom: '', nom: '', phone: '', email: '', assignedLocation: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const identifiant = form.prenom && form.nom
    ? `${form.prenom.toLowerCase()}.${form.nom.toLowerCase().slice(0, 1)}@familystore.cm`
    : '';

  const handleCreate = async () => {
    if (!form.prenom || !form.nom) { setError('Prénom et nom obligatoires.'); return; }
    if (form.password.length < 4) { setError('Mot de passe : 4 caractères minimum.'); return; }
    setLoading(true); setError('');
    try {
      await createUser({
        name:             `${form.prenom} ${form.nom}`,
        email:            form.email || identifiant,
        password:         form.password,
        role:             'magazinier',
        phone:            form.phone            || undefined,
        assignedLocation: form.assignedLocation || undefined,
      });
      onCreated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ width: isNarrow ? '100%' : 320, borderLeft: isNarrow ? 'none' : '1px solid var(--fs-line)', borderTop: isNarrow ? '1px solid var(--fs-line)' : 'none', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>+ Nouveau magazinier</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Créer un compte</div>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}><I d={D.close} size={16}/></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Identité</p>
        <Field label="Prénom *" value={form.prenom} onChange={v => set('prenom', v)} placeholder="Jean"/>
        <Field label="Nom *"    value={form.nom}    onChange={v => set('nom', v)}    placeholder="Kamdem"/>
        <Field label="Téléphone" value={form.phone}  onChange={v => set('phone', v)}  placeholder="+237 6 91 23 45 67"/>
        <Field label="Email"     value={form.email}  onChange={v => set('email', v)}  type="email" placeholder={identifiant || 'jean.k@familystore.cm'}/>

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Affectation</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>🏭 Dépôt / Entrepôt assigné</label>
          <input
            type="text"
            value={form.assignedLocation}
            onChange={e => set('assignedLocation', e.target.value)}
            placeholder="ex: Dépôt principal, Entrepôt Nord…"
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}
          />
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Accès</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Mot de passe *</label>
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} value={form.password}
              onChange={e => set('password', e.target.value)} placeholder="Min. 4 caractères"
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
            <button onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
              <I d={D.eye} size={14}/>
            </button>
          </div>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#1d4ed8' }}>
          <I d={D.mail} size={11}/>{' '}
          Accès : <strong>Réceptions</strong>, <strong>Demandes en attente</strong>, <strong>Historique</strong> — sans accès aux prix ni au CA.
        </div>
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}>Annuler</button>
        <button onClick={handleCreate} disabled={loading} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-wine-700)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Création…' : 'Créer le compte'}
        </button>
      </div>
    </div>
  );
}

// ── Stock entrepôt view ───────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  'beauté': '#F5C4B2', 'hygiène': '#B8D8EC', 'parfumerie': '#D8C4E8',
  'épicerie': '#EDD8A0', 'boissons': '#B4DCC4', 'alimentation': '#F0D4B0',
  'bien-être': '#A8E0D4', 'maison': '#D4C8B8',
};
const catColor = (c?: string) => CAT_COLORS[c?.toLowerCase() ?? ''] ?? '#DDD4C8';
const fmtN = (n: number) => n.toLocaleString('fr-FR');

function StockEntrepotView({ products, demandes, onReload }: {
  products: Product[];
  demandes: DemandeStock[];
  onReload: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState<'tous' | 'bas'>('tous');
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);
  const knownCategories = [...new Set(products.map(p => p.category).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'fr'));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget._id);
      setDeleteTarget(null);
      onReload();
    } catch { /* garder le modal ouvert si erreur */ }
    finally { setDeleting(false); }
  };

  // Métriques : seulement les produits avec stock > 0
  const avecStock = products.filter(p => (p.stockMagazin ?? 0) > 0);

  const basCount = avecStock.filter(p => {
    const seuil = p.magazinierThreshold ?? 0;
    return seuil > 0 && (p.stockMagazin ?? 0) <= seuil;
  }).length;

  // Tableau : tous les produits (l'admin doit pouvoir corriger même ceux à 0)
  const displayed = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || p.name.toLowerCase().includes(q)
      || (p.localName ?? '').toLowerCase().includes(q)
      || (p.category ?? '').toLowerCase().includes(q);
    const mag   = p.stockMagazin ?? 0;
    const seuil = p.magazinierThreshold ?? 0;
    const matchFiltre = filtre === 'tous' ? true : seuil > 0 && mag <= seuil;
    return matchSearch && matchFiltre;
  });

  const totalEntrepot = avecStock.reduce((s, p) => s + (p.stockMagazin ?? 0), 0);
  // Valeur approximative de l'entrepôt (quantité entrepôt × prix d'achat)
  const valeurEntrepot = avecStock.reduce((s, p) => s + (p.stockMagazin ?? 0) * (p.costPrice ?? 0), 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Modal édition complète du produit (admin : tout modifiable) */}
      {editProduct && (
        <NouveauProduitModal
          product={editProduct}
          knownCategories={knownCategories}
          existingProducts={products}
          onClose={() => setEditProduct(null)}
          onUpdated={() => { setEditProduct(null); onReload(); }}
        />
      )}

      {/* Modal confirmation suppression produit */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#dc2626' }}>
                <I d={D.trash} size={20}/>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-900)' }}>Supprimer ce produit ?</div>
                <div style={{ fontSize: 12, color: 'var(--fs-ink-500)', marginTop: 2 }}>Cette action est irréversible.</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--fs-ink-700)', lineHeight: 1.6, marginBottom: 20 }}>
              Le produit <strong>{deleteTarget.name}</strong> sera définitivement supprimé du catalogue. L'opération sera enregistrée dans le journal d'audit.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)' }}>
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#dc2626', color: '#fff', opacity: deleting ? 0.7 : 1, fontFamily: 'var(--fs-font-sans)' }}>
                {deleting ? 'Suppression…' : 'Oui, supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Métriques */}
      <div style={{ display: isNarrow ? 'grid' : 'flex', gridTemplateColumns: isNarrow ? (isMobile ? '1fr' : 'repeat(2, 1fr)') : undefined, gap: 12, padding: isNarrow ? '16px 16px' : '16px 24px', flexShrink: 0 }}>
        {[
          { label: 'Total unités entrepôt', value: fmtN(totalEntrepot), color: 'var(--fs-wine-700)', sub: `${avecStock.length} référence${avecStock.length !== 1 ? 's' : ''} avec stock` },
          { label: 'Valeur entrepôt (≈)', value: `${fmtN(valeurEntrepot)} XAF`, color: 'var(--fs-ink-900)', sub: "Sur la base du prix d'achat" },
          { label: 'Références en stock', value: avecStock.length, color: '#15803d', sub: `sur ${products.length} produits au total` },
          { label: 'Stock bas / critique', value: basCount, color: basCount > 0 ? '#dc2626' : '#15803d', sub: basCount > 0 ? 'sous le seuil commande' : 'tout est OK' },
          { label: 'Envois au gestionnaire', value: demandes.length, color: '#2563eb', sub: `${demandes.filter(d => d.statut === 'reçu').length} reçu${demandes.filter(d => d.statut === 'reçu').length !== 1 ? 's' : ''} · ${demandes.filter(d => d.statut === 'envoyé').length} en transit` },
        ].map(m => (
          <div key={m.label} style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 16px', boxShadow: 'var(--fs-shadow-sm)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: m.color, fontFamily: 'var(--fs-font-mono)' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Barre filtres + recherche + reset */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: isNarrow ? '0 16px 12px' : '0 24px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { id: 'tous', label: 'Tous',       count: products.length },
            { id: 'bas',  label: 'Stock bas',  count: basCount        },
          ] as { id: typeof filtre; label: string; count: number }[]).map(f => (
            <button key={f.id} onClick={() => setFiltre(f.id)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: filtre === f.id ? 'none' : '1.5px solid var(--fs-line-2)',
              background: filtre === f.id ? 'var(--fs-wine-700)' : '#fff',
              color: filtre === f.id ? '#fff' : 'var(--fs-ink-500)',
              fontFamily: 'var(--fs-font-sans)', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {f.label}
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: filtre === f.id ? 'rgba(255,255,255,0.25)' : 'var(--fs-ivory)', color: filtre === f.id ? '#fff' : 'var(--fs-ink-400)' }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}>
            <I d={D.search} size={13}/>
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…"
            style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: '#fff', width: '100%', boxSizing: 'border-box' }}/>
        </div>
      </div>

      {/* Tableau */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: isNarrow ? '0 16px 24px' : '0 24px 24px' }}>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>
            <I d={D.warehouse} size={36}/><br/><br/>
            Aucun produit — le magazinier n'a pas encore enregistré de réception.
          </div>
        ) : (
          <table className="fs-grid" style={{ width: '100%', minWidth: isNarrow ? 820 : undefined, borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--fs-ivory)' }}>
                {['Produit', 'Catégorie', 'Stock entrepôt', 'Stock caisse', 'Seuil commande', 'Valeur (≈)', 'État', ''].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: i >= 2 ? 'center' : 'left',
                    fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap',
                    position: 'sticky', top: 0, background: 'var(--fs-ivory)', zIndex: 1,
                  }}>
                    {h}
                    {h === 'Stock entrepôt' && <div style={{ fontWeight: 400, textTransform: 'none', fontSize: 9, letterSpacing: 0, marginTop: 1, color: '#2563eb' }}>Cliquer pour modifier</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 14 }}>
                    Aucun produit trouvé
                  </td>
                </tr>
              ) : displayed.map((p, idx) => {
                const mag   = p.stockMagazin ?? 0;
                const seuil = p.magazinierThreshold ?? 0;
                const bas   = seuil > 0 && mag <= seuil;
                const color = catColor(p.category);
                return (
                  <tr key={p._id} style={{ borderBottom: '1px solid var(--fs-line)', background: bas ? '#fef9f9' : idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 8, height: 34, borderRadius: 4, background: color, flexShrink: 0 }}/>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{p.name}</div>
                          {p.localName && <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{p.localName}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {p.category && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: color + '55', border: `1px solid ${color}`, borderRadius: 6, padding: '2px 8px', color: 'var(--fs-ink-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {p.category}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <input
                        type="number" min={0}
                        key={p._id + '-' + mag}
                        defaultValue={mag}
                        disabled={adjusting === p._id}
                        onBlur={async e => {
                          const v = parseInt(e.target.value) || 0;
                          if (v === mag) return;
                          setAdjusting(p._id);
                          try { await ajusterStockEntrepot(p._id, v); onReload(); }
                          catch { /* silencieux, l'admin peut réessayer */ }
                          finally { setAdjusting(null); }
                        }}
                        style={{ width: 76, padding: '5px 8px', border: `1.5px solid ${bas ? '#dc2626' : '#2563eb44'}`, borderRadius: 7, fontSize: 18, textAlign: 'center', fontFamily: 'var(--fs-font-mono)', fontWeight: 800, color: bas ? '#dc2626' : '#15803d', background: bas ? '#fef9f9' : '#f0fdf4', opacity: adjusting === p._id ? 0.5 : 1 }}
                      />
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: p.stock === 0 ? 'var(--fs-danger-700)' : p.stock <= p.alertThreshold ? '#C48518' : 'var(--fs-ink-700)' }}>
                        {p.stock}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontFamily: 'var(--fs-font-mono)', color: seuil > 0 ? 'var(--fs-ink-600)' : 'var(--fs-ink-300)', fontWeight: seuil > 0 ? 700 : 400 }}>
                        {seuil > 0 ? seuil : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: (p.costPrice ?? 0) > 0 ? 'var(--fs-ink-800)' : 'var(--fs-ink-300)' }}>
                        {(p.costPrice ?? 0) > 0 ? `${fmtN(mag * (p.costPrice ?? 0))} XAF` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      {bas ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <I d={D.alert} size={10}/> À commander
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}>
                          OK
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button onClick={() => setEditProduct(p)} title="Modifier le produit"
                          style={{ background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: 'var(--fs-ink-600)', display: 'inline-flex', alignItems: 'center' }}>
                          <I d={D.edit} size={13}/>
                        </button>
                        <button onClick={() => setDeleteTarget(p)} title="Supprimer le produit"
                          style={{ background: '#fef2f2', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'inline-flex', alignItems: 'center' }}>
                          <I d={D.trash} size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── Section envois au gestionnaire ── */}
        <div style={{ marginTop: 20, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <I d={D.truck} size={14}/>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Envois du magazinier au gestionnaire</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 20, padding: '2px 10px', color: 'var(--fs-ink-500)' }}>
              {demandes.length} envoi{demandes.length !== 1 ? 's' : ''}
            </span>
          </div>
          {demandes.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13, fontStyle: 'italic' }}>
              Aucun produit encore envoyé au gestionnaire
            </div>
          ) : (
            <table className="fs-grid" style={{ width: '100%', minWidth: isNarrow ? 720 : undefined, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--fs-ivory)' }}>
                  {['Produit', 'Qté envoyée', 'Demandé par', 'Statut', 'Date envoi'].map((h, i) => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--fs-ivory)', zIndex: 1 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandes.map((d, idx) => (
                  <tr key={d._id} style={{ borderBottom: '1px solid var(--fs-line)', background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--fs-ink-900)' }}>
                      {d.produit?.name ?? '—'}
                      {d.produit?.unit && <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 400 }}>{d.produit.unit}</span>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', fontSize: 16 }}>
                      {d.quantiteDemandee}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: 'var(--fs-ink-600)' }}>
                      {d.demandePar?.name ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: d.statut === 'reçu' ? '#f0fdf4' : '#eff6ff', color: d.statut === 'reçu' ? '#16a34a' : '#2563eb', border: `1px solid ${d.statut === 'reçu' ? '#86efac' : '#bfdbfe'}` }}>
                        {d.statut === 'reçu' ? '✓ Reçu' : '🚚 En transit'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: 'var(--fs-ink-400)' }}>
                      {d.dateEnvoi ? new Date(d.dateEnvoi).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type PanelMode = { type: 'create' } | { type: 'edit'; user: UserRecord } | null;

type ViewMode = 'equipe' | 'stock';

export default function AdminMagaziniers() {
  const [users, setUsers]     = useState<UserRecord[]>([]);
  const [caisses, setCaisses] = useState<CaisseRecord[]>([]);
  const [panel, setPanel]     = useState<PanelMode>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('equipe');
  const [products, setProducts]     = useState<Product[]>([]);
  const [demandes, setDemandes]     = useState<DemandeStock[]>([]);
  const [receptions, setReceptions] = useState<ReceptionFull[]>([]);
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);

  const load = () => getUsers().then(us => setUsers(us.filter(u => u.role === 'magazinier'))).catch(() => {});

  const reloadStock = () => {
    getAllProducts().then(setProducts).catch(() => {});
    getAllReceptions().then(setReceptions).catch(() => {});
    Promise.all([getDemandes('envoyé'), getDemandes('reçu')])
      .then(([env, rec]) => setDemandes([...env, ...rec].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    getCaisses().then(setCaisses).catch(() => {});
    reloadStock();
  }, []);

  // Produits qui ont été reçus au moins une fois par le magazinier
  const receivedIds = new Set(
    receptions.flatMap(r => r.items.map(it => String(it.productId)))
  );
  const magazinierProducts = products.filter(p => receivedIds.has(p._id));

  const selectedId = panel?.type === 'edit' ? panel.user._id : null;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 16 }}>
            <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Personnel — Entrepôt</p>
              {/* Onglets */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setViewMode('equipe'); setPanel(null); }} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: viewMode === 'equipe' ? '1.5px solid var(--fs-wine-700)' : '1.5px solid var(--fs-line-2)',
                  background: viewMode === 'equipe' ? 'var(--fs-wine-700)' : '#fff',
                  color: viewMode === 'equipe' ? '#fff' : 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)',
                }}>
                  <I d={D.users} size={13}/> Équipe
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: viewMode === 'equipe' ? 'rgba(255,255,255,0.25)' : 'var(--fs-ivory)', color: viewMode === 'equipe' ? '#fff' : 'var(--fs-ink-400)' }}>
                    {users.length}
                  </span>
                </button>
                <button onClick={() => { setViewMode('stock'); setPanel(null); }} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: viewMode === 'stock' ? '1.5px solid var(--fs-wine-700)' : '1.5px solid var(--fs-line-2)',
                  background: viewMode === 'stock' ? 'var(--fs-wine-700)' : '#fff',
                  color: viewMode === 'stock' ? '#fff' : 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)',
                }}>
                  <I d={D.warehouse} size={13}/> Stock entrepôt
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: viewMode === 'stock' ? 'rgba(255,255,255,0.25)' : 'var(--fs-ivory)', color: viewMode === 'stock' ? '#fff' : 'var(--fs-ink-400)' }}>
                    {magazinierProducts.length}
                  </span>
                </button>
              </div>
            </div>
            {viewMode === 'equipe' && (
              <button onClick={() => setPanel({ type: 'create' })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <I d={D.plus} size={13}/> Ajouter un magazinier
              </button>
            )}
          </div>
        </div>

        {/* ── Vue Équipe ── */}
        {viewMode === 'equipe' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: isNarrow ? 'column' : 'row', overflow: isNarrow ? 'visible' : 'hidden' }}>
            <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', padding: isNarrow ? '20px 16px' : '20px 24px' }}>
              {users.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13, padding: '60px 0' }}>
                  <I d={D.pkg} size={36}/><br/><br/>
                  Aucun magazinier — cliquez sur <strong>Ajouter</strong> pour créer le premier compte.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 14 }}>
                  {users.map(u => (
                    <MagazinierCard
                      key={u._id}
                      user={u}
                      selected={selectedId === u._id}
                      onEdit={() => setPanel({ type: 'edit', user: u })}
                      onDelete={() => setPanel({ type: 'edit', user: u })}
                    />
                  ))}
                </div>
              )}
            </div>
            {panel?.type === 'create' && (
              <CreatePanel caisses={caisses} isNarrow={isNarrow} onCreated={() => { load(); setPanel(null); }} onCancel={() => setPanel(null)}/>
            )}
            {panel?.type === 'edit' && (
              <EditPanel
                user={panel.user}
                caisses={caisses}
                isNarrow={isNarrow}
                onSaved={() => { load(); setPanel(null); }}
                onCancel={() => setPanel(null)}
                onDeleted={() => { load(); setPanel(null); }}
              />
            )}
          </div>
        )}

        {/* ── Vue Stock entrepôt ── */}
        {viewMode === 'stock' && (
          <StockEntrepotView products={magazinierProducts} demandes={demandes} onReload={reloadStock}/>
        )}
      </main>
    </div>
  );
}
