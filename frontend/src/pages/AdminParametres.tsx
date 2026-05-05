import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { updateUser } from '../api/auth';
import { getTokenPayload } from '../api/dashboard';
import { getSettings, updateSettings, SETTINGS_DEFAULTS, StoreSettings } from '../api/settings';
import { useSettings } from '../contexts/SettingsContext';
import { getPendingSales, getLastSyncTime, syncPendingSales } from '../services/offlineSync';
import { getPrintSettings, savePrintSettings, PrintSettings } from '../components/ReceiptPrint';

// ── Styles partagés ──────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)',
  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--fs-font-sans)', background: '#fff',
};
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)',
  textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5,
};
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-700)',
  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, marginTop: 0,
};

// ── Composants module-level (évite le bug de focus) ──────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}

function Field({ label, value, onChange, type = 'text', placeholder = '', disabled = false }: FieldProps) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ ...INPUT_STYLE, background: disabled ? 'var(--fs-ivory)' : '#fff', color: disabled ? 'var(--fs-ink-400)' : 'var(--fs-ink-900)' }}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...INPUT_STYLE, background: '#fff', cursor: 'pointer' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Formulaire settings ───────────────────────────────────────────────────────

interface SForm {
  nomMagasin: string;
  adresse: string;
  ville: string;
  telephone: string;
  email: string;
  tva: string;
  devise: string;
  logoUrl: string;
  ouverture: string;
  fermeture: string;
  facebook: string;
  whatsapp: string;
  langue: string;
}

function toSForm(s: StoreSettings): SForm {
  return {
    nomMagasin: s.nomMagasin,
    adresse:    s.adresse,
    ville:      s.ville,
    telephone:  s.telephone,
    email:      s.email,
    tva:        String(s.tva),
    devise:     s.devise,
    logoUrl:    s.logoUrl,
    ouverture:  s.horaires?.ouverture ?? '08:00',
    fermeture:  s.horaires?.fermeture ?? '20:00',
    facebook:   s.reseauxSociaux?.facebook ?? '',
    whatsapp:   s.reseauxSociaux?.whatsapp ?? '',
    langue:     s.langue ?? 'fr',
  };
}

