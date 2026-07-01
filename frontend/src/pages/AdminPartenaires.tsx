import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { createUser, deleteUser, getUsers, updateUser, UserRecord } from '../api/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#C2566B', '#7A9EC2', '#7AB87A', '#C2A07A', '#9A7AC2', '#7ABFBF', '#C2B07A'];
const avatarColor = (name: string) => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

function I({ d, size = 14 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}
const D = {
  plus:  'M12 5v14M5 12h14',
  edit:  'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  eye:   'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  close: 'M18 6L6 18M6 6l12 12',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  key:   'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3',
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
function PartenaireCard({ user, selected, onEdit, onDelete }: {
  user: UserRecord; selected: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const color = avatarColor(user.name);
  return (
    <div style={{ background: '#fff', border: selected ? '2.5px solid var(--fs-wine-700)' : '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: selected ? '0 0 0 3px rgba(122,29,46,0.08)' : 'var(--fs-shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{initials(user.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{user.name}</div>
          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onEdit} title="Modifier" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--fs-line)', background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I d={D.edit} size={12}/></button>
          <button onClick={onDelete} title="Supprimer" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--fs-line)', background: '#fff', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I d={D.trash} size={12}/></button>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, background: 'var(--fs-ivory)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--fs-wine-700)' }}><I d={D.key} size={13}/></span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Accès</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-800)' }}>Espace Partenaires</div>
          </div>
        </div>
        {user.phone && <div style={{ fontSize: 11, color: 'var(--fs-ink-500)' }}>📞 {user.phone}</div>}
      </div>
    </div>
  );
}

// ── Create panel ──────────────────────────────────────────────────────────────
function CreatePanel({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Le nom est obligatoire.'); return; }
    if (!form.email.trim()) { setError("L'email de connexion est obligatoire."); return; }
    if (form.password.length < 4) { setError('Mot de passe : 4 caractères minimum.'); return; }
    setLoading(true); setError('');
    try {
      await createUser({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: 'commercial', phone: form.phone || undefined });
      onCreated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ width: 320, borderLeft: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>+ Nouveau compte Partenaires</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Créer un identifiant</div>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}><I d={D.close} size={16}/></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Identité</p>
        <Field label="Nom *" value={form.name} onChange={v => set('name', v)} placeholder="ex : Gérant partenaires"/>
        <Field label="Téléphone" value={form.phone} onChange={v => set('phone', v)} placeholder="6XX XX XX XX"/>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Connexion</p>
        <Field label="Email (identifiant) *" value={form.email} onChange={v => set('email', v)} type="email" placeholder="partenaires@familystore.cm"/>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Mot de passe *</label>
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 4 caractères"
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
            <button onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}><I d={D.eye} size={14}/></button>
          </div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#1d4ed8' }}>
          Ce compte se connecte <strong>directement</strong> à l'espace Partenaires (commandes, agences, comptes & créances) — sans accès à la caisse, l'entrepôt ni l'admin.
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

// ── Edit panel ────────────────────────────────────────────────────────────────
function EditPanel({ user, onSaved, onCancel, onDeleted }: {
  user: UserRecord; onSaved: () => void; onCancel: () => void; onDeleted: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    setLoading(true); setError('');
    try {
      const patch: { name?: string; email?: string; phone?: string; password?: string } = {};
      if (name.trim() !== user.name) patch.name = name.trim();
      if (email.trim().toLowerCase() !== user.email) patch.email = email.trim().toLowerCase();
      if (phone !== (user.phone || '')) patch.phone = phone;
      if (pwd.length >= 4) patch.password = pwd;
      await updateUser(user._id, patch);
      onSaved();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await deleteUser(user._id); onDeleted(); }
    catch { setDeleting(false); setConfirm(false); }
  };

  return (
    <div style={{ width: 320, borderLeft: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
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
        <Field label="Nom" value={name} onChange={setName}/>
        <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="6XX XX XX XX"/>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Connexion</p>
        <Field label="Email (identifiant)" value={email} onChange={setEmail} type="email"/>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Nouveau mot de passe (vide = inchangé)</label>
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••"
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
            <button onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}><I d={D.eye} size={14}/></button>
          </div>
        </div>
      </div>

      {!confirm ? (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setConfirm(true)} title="Supprimer" style={{ padding: '10px 14px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)' }}><I d={D.trash} size={12}/></button>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}>Annuler</button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-wine-700)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      ) : (
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--fs-line)', flexShrink: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-700)', margin: '0 0 10px' }}>Supprimer le compte <strong>{user.name}</strong> ?</p>
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

// ── Main ──────────────────────────────────────────────────────────────────────
type PanelMode = { type: 'create' } | { type: 'edit'; user: UserRecord } | null;

export default function AdminPartenaires() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [panel, setPanel] = useState<PanelMode>(null);

  const load = () => getUsers().then(us => setUsers(us.filter(u => u.role === 'commercial'))).catch(() => {});
  useEffect(() => { load(); }, []);

  const selectedId = panel?.type === 'edit' ? panel.user._id : null;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Personnel</p>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Comptes Partenaires <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-400)' }}>({users.length})</span></h1>
          </div>
          <button onClick={() => setPanel({ type: 'create' })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <I d={D.plus} size={13}/> Ajouter un compte
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 12, color: 'var(--fs-ink-600)', maxWidth: 720 }}>
              Ces comptes servent à se connecter à l'<strong>espace Partenaires</strong> (grossistes) : la personne se connecte avec son email + mot de passe et arrive directement dans cet espace.
            </div>
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13, padding: '60px 0' }}>
                <I d={D.users} size={36}/><br/><br/>
                Aucun compte partenaire — cliquez sur <strong>Ajouter</strong> pour créer le premier.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, maxWidth: 860 }}>
                {users.map(u => (
                  <PartenaireCard key={u._id} user={u} selected={selectedId === u._id}
                    onEdit={() => setPanel({ type: 'edit', user: u })}
                    onDelete={() => setPanel({ type: 'edit', user: u })}/>
                ))}
              </div>
            )}
          </div>
          {panel?.type === 'create' && <CreatePanel onCreated={() => { load(); setPanel(null); }} onCancel={() => setPanel(null)}/>}
          {panel?.type === 'edit' && <EditPanel user={panel.user} onSaved={() => { load(); setPanel(null); }} onCancel={() => setPanel(null)} onDeleted={() => { load(); setPanel(null); }}/>}
        </div>
      </main>
    </div>
  );
}
