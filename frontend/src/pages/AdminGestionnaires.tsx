import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { createUser, deleteUser, getUsers, updateUser, UserRecord } from '../api/auth';
import { getCaisses, CaisseRecord } from '../api/caisses';

const AVATAR_COLORS = ['#7A9EC2','#7AB87A','#9A7AC2','#7ABFBF','#C2B07A'];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const MODULES = ['Stock', 'Réceptions', 'Inventaire', 'Fournisseurs', 'Étiquettes', 'Dépôts'];

function I({ d, size = 14 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}
const D = { plus: 'M12 5v14M5 12h14', filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z', x: 'M18 6L6 18M6 6l12 12', edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2', close: 'M18 6L6 18M6 6l12 12', eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' };

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

function getExtra(id: string) {
  const h = id.charCodeAt(0);
  return {
    date:    ['03 nov. 2023','15 jan. 2024','08 sep. 2024','22 nov. 2025'][h % 4],
    stars:   3 + (h % 3),
    modules: MODULES.slice(0, 3 + (h % 3)),
  };
}

function Stars({ n }: { n: number }) {
  return <span>{[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= n ? '#D1A660' : 'var(--fs-line-2)', fontSize: 11 }}>★</span>)}</span>;
}

function GestCard({ user, selected, onClick, onEdit, onDelete }: { user: UserRecord; selected: boolean; onClick: () => void; onEdit: () => void; onDelete: () => void }) {
  const extra = getExtra(user._id);
  const color = avatarColor(user.name);
  return (
    <div style={{ background: '#fff', border: `${selected ? '2.5px solid var(--fs-wine-700)' : '1px solid var(--fs-line)'}`, borderRadius: 12, padding: '14px 16px', boxShadow: selected ? '0 0 0 3px rgba(122,29,46,0.08)' : 'var(--fs-shadow-sm)', transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(user.name)}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 1 }}>Gestionnaire stock</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ background: '#E8F0E5', color: 'var(--fs-success-700)', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.08em', border: '1px solid rgba(90,139,83,0.2)' }}>STOCK</span>
          <button onClick={onEdit} title="Modifier" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--fs-line)', background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I d={D.edit} size={12}/>
          </button>
          <button onClick={onDelete} title="Supprimer" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--fs-line)', background: '#fff', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I d={D.trash} size={12}/>
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: 11, color: 'var(--fs-ink-500)' }}>
        <span>📅 {extra.date}</span>
        <Stars n={extra.stars}/>
        {user.assignedLocation && <span>🏭 {user.assignedLocation}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {extra.modules.map(m => (
          <span key={m} style={{ background: 'var(--fs-ivory)', color: 'var(--fs-ink-600)', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, border: '1px solid var(--fs-line)' }}>{m}</span>
        ))}
      </div>
    </div>
  );
}

// ── Edit gestionnaire panel ───────────────────────────────────────────────────