function fromSForm(f: SForm): Partial<StoreSettings> {
  return {
    nomMagasin: f.nomMagasin.trim(),
    adresse:    f.adresse.trim(),
    ville:      f.ville.trim(),
    telephone:  f.telephone.trim(),
    email:      f.email.trim(),
    tva:        parseFloat(f.tva) || 0,
    devise:     f.devise.trim() || 'XAF',
    logoUrl:    f.logoUrl,
    horaires:   { ouverture: f.ouverture, fermeture: f.fermeture },
    reseauxSociaux: { facebook: f.facebook.trim(), whatsapp: f.whatsapp.trim() },
    langue:     f.langue,
  };
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminParametres() {
  const { reloadSettings } = useSettings();
  const { toasts, addToast, removeToast } = useToast();

  // ── Sync status ──────────────────────────────────────────────────────────
  const [syncPending,  setSyncPending]  = useState(0);
  const [lastSync,     setLastSync]     = useState<Date | null>(null);
  const [isSyncing,    setIsSyncing]    = useState(false);

  const loadSyncStatus = useCallback(async () => {
    const [pending, last] = await Promise.all([getPendingSales(), getLastSyncTime()]);
    setSyncPending(pending.length);
    setLastSync(last);
  }, []);

  useEffect(() => { loadSyncStatus(); }, [loadSyncStatus]);

  const handleForceSync = useCallback(async () => {
    setIsSyncing(true);
    await syncPendingSales(addToast);
    await loadSyncStatus();
    setIsSyncing(false);
  }, [addToast, loadSyncStatus]);

  function formatLastSync(d: Date | null): string {
    if (!d) return 'Jamais';
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'À l\'instant';
    if (diff === 1) return 'Il y a 1 minute';
    if (diff < 60) return `Il y a ${diff} minutes`;
    const h = Math.floor(diff / 60);
    return `Il y a ${h} heure${h > 1 ? 's' : ''}`;
  }

  // ── Print settings (localStorage) ───────────────────────────────────────
  const [printSettings, setPrintSettings] = useState<PrintSettings>(() => getPrintSettings());

  const updatePrint = useCallback(<K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) => {
    setPrintSettings(prev => {
      const next = { ...prev, [k]: v };
      savePrintSettings(next);
      return next;
    });
  }, []);

  // ── Settings form ────────────────────────────────────────────────────────
  const [form, setForm]       = useState<SForm>(toSForm(SETTINGS_DEFAULTS));
  const [sLoading, setSLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(s => setForm(toSForm(s))).catch(() => {});
  }, []);

  // useCallback pour chaque champ — évite les re-renders et closures périmées
  const setField = useCallback(<K extends keyof SForm>(k: K, v: SForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
  }, []);

  const mkChange = useCallback((k: keyof SForm) => (v: string) => setField(k, v), [setField]);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Logo trop lourd (max 500 Ko)'); return; }
    const reader = new FileReader();
    reader.onload = ev => setField('logoUrl', ev.target?.result as string ?? '');
    reader.readAsDataURL(file);
  }, [setField]);

  const handleSaveSettings = useCallback(async () => {
    setSLoading(true);
    try {
      await updateSettings(fromSForm(form));
      reloadSettings();
      addToast('Paramètres sauvegardés ✅', 'success');
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur sauvegarde', 'error');
    } finally { setSLoading(false); }
  }, [form, reloadSettings, addToast]);

  // ── Mon compte ───────────────────────────────────────────────────────────
  const payload   = getTokenPayload();
  const nameParts = (payload?.name ?? 'Patron').split(' ');

  const [accPrenom,  setAccPrenom]  = useState(nameParts[0] ?? '');
  const [accNom,     setAccNom]     = useState(nameParts.slice(1).join(' ') ?? '');
  const [accPwd,     setAccPwd]     = useState('');
  const [accPwd2,    setAccPwd2]    = useState('');
  const [accError,   setAccError]   = useState('');
  const [accLoading, setAccLoading] = useState(false);

  const handleAccSave = useCallback(async () => {
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
      setAccPwd(''); setAccPwd2('');
      addToast('Compte mis à jour ✅', 'success');
    } catch (e: unknown) {
      setAccError(e instanceof Error ? e.message : 'Erreur');
    } finally { setAccLoading(false); }
  }, [accPrenom, accNom, accPwd, accPwd2, payload, addToast]);

  const onAccPrenom = useCallback((v: string) => setAccPrenom(v), []);
  const onAccNom    = useCallback((v: string) => setAccNom(v), []);
  const onAccPwd    = useCallback((v: string) => setAccPwd(v), []);
  const onAccPwd2   = useCallback((v: string) => setAccPwd2(v), []);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Système</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Paramètres magasin</h1>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', maxWidth: 660 }}>

          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Logo du magasin</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed var(--fs-line-2)', background: 'var(--fs-ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {form.logoUrl
                  ? <img src={form.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <span style={{ fontSize: 28 }}>🏪</span>}
              </div>
              <div style={{ flex: 1 }}>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }}/>
                <button onClick={() => logoInputRef.current?.click()}
                  style={{ padding: '8px 18px', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-wine-700)', marginBottom: 6 }}>
                  Choisir un logo
                </button>
                {form.logoUrl && (
                  <button onClick={() => setField('logoUrl', '')}
                    style={{ marginLeft: 8, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-400)' }}>
                    Supprimer
                  </button>
                )}
                <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '4px 0 0' }}>PNG, JPG · max 500 Ko · stocké en base64</p>
              </div>
            </div>
          </div>

          {/* ── Informations générales ────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Informations générales</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Nom du magasin"  value={form.nomMagasin} onChange={mkChange('nomMagasin')} placeholder="Family Store"/>
              <Field label="Adresse"         value={form.adresse}    onChange={mkChange('adresse')}    placeholder="Rue de la Joie, Akwa"/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Ville"         value={form.ville}      onChange={mkChange('ville')}      placeholder="Douala"/>
                <Field label="Téléphone"     value={form.telephone}  onChange={mkChange('telephone')}  placeholder="+237 6XX XXX XXX"/>
              </div>
              <Field label="Email de contact" value={form.email}     onChange={mkChange('email')}      type="email" placeholder="contact@familystore.cm"/>
            </div>
          </div>

          {/* ── Horaires ─────────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Horaires d'ouverture</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Heure d'ouverture" value={form.ouverture} onChange={mkChange('ouverture')} type="time"/>
              <Field label="Heure de fermeture" value={form.fermeture} onChange={mkChange('fermeture')} type="time"/>
            </div>
            <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '10px 0 0' }}>
              Horaires affichés sur les tickets et rapports.
            </p>
          </div>

          {/* ── Fiscal & Monnaie ─────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Fiscal & Monnaie</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Taux TVA (%)" value={form.tva}    onChange={mkChange('tva')}    type="number" placeholder="19.25"/>
              <Field label="Devise"        value={form.devise} onChange={mkChange('devise')} placeholder="XAF"/>
            </div>
          </div>

          {/* ── Langue ───────────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Langue de l'interface</p>
            <SelectField
              label="Langue"
              value={form.langue}
              onChange={mkChange('langue')}
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>

          {/* ── Réseaux sociaux ──────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Réseaux sociaux</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Page Facebook"   value={form.facebook} onChange={mkChange('facebook')} placeholder="https://facebook.com/familystore"/>
              <Field label="WhatsApp Business" value={form.whatsapp} onChange={mkChange('whatsapp')} placeholder="+237 6XX XXX XXX"/>
            </div>
          </div>

          {/* ── Impression des reçus ─────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Impression des reçus</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Toggle impression automatique */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>Impression automatique</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>Imprimer le reçu dès la validation d'une vente</div>
                </div>
                <button
                  onClick={() => updatePrint('auto', !printSettings.auto)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: printSettings.auto ? 'var(--fs-wine-700)' : 'var(--fs-line-2)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: printSettings.auto ? 22 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s',
                  }}/>
                </button>
              </div>

              {/* Nombre de copies */}
              <div>
                <label style={LABEL_STYLE}>Nombre de copies</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2].map(n => (
                    <button
                      key={n}
                      onClick={() => updatePrint('copies', n)}
                      style={{
                        flex: 1, padding: '8px 0', border: printSettings.copies === n ? '2px solid var(--fs-wine-700)' : '1.5px solid var(--fs-line-2)',
                        borderRadius: 8, background: printSettings.copies === n ? 'var(--fs-wine-50)' : '#fff',
                        color: printSettings.copies === n ? 'var(--fs-wine-700)' : 'var(--fs-ink-600)',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {n} copie{n > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle afficher TVA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>Afficher la TVA sur le reçu</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>Affiche le montant TVA incluse (19.25%)</div>
                </div>
                <button
                  onClick={() => updatePrint('showTva', !printSettings.showTva)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: printSettings.showTva ? 'var(--fs-wine-700)' : 'var(--fs-line-2)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: printSettings.showTva ? 22 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s',
                  }}/>
                </button>
              </div>

            </div>
          </div>

          {/* ── Synchronisation hors-ligne ───────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Synchronisation hors-ligne</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--fs-ivory)', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--fs-ink-500)', fontWeight: 500 }}>Dernière synchronisation</span>
                <span style={{ color: 'var(--fs-ink-900)', fontWeight: 600, fontFamily: 'var(--fs-font-mono)' }}>{formatLastSync(lastSync)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: syncPending > 0 ? '#fff7ed' : 'var(--fs-ivory)', borderRadius: 8, fontSize: 13, border: syncPending > 0 ? '1px solid #fed7aa' : 'none' }}>
                <span style={{ color: 'var(--fs-ink-500)', fontWeight: 500 }}>Ventes en attente</span>
                <span style={{ color: syncPending > 0 ? '#c2410c' : '#16a34a', fontWeight: 700, fontFamily: 'var(--fs-font-mono)' }}>
                  {syncPending > 0 ? `${syncPending} vente(s)` : 'Aucune'}
                </span>
              </div>
              <button
                onClick={handleForceSync}
                disabled={isSyncing || syncPending === 0}
                style={{
                  alignSelf: 'flex-start',
                  padding: '9px 22px',
                  background: isSyncing || syncPending === 0 ? 'var(--fs-ink-200)' : 'var(--fs-wine-700)',
                  color: isSyncing || syncPending === 0 ? 'var(--fs-ink-400)' : '#fff',
                  border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700,
                  cursor: isSyncing || syncPending === 0 ? 'not-allowed' : 'pointer',
                }}>
                {isSyncing ? 'Synchronisation…' : 'Forcer la synchronisation'}
              </button>
            </div>
          </div>

          {/* ── Bouton Enregistrer ────────────────────────────────────────── */}
          <button onClick={handleSaveSettings} disabled={sLoading}
            style={{ padding: '11px 32px', background: sLoading ? 'var(--fs-ink-400)' : 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: sLoading ? 'not-allowed' : 'pointer', opacity: sLoading ? 0.8 : 1 }}>
            {sLoading ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>

          {/* ── Mon compte ───────────────────────────────────────────────── */}
          <div style={{ marginTop: 32 }}>
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
              <p style={SECTION_TITLE}>Mon compte</p>
              {accError && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600 }}>{accError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Prénom" value={accPrenom} onChange={onAccPrenom} placeholder="Prénom"/>
                  <Field label="Nom"    value={accNom}    onChange={onAccNom}    placeholder="Nom de famille"/>
                </div>
                <Field label="Email" value={payload?.email ?? ''} onChange={() => {}} disabled placeholder="email@familystore.cm"/>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Nouveau mot de passe"     value={accPwd}  onChange={onAccPwd}  type="password" placeholder="Laisser vide pour ne pas changer"/>
                  <Field label="Confirmer le mot de passe" value={accPwd2} onChange={onAccPwd2} type="password" placeholder="Répéter le mot de passe"/>
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

      <ToastContainer toasts={toasts} onRemove={removeToast}/>
    </div>
  );
}
