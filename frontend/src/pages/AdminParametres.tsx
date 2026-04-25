import React, { useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { updateUser } from '../api/auth';
import { getTokenPayload } from '../api/dashboard';

const LS_KEY = 'fs_parametres';
interface Params { magasin: string; adresse: string; ville: string; telephone: string; email: string; tva: string; devise: string; }
function load(): Params {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {} as Params; }
}

const DEFAULTS: Params = { magasin: 'Family Store', adresse: 'Rue de la Joie, Akwa', ville: 'Douala', telephone: '+237 6XX XXX XXX', email: 'contact@familystore.cm', tva: '19.25', devise: 'XAF' };

export default function AdminParametres() {
  const [form, setForm] = useState<Params>({ ...DEFAULTS, ...load() });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Params, v: string) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = () => { localStorage.setItem(LS_KEY, JSON.stringify(form)); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  // Mon compte (admin)
  const payload = getTokenPayload();
  const nameParts = (payload?.name ?? 'Patron').split(' ');
  const [accPrenom, setAccPrenom] = useState(nameParts[0] ?? '');
  const [accNom, setAccNom]       = useState(nameParts.slice(1).join(' ') ?? '');
  const [accPwd, setAccPwd]       = useState('');
  const [accPwd2, setAccPwd2]     = useState('');
  const [accSaved, setAccSaved]   = useState(false);
  const [accError, setAccError]   = useState('');
  const [accLoading, setAccLoading] = useState(false);

  const handleAccSave = async () => {
    if (!accPrenom) { setAccError('Le prénom est obligatoire.'); return; }
    if (accPwd && accPwd !== accPwd2) { setAccError('Les mots de passe ne correspondent pas.'); return; }
    if (accPwd && accPwd.length < 6) { setAccError('Mot de passe : 6 caractères minimum.'); return; }
    setAccLoading(true); setAccError('');
    try {
      const patch: { name?: string; password?: string } = {};
      const newName = `${accPrenom} ${accNom}`.trim();
      if (newName !== payload?.name) patch.name = newName;
      if (accPwd) patch.password = accPwd;
      if (Object.keys(patch).length > 0 && payload?.sub) {
        await updateUser(payload.sub, patch);
      }
      setAccSaved(true); setAccPwd(''); setAccPwd2('');
      setTimeout(() => setAccSaved(false), 2500);
    } catch (e: unknown) {
      setAccError(e instanceof Error ? e.message : 'Erreur');
    } finally { setAccLoading(false); }
  };

  const Field = ({ label, k, type = 'text' }: { label: string; k: keyof Params; type?: string }) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={form[k]} onChange={e => set(k, e.target.value)}
        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}/>
    </div>
  );

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Système</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Paramètres magasin</h1>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', maxWidth: 640 }}>
          {saved && <div style={{ background: 'var(--fs-success-100)', color: 'var(--fs-success-700)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>Paramètres enregistrés</div>}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Informations générales</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Nom du magasin" k="magasin"/>
              <Field label="Adresse" k="adresse"/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Ville" k="ville"/>
                <Field label="Téléphone" k="telephone"/>
              </div>
              <Field label="Email" k="email" type="email"/>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 20, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Fiscal & Monnaie</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Taux TVA (%)" k="tva" type="number"/>
              <Field label="Devise" k="devise"/>
            </div>
          </div>
          <button onClick={handleSave} style={{ padding: '11px 28px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Enregistrer les modifications
          </button>

          {/* Mon compte */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--fs-wine-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {`${accPrenom[0] ?? ''}${accNom[0] ?? ''}`.toUpperCase() || 'P'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{accPrenom} {accNom}</div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Patron · {payload?.email ?? ''}</div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, marginTop: 0 }}>Mon compte</p>
              {accSaved && <div style={{ background: 'var(--fs-success-100)', color: 'var(--fs-success-700)', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600 }}>Compte mis à jour</div>}
              {accError && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600 }}>{accError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[{ label: 'Prénom', val: accPrenom, set: setAccPrenom }, { label: 'Nom', val: accNom, set: setAccNom }].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                      <input value={f.val} onChange={e => f.set(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}/>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[{ label: 'Nouveau mot de passe', val: accPwd, set: setAccPwd }, { label: 'Confirmer le mot de passe', val: accPwd2, set: setAccPwd2 }].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                      <input type="password" value={f.val} onChange={e => f.set(e.target.value)} placeholder="Laisser vide pour ne pas changer"
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}/>
                    </div>
                  ))}
                </div>
                <button onClick={handleAccSave} disabled={accLoading}
                  style={{ alignSelf: 'flex-start', padding: '10px 24px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: accLoading ? 0.7 : 1 }}>
                  {accLoading ? 'Enregistrement…' : 'Mettre à jour mon compte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
