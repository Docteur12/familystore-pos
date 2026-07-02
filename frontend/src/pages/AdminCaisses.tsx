import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import {
  getCaisses, createCaisse, updateCaisse, deleteCaisse, CaisseRecord,
} from '../api/caisses';
import { getUsers, UserRecord } from '../api/auth';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Icons ─────────────────────────────────────────────────────────────────────

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const D = {
  plus:    'M12 5v14M5 12h14',
  edit:    'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:   'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  close:   'M18 6L6 18M6 6l12 12',
  eye:     'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:  'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
  key:     'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  user:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  caisse:  'M3 3h18v5H3zM3 8h18v13H3zM8 12h2M12 12h4M8 16h2M12 16h4',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)',
  textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5,
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)',
  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--fs-font-sans)', background: '#fff',
};

const CODE_COLORS: Record<string, string> = {
  C01: 'var(--fs-wine-700)', C02: '#1D4E7A', C03: '#1D7A4E', C04: '#7A5C1D',
  C05: '#5C1D7A', C06: '#1D6B7A', C07: '#7A3B1D', C08: '#3B7A1D',
};
function codeColor(code: string) { return CODE_COLORS[code] ?? '#4A4A6A'; }

function Field({ label, value, onChange, type = 'text', placeholder = '', maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        style={INPUT}
      />
    </div>
  );
}

// ── Caisse card ───────────────────────────────────────────────────────────────

function CaisseCard({ caisse, assignedCount, selected, onEdit }: {
  caisse: CaisseRecord;
  assignedCount: number;
  selected: boolean;
  onEdit: () => void;
}) {
  const [showPin, setShowPin] = useState(false);
  const color = codeColor(caisse.code);

  return (
    <div style={{
      background: '#fff',
      border: selected ? '2.5px solid var(--fs-wine-700)' : '1px solid var(--fs-line)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: selected ? '0 0 0 3px rgba(122,29,46,0.08)' : 'var(--fs-shadow-sm)',
      transition: 'all 0.15s',
      cursor: 'pointer',
    }} onClick={onEdit}>

      {/* Bandeau coloré */}
      <div style={{ background: color, padding: '16px 18px 14px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: 'var(--fs-font-mono)', fontSize: 28, fontWeight: 900,
              color: '#fff', letterSpacing: '0.06em', lineHeight: 1,
            }}>
              {caisse.code}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
              {caisse.nom}
            </div>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.9)',
          }}>
            <I d={D.caisse} size={18}/>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div style={{ padding: '14px 18px' }}>

        {/* PIN */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
              Code PIN
            </div>
            <div style={{
              fontFamily: 'var(--fs-font-mono)', fontSize: 18, fontWeight: 800,
              color: 'var(--fs-ink-900)', letterSpacing: showPin ? '0.2em' : '0.4em',
            }}>
              {showPin ? caisse.pin : '••••'}
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setShowPin(v => !v); }}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1.5px solid var(--fs-line-2)',
              background: showPin ? 'var(--fs-wine-50)' : '#fff',
              color: showPin ? 'var(--fs-wine-700)' : 'var(--fs-ink-400)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={showPin ? 'Masquer le PIN' : 'Afficher le PIN'}
          >
            <I d={showPin ? D.eyeOff : D.eye} size={13}/>
          </button>
        </div>

        {/* Infos bas */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, background: 'var(--fs-ivory)', borderRadius: 8, padding: '7px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <I d={D.user} size={11}/>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-700)' }}>
              {assignedCount} caissier{assignedCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{
            flex: 1, background: 'var(--fs-ivory)', borderRadius: 8, padding: '7px 10px',
            display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {caisse.ville}
            </span>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        borderTop: '1px solid var(--fs-line)',
        padding: '8px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
      }}>
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', border: '1.5px solid var(--fs-wine-700)',
            borderRadius: 7, background: '#fff', color: 'var(--fs-wine-700)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <I d={D.edit} size={11}/> Modifier
        </button>
      </div>
    </div>
  );
}

// ── Form panel (create + edit) ────────────────────────────────────────────────