function EditGestPanel({ user, caisses, onSaved, onCancel }: { user: UserRecord; caisses: CaisseRecord[]; onSaved: () => void; onCancel: () => void }) {
  const parts = user.name.split(' ');
  const [prenom, setPrenom] = useState(parts[0] ?? '');
  const [nom, setNom]       = useState(parts.slice(1).join(' ') ?? '');
  const [depot, setDepot]   = useState(user.assignedLocation || '');
  const [pwd, setPwd]       = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    const fullName = `${prenom} ${nom}`.trim();
    if (!fullName) { setError('Nom obligatoire.'); return; }
    setLoading(true); setError('');
    try {
      const patch: { name?: string; password?: string; assignedLocation?: string } = { assignedLocation: depot };
      if (fullName !== user.name) patch.name = fullName;
      if (pwd.length >= 6) patch.password = pwd;
      await updateUser(user._id, patch);
      onSaved();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ width: 310, borderLeft: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-success-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Modification</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{user.name}</div>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
          <I d={D.close} size={16}/>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Identité</p>
        {[{ label: 'Prénom', val: prenom, set: setPrenom }, { label: 'Nom', val: nom, set: setNom }].map(f => (
          <div key={f.label}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>{f.label}</label>
            <input value={f.val} onChange={e => f.set(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}/>
          </div>
        ))}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Affectation</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Point de vente assigné</label>
          <select value={depot} onChange={e => setDepot(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
            <option value="">— Sélectionner —</option>
            {caisses.map(c => <option key={c._id} value={c.nom}>{c.nom}{c.ville ? ` (${c.ville})` : ''}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Réinitialiser le mot de passe</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Nouveau mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)}
              placeholder="Laisser vide pour ne pas changer"
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
            <button onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
              <I d={D.eye} size={14}/>
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}>Annuler</button>
        <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-success-700)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ── Delete confirm panel ──────────────────────────────────────────────────────

function DeleteGestPanel({ user, onDeleted, onCancel }: { user: UserRecord; onDeleted: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleDelete = async () => {
    setLoading(true);
    try { await deleteUser(user._id); onDeleted(); }
    catch { setLoading(false); }
  };
  return (
    <div style={{ width: 310, borderLeft: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 22px', flexShrink: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 10 }}>Supprimer {user.name} ?</div>
      <p style={{ fontSize: 12, color: 'var(--fs-ink-500)', marginBottom: 20, lineHeight: 1.5 }}>Ce compte gestionnaire sera définitivement supprimé. Cette action est irréversible.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}>Annuler</button>
        <button onClick={handleDelete} disabled={loading} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-700)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Suppression…' : 'Confirmer la suppression'}
        </button>
      </div>
    </div>
  );
}

function FormPanel({ caisses, onCreated, onCancel }: { caisses: CaisseRecord[]; onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', phone: '', assignedLocation: '', dateEmb: new Date().toISOString().slice(0, 10), password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.prenom || !form.nom || !form.password) { setError('Prénom, nom et mot de passe obligatoires.'); return; }
    setLoading(true); setError('');
    try {
      await createUser({
        name:             `${form.prenom} ${form.nom}`,
        email:            form.email || `${form.prenom.toLowerCase()}.${form.nom[0].toLowerCase()}@familystore.cm`,
        password:         form.password,
        role:             'gestionnaire',
        phone:            form.phone            || undefined,
        assignedLocation: form.assignedLocation || undefined,
      });
      onCreated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ width: 310, borderLeft: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fs-line)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-success-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>+ Nouveau gestionnaire</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Créer un compte gestionnaire</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Identité</p>
        <Field label="Prénom" value={form.prenom} onChange={v => set('prenom', v)} placeholder="Samuel"/>
        <Field label="Nom" value={form.nom} onChange={v => set('nom', v)} placeholder="Onana"/>
        <Field label="Téléphone" value={form.phone} onChange={v => set('phone', v)} placeholder="+237 6 XX XX XX XX"/>
        <Field label="Email" value={form.email} onChange={v => set('email', v)} placeholder="samuel.o@familystore.cm"/>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Affectation</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Point de vente assigné</label>
          <select value={form.assignedLocation} onChange={e => set('assignedLocation', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
            <option value="">— Sélectionner —</option>
            {caisses.map(c => <option key={c._id} value={c.nom}>{c.nom}{c.ville ? ` (${c.ville})` : ''}</option>)}
          </select>
        </div>
        <Field label="Date d'embauche" value={form.dateEmb} onChange={v => set('dateEmb', v)} type="date"/>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Sécurité</p>
        <Field label="Mot de passe *" value={form.password} onChange={v => set('password', v)} type="password" placeholder="Min. 6 caractères"/>
      </div>
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 10, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}>Annuler</button>
        <button onClick={handleCreate} disabled={loading} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-success-700)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Création…' : 'Créer le compte'}
        </button>
      </div>
    </div>
  );
}

type GestPanel = { type: 'create' } | { type: 'edit'; user: UserRecord } | { type: 'delete'; user: UserRecord } | null;

export default function AdminGestionnaires() {
  const [users, setUsers]     = useState<UserRecord[]>([]);
  const [caisses, setCaisses] = useState<CaisseRecord[]>([]);
  const [panel, setPanel]     = useState<GestPanel>(null);

  const load = () => getUsers().then(us => setUsers(us.filter(u => u.role === 'gestionnaire'))).catch(() => {});
  useEffect(() => {
    load();
    getCaisses().then(setCaisses).catch(() => {});
  }, []);

  const staff = users;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Personnel — Gestionnaires</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Gestionnaires · {staff.length} comptes</h1>
            </div>
            <button onClick={() => setPanel({ type: 'create' })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--fs-success-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <I d={D.plus} size={13}/> Ajouter un gestionnaire
            </button>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {staff.map(u => (
                <GestCard key={u._id} user={u}
                  selected={panel?.type !== 'create' && (panel as { user?: UserRecord })?.user?._id === u._id}
                  onClick={() => {}}
                  onEdit={() => setPanel({ type: 'edit', user: u })}
                  onDelete={() => setPanel({ type: 'delete', user: u })}
                />
              ))}
            </div>
          </div>
          {panel?.type === 'create' && <FormPanel caisses={caisses} onCreated={() => { load(); setPanel(null); }} onCancel={() => setPanel(null)}/>}
          {panel?.type === 'edit' && <EditGestPanel user={panel.user} caisses={caisses} onSaved={() => { load(); setPanel(null); }} onCancel={() => setPanel(null)}/>}
          {panel?.type === 'delete' && <DeleteGestPanel user={panel.user} onDeleted={() => { load(); setPanel(null); }} onCancel={() => setPanel(null)}/>}
        </div>
      </main>
    </div>
  );
}
