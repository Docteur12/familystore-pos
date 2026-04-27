import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import AdminSidebar from '../components/AdminSidebar';
import { createUser, deleteUser, getUsers, updateUser, UserRecord } from '../api/auth';

// ── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#C2566B','#7A9EC2','#7AB87A','#C2A07A','#9A7AC2','#7ABFBF','#C2B07A','#7A9AC2'];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fmtN = (n: number) => n.toLocaleString('fr-FR');

const CAISSES = ['Caisse 01', 'Caisse 02', 'Caisse 03', 'Caisse 04'];

function getExtra(id: string) {
  const h = id.charCodeAt(0);
  return {
    date:   ['15 jan. 2025','03 nov. 2023','08 sep. 2024','22 jan. 2026'][h % 4],
    stars:  3 + (h % 3),
    caisse: `C0${1 + h % 3}`,
    ventes: 100 + h % 500,
    panier: 12000 + (h * 7) % 5000,
  };
}

function getWeekSales(id: string) {
  const h = id.charCodeAt(0);
  return ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((day, i) => ({
    day,
    ventes: 10 + Math.round((h * (i + 3) * 13) % 70),
  }));
}

function I({ d, size = 14 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}
const D = {
  plus:  'M12 5v14M5 12h14',
  edit:  'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  eye:   'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  close: 'M18 6L6 18M6 6l12 12',
  bar:   'M18 20V10M12 20V4M6 20v-6',
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

// ── Caissier card ────────────────────────────────────────────────────────────

function CaissierCard({ user, selected, onStats, onEdit, onDelete }: {
  user: UserRecord; selected: boolean;
  onStats: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const extra = getExtra(user._id);
  const color = avatarColor(user.name);
  return (
    <div style={{ background: '#fff', border: selected ? '2.5px solid var(--fs-wine-700)' : '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 16px', boxShadow: selected ? '0 0 0 3px rgba(122,29,46,0.08)' : 'var(--fs-shadow-sm)', transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onStats}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {initials(user.name)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 1 }}>Caissier · {extra.caisse}</div>
          </div>
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

      <div style={{ cursor: 'pointer' }} onClick={onStats}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, fontSize: 11, color: 'var(--fs-ink-500)' }}>
          <span>📅 {extra.date}</span>
          <span>{[1,2,3,4,5].map(s => <span key={s} style={{ color: s <= extra.stars ? '#D1A660' : 'var(--fs-line-2)', fontSize: 11 }}>★</span>)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>
            <span style={{ fontWeight: 700 }}>{extra.ventes}</span> <span style={{ color: 'var(--fs-ink-400)' }}>ventes / 30j</span>
          </div>
          <div style={{ fontSize: 12, fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)' }}>
            {fmtN(extra.ventes * extra.panier)} XAF
          </div>
        </div>
      </div>

      <button onClick={onStats} style={{ marginTop: 12, width: '100%', padding: '7px', border: '1px solid var(--fs-line)', borderRadius: 8, background: 'var(--fs-ivory)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <I d={D.bar} size={12}/> Voir les statistiques
      </button>
    </div>
  );
}

// ── Stats panel ──────────────────────────────────────────────────────────────

function StatsPanel({ user, onClose, onEdit, onDeleted }: {
  user: UserRecord; onClose: () => void; onEdit: () => void; onDeleted: () => void;
}) {
  const extra = getExtra(user._id);
  const weekData = getWeekSales(user._id);
  const color = avatarColor(user.name);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try { await deleteUser(user._id); onDeleted(); }
    catch { setDeleting(false); setConfirm(false); }
  };

  return (
    <div style={{ width: 320, borderLeft: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>{initials(user.name)}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{user.name}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Caissier · {extra.caisse}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
          <I d={D.close} size={16}/>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Ventes / 30j',  value: extra.ventes.toString(),          unit: 'tickets' },
            { label: 'CA / 30j',      value: fmtN(extra.ventes * extra.panier), unit: 'XAF'    },
            { label: 'Panier moyen',  value: fmtN(extra.panier),               unit: 'XAF'    },
            { label: 'Note',          value: `${extra.stars} / 5`,             unit: '★★★★★'.slice(0, extra.stars) },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--fs-ivory)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{k.value}</div>
              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{k.unit}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Ventes 7 derniers jours</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weekData} barSize={24}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false}/>
            <YAxis hide/>
            <Tooltip formatter={(v: number) => [`${v} ventes`, '']} contentStyle={{ fontSize: 11, border: '1px solid var(--fs-line)', borderRadius: 8 }}/>
            <Bar dataKey="ventes" radius={[4,4,0,0]}>
              {weekData.map((_, i) => <Cell key={i} fill={i === 5 || i === 6 ? '#D1A660' : 'var(--fs-wine-700)'}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--fs-ink-400)' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--fs-wine-700)', borderRadius: 2, marginRight: 4 }}/>Semaine &nbsp;
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#D1A660', borderRadius: 2, marginRight: 4, marginLeft: 8 }}/>Week-end
        </div>
      </div>

      {/* Actions */}
      {!confirm ? (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onEdit} style={{ flex: 1, padding: '9px', border: '1.5px solid var(--fs-wine-700)', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', color: 'var(--fs-wine-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <I d={D.edit} size={12}/> Modifier
          </button>
          <button onClick={() => setConfirm(true)} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <I d={D.trash} size={12}/> Supprimer
          </button>
        </div>
      ) : (
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--fs-line)', flexShrink: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-700)', margin: '0 0 10px' }}>Supprimer <strong>{user.name}</strong> ? Cette action est irréversible.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: '9px', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)' }}>Annuler</button>
            <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-700)', color: '#fff', opacity: deleting ? 0.7 : 1 }}>
              {deleting ? 'Suppression…' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit panel ───────────────────────────────────────────────────────────────

function EditPanel({ user, onSaved, onCancel }: {
  user: UserRecord; onSaved: () => void; onCancel: () => void;
}) {
  const nameParts = user.name.split(' ');
  const [prenom, setPrenom] = useState(nameParts[0] ?? '');
  const [nom, setNom]       = useState(nameParts.slice(1).join(' ') ?? '');
  const [caisse, setCaisse] = useState(CAISSES[0]);
  const [pin, setPin]       = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    const fullName = `${prenom} ${nom}`.trim();
    if (!fullName) { setError('Le nom est obligatoire.'); return; }
    setLoading(true); setError('');
    try {
      const patch: { name?: string; password?: string } = {};
      if (fullName !== user.name) patch.name = fullName;
      if (pin.length === 4) patch.password = pin;
      if (Object.keys(patch).length > 0) await updateUser(user._id, patch);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ width: 320, borderLeft: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Modification</div>
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

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Poste</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Caisse assignée</label>
          <select value={caisse} onChange={e => setCaisse(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
            {CAISSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Réinitialiser le PIN</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Nouveau code PIN (4 chiffres)</label>
          <div style={{ position: 'relative' }}>
            <input type={showPin ? 'text' : 'password'} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4} placeholder="Laisser vide pour ne pas changer"
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: pin ? 18 : 13, outline: 'none', boxSizing: 'border-box', letterSpacing: pin ? '0.3em' : 0, fontFamily: 'var(--fs-font-mono)' }}/>
            <button onClick={() => setShowPin(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
              <I d={D.eye} size={14}/>
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}>Annuler</button>
        <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-wine-700)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ── Create panel ─────────────────────────────────────────────────────────────

function CreatePanel({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ prenom: '', nom: '', phone: '', email: '', caisse: CAISSES[0], dateEmb: new Date().toISOString().slice(0, 10), pin: '' });
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const identifiant = form.prenom && form.nom ? `${form.prenom.toLowerCase()}.${form.nom.toLowerCase().slice(0,1)}` : '';

  const handleCreate = async () => {
    if (!form.prenom || !form.nom) { setError('Prénom et nom obligatoires.'); return; }
    if (form.pin.length !== 4) { setError('Le code PIN doit contenir 4 chiffres.'); return; }
    setLoading(true); setError('');
    try {
      await createUser({
        name: `${form.prenom} ${form.nom}`,
        email: form.email || `${identifiant}@familystore.cm`,
        password: form.pin,
        role: 'caissier',
        phone: form.phone || undefined,
      });
      onCreated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ width: 320, borderLeft: '1px solid var(--fs-line)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>+ Nouveau caissier</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Créer un compte caissier</div>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
          <I d={D.close} size={16}/>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Identité</p>
        <Field label="Prénom" value={form.prenom} onChange={v => set('prenom', v)} placeholder="Esther"/>
        <Field label="Nom" value={form.nom} onChange={v => set('nom', v)} placeholder="Bidias"/>
        <Field label="Téléphone" value={form.phone} onChange={v => set('phone', v)} placeholder="+237 6 91 23 45 67"/>
        <Field label="Email" value={form.email} onChange={v => set('email', v)} placeholder="esther.b@familystore.cm"/>

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Poste</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Caisse assignée</label>
          <select value={form.caisse} onChange={e => set('caisse', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
            {CAISSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Field label="Date d'embauche" value={form.dateEmb} onChange={v => set('dateEmb', v)} type="date"/>

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0 0' }}>Accès caisse</p>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Code PIN * (4 chiffres)</label>
          <div style={{ position: 'relative' }}>
            <input type={showPin ? 'text' : 'password'} value={form.pin}
              onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4} placeholder="••••"
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: form.pin ? 20 : 13, outline: 'none', boxSizing: 'border-box', letterSpacing: form.pin ? '0.35em' : 0, fontFamily: 'var(--fs-font-mono)' }}/>
            <button onClick={() => setShowPin(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex' }}>
              <I d={D.eye} size={14}/>
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Identifiant</label>
          <div style={{ padding: '9px 12px', border: '1.5px solid var(--fs-line)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--fs-font-mono)', color: identifiant ? 'var(--fs-ink-700)' : 'var(--fs-ink-300)', background: 'var(--fs-ivory)' }}>
            {identifiant || 'généré automatiquement'}
          </div>
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

// ── Main ─────────────────────────────────────────────────────────────────────

type PanelMode = { type: 'create' } | { type: 'stats'; user: UserRecord } | { type: 'edit'; user: UserRecord } | null;

export default function AdminCaissiers() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [panel, setPanel] = useState<PanelMode>(null);

  const load = () => getUsers().then(us => setUsers(us.filter(u => u.role !== 'patron'))).catch(() => {});
  useEffect(() => { load(); }, []);

  const mockUsers: UserRecord[] = [
    { _id: '1', name: 'Aïcha Nguemo',  email: 'aicha@fs.cm', role: 'caissier' },
    { _id: '2', name: 'Marie Tchapda', email: 'marie@fs.cm', role: 'caissier' },
    { _id: '4', name: 'Jean Domkam',   email: 'jean@fs.cm',  role: 'caissier' },
    { _id: '5', name: 'Fatou Kouassi', email: 'fatou@fs.cm', role: 'caissier' },
  ];
  const allStaff = users.length > 0 ? users : mockUsers;
  const staff = allStaff.filter(u => u.role === 'caissier');

  const selectedId = panel && panel.type !== 'create' ? panel.user._id : null;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Personnel — Caissiers</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Caissiers · {staff.length} comptes</h1>
            </div>
            <button onClick={() => setPanel({ type: 'create' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <I d={D.plus} size={13}/> Ajouter un caissier
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {staff.map(u => (
                <CaissierCard
                  key={u._id}
                  user={u}
                  selected={selectedId === u._id}
                  onStats={() => setPanel({ type: 'stats', user: u })}
                  onEdit={() => setPanel({ type: 'edit', user: u })}
                  onDelete={() => setPanel({ type: 'stats', user: u })}
                />
              ))}
            </div>
          </div>

          {/* Right panel */}
          {panel?.type === 'create' && (
            <CreatePanel onCreated={() => { load(); setPanel(null); }} onCancel={() => setPanel(null)}/>
          )}
          {panel?.type === 'stats' && (
            <StatsPanel
              user={panel.user}
              onClose={() => setPanel(null)}
              onEdit={() => setPanel({ type: 'edit', user: panel.user })}
              onDeleted={() => { load(); setPanel(null); }}
            />
          )}
          {panel?.type === 'edit' && (
            <EditPanel
              user={panel.user}
              onSaved={() => { load(); setPanel(null); }}
              onCancel={() => setPanel(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