function CaissePanel({ caisse, onSaved, onCancel, isNarrow }: {
  caisse: CaisseRecord | null;
  onSaved: () => void;
  onCancel: () => void;
  isNarrow: boolean;
}) {
  const isEdit = caisse !== null;
  const { addToast } = useToast();

  const [nom,     setNom]     = useState(caisse?.nom   ?? '');
  const [code,    setCode]    = useState(caisse?.code  ?? '');
  const [pin,     setPin]     = useState(caisse?.pin   ?? '');
  const [ville,   setVille]   = useState(caisse?.ville ?? 'Douala');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    if (!nom.trim())  { setError('Le nom est obligatoire.');               return; }
    if (!code.trim()) { setError('Le code est obligatoire.');              return; }
    if (!isEdit && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
      setError('Le code PIN doit être composé de 4 chiffres.'); return;
    }
    if (isEdit && pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
      setError('Le code PIN doit être composé de 4 chiffres.'); return;
    }
    setLoading(true); setError('');
    try {
      if (isEdit) {
        const patch: Partial<{ nom: string; pin: string; ville: string }> = {};
        if (nom.trim()   !== caisse!.nom)   patch.nom   = nom.trim();
        if (ville.trim() !== caisse!.ville) patch.ville = ville.trim();
        if (pin && pin !== caisse!.pin)      patch.pin   = pin;
        if (Object.keys(patch).length > 0) await updateCaisse(caisse!._id, patch);
      } else {
        await createCaisse({ nom: nom.trim(), code: code.trim().toUpperCase(), pin, ville: ville.trim() });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCaisse(caisse!._id);
      addToast(`${caisse!.nom} supprimée`, 'success');
      onSaved();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur suppression', 'error');
      setDeleting(false); setConfirm(false);
    }
  };

  return (
    <div style={{
      width: isNarrow ? '100%' : 340, borderLeft: isNarrow ? 'none' : '1px solid var(--fs-line)',
      borderTop: isNarrow ? '1px solid var(--fs-line)' : undefined, background: '#fff',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--fs-line)',
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            {isEdit ? 'Modifier la caisse' : '+ Nouvelle caisse'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
            {isEdit ? caisse!.nom : 'Créer une caisse'}
          </div>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fs-ink-400)', display: 'flex', padding: 4 }}>
          <I d={D.close} size={16}/>
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          Identification
        </p>

        <Field
          label="Nom de la caisse *"
          value={nom}
          onChange={setNom}
          placeholder="Caisse 01"
        />

        <div>
          <label style={LABEL}>Code unique * {isEdit && <span style={{ color: 'var(--fs-ink-300)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(non modifiable)</span>}</label>
          {isEdit ? (
            <div style={{
              padding: '9px 12px', border: '1.5px solid var(--fs-line)',
              borderRadius: 8, fontSize: 13, background: 'var(--fs-ivory)',
              fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)',
            }}>
              {caisse!.code}
            </div>
          ) : (
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              placeholder="C01"
              maxLength={4}
              style={{ ...INPUT, fontFamily: 'var(--fs-font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            />
          )}
          {!isEdit && (
            <p style={{ fontSize: 11, color: 'var(--fs-ink-300)', margin: '4px 0 0' }}>
              Identifiant court · ex: C01, C05 · max 4 caractères
            </p>
          )}
        </div>

        <Field
          label="Ville / Emplacement"
          value={ville}
          onChange={setVille}
          placeholder="Akwa, Douala"
        />

        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '4px 0 0' }}>
          Accès
        </p>

        <div>
          <label style={LABEL}>
            Code PIN (4 chiffres){isEdit && ' — laisser vide pour ne pas changer'}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              placeholder={isEdit ? '••••' : '1234'}
              style={{
                ...INPUT,
                paddingRight: 40,
                fontFamily: pin ? 'var(--fs-font-mono)' : undefined,
                fontSize: pin && !showPin ? 20 : 13,
                letterSpacing: pin && !showPin ? '0.4em' : undefined,
              }}
            />
            <button
              onClick={() => setShowPin(v => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--fs-ink-400)', display: 'flex',
              }}
            >
              <I d={showPin ? D.eyeOff : D.eye} size={14}/>
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--fs-ink-300)', margin: '4px 0 0' }}>
            Ce code est demandé aux caissiers à chaque session.
          </p>
        </div>

        {/* Aperçu caisse */}
        {(nom || code) && (
          <div style={{
            background: codeColor(code || 'C01') + '12',
            border: `1.5px solid ${codeColor(code || 'C01')}30`,
            borderRadius: 10, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: codeColor(code || 'C01'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--fs-font-mono)', fontSize: 13, fontWeight: 900, color: '#fff' }}>
                {code || '??'}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{nom || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 1 }}>{ville} · PIN: {pin ? (showPin ? pin : '••••') : '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!confirm ? (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
          {isEdit && (
            <button
              onClick={() => setConfirm(true)}
              style={{ padding: '10px 14px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', display: 'flex', alignItems: 'center' }}
            >
              <I d={D.trash} size={12}/>
            </button>
          )}
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: 'var(--fs-ink-500)' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-wine-700)', color: '#fff', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (isEdit ? 'Enregistrement…' : 'Création…') : (isEdit ? 'Enregistrer' : 'Créer la caisse')}
          </button>
        </div>
      ) : (
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--fs-line)', flexShrink: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-700)', margin: '0 0 4px' }}>
            Supprimer <strong>{caisse!.nom}</strong> ?
          </p>
          <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '0 0 12px' }}>
            Les caissiers assignés à cette caisse perdront leur accès PIN.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: '9px', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)' }}>
              Annuler
            </button>
            <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--fs-danger-700)', color: '#fff', opacity: deleting ? 0.7 : 1 }}>
              {deleting ? '…' : 'Supprimer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type PanelMode = { type: 'create' } | { type: 'edit'; caisse: CaisseRecord } | null;

export default function AdminCaisses() {
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);
  const { toasts, addToast, removeToast } = useToast();
  const [caisses,  setCaisses]  = useState<CaisseRecord[]>([]);
  const [users,    setUsers]    = useState<UserRecord[]>([]);
  const [panel,    setPanel]    = useState<PanelMode>(null);
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([getCaisses(), getUsers()]);
      setCaisses(c);
      setUsers(u);
    } catch {
      addToast('Erreur chargement des caisses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const countAssigned = (caisseId: string) =>
    users.filter(u => u.caisseId === caisseId).length;

  const selectedCode = panel?.type === 'edit' ? panel.caisse.code : null;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 16 }}>
            <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>
                Système — Infrastructure
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
                Caisses · {caisses.length} {caisses.length !== 1 ? 'terminaux' : 'terminal'}
              </h1>
            </div>
            <button
              onClick={() => setPanel({ type: 'create' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <I d={D.plus} size={13}/> Ajouter une caisse
            </button>
          </div>
        </div>

        {/* Résumé stats */}
        <div style={{ padding: isNarrow ? '16px 16px 0' : '16px 28px 0', display: 'flex', flexWrap: 'wrap', gap: 12, flexShrink: 0 }}>
          {[
            { label: 'Terminaux actifs',  value: caisses.length.toString(),                  color: 'var(--fs-wine-700)' },
            { label: 'Caissiers assignés', value: users.filter(u => u.caisseId).length.toString(), color: '#16a34a'        },
            { label: 'Sans caisse',        value: users.filter(u => u.role === 'caissier' && !u.caisseId).length.toString(), color: '#c2410c' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'var(--fs-font-mono)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: isNarrow ? 'column' : 'row', overflow: isNarrow ? 'visible' : 'hidden' }}>
          {/* Grille */}
          <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', padding: isNarrow ? '20px 16px' : '20px 28px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13, padding: '60px 0' }}>
                Chargement…
              </div>
            ) : caisses.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13, padding: '60px 0' }}>
                <I d={D.caisse} size={40}/><br/><br/>
                Aucun terminal — cliquez sur <strong>Ajouter une caisse</strong> pour créer le premier.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {caisses.map(c => (
                  <CaisseCard
                    key={c._id}
                    caisse={c}
                    assignedCount={countAssigned(c._id)}
                    selected={selectedCode === c.code}
                    onEdit={() => setPanel({ type: 'edit', caisse: c })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Panel latéral */}
          {panel?.type === 'create' && (
            <CaissePanel
              caisse={null}
              onSaved={() => { load(); setPanel(null); addToast('Caisse créée ✅', 'success'); }}
              onCancel={() => setPanel(null)}
              isNarrow={isNarrow}
            />
          )}
          {panel?.type === 'edit' && (
            <CaissePanel
              caisse={panel.caisse}
              onSaved={() => { load(); setPanel(null); addToast('Modifications enregistrées ✅', 'success'); }}
              onCancel={() => setPanel(null)}
              isNarrow={isNarrow}
            />
          )}
        </div>
      </main>
    </div>
  );
}
