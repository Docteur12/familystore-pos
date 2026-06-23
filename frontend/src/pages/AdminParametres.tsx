import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { updateUser } from '../api/auth';
import { getTokenPayload } from '../api/dashboard';
import { getSettings, updateSettings, SETTINGS_DEFAULTS, StoreSettings, applyPrimaryColor } from '../api/settings';
import { useSettings } from '../contexts/SettingsContext';
import { getPendingSales, getLastSyncTime, syncPendingSales } from '../services/offlineSync';
import { getPrintSettings, savePrintSettings, PrintSettings } from '../components/ReceiptPrint';
import { getCategoryTree, importCategories } from '../api/categories';
import { resetEntrepot } from '../api/magazinier';
import { authHeaders } from '../api/http';

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
  devise: string;
  logoUrl: string;
  ouverture: string;
  fermeture: string;
  facebook: string;
  whatsapp: string;
  langue: string;
  couleurPrincipale: string;
}

function toSForm(s: StoreSettings): SForm {
  return {
    nomMagasin:        s.nomMagasin,
    adresse:           s.adresse,
    ville:             s.ville,
    telephone:         s.telephone,
    email:             s.email,
    devise:            s.devise,
    logoUrl:           s.logoUrl,
    ouverture:         s.horaires?.ouverture ?? '08:00',
    fermeture:         s.horaires?.fermeture ?? '20:00',
    facebook:          s.reseauxSociaux?.facebook ?? '',
    whatsapp:          s.reseauxSociaux?.whatsapp ?? '',
    langue:            s.langue ?? 'fr',
    couleurPrincipale: s.couleurPrincipale ?? '#FF0000',
  };
}

function fromSForm(f: SForm): Partial<StoreSettings> {
  return {
    nomMagasin: f.nomMagasin.trim(),
    adresse:    f.adresse.trim(),
    ville:      f.ville.trim(),
    telephone:  f.telephone.trim(),
    email:      f.email.trim(),
    devise:     f.devise.trim() || 'XAF',
    logoUrl:    f.logoUrl,
    horaires:   { ouverture: f.ouverture, fermeture: f.fermeture },
    reseauxSociaux:    { facebook: f.facebook.trim(), whatsapp: f.whatsapp.trim() },
    langue:            f.langue,
    couleurPrincipale: f.couleurPrincipale || '#FF0000',
  };
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminParametres() {
  const { reloadSettings } = useSettings();
  const { toasts, addToast, removeToast } = useToast();

  // ── Catégories (taxonomie éditable via CSV) ────────────────────────────────
  const catFileRef = useRef<HTMLInputElement>(null);
  const [catBusy, setCatBusy] = useState(false);

  const parseCatLine = (line: string): string[] => {
    const out: string[] = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ';' || c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out;
  };

  const exportCatCsv = async () => {
    try {
      const tree = await getCategoryTree();
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const rows = ['Catégorie;Sous-catégorie'];
      for (const [cat, subs] of Object.entries(tree)) {
        if (!subs.length) rows.push(`${esc(cat)};${esc('')}`);
        else subs.forEach(s => rows.push(`${esc(cat)};${esc(s)}`));
      }
      const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `categories_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { addToast('Erreur export catégories', 'error'); }
  };

  const importCatCsv = async (file: File) => {
    setCatBusy(true);
    try {
      const text = (await file.text()).replace(/^﻿/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const rows = lines.slice(1)
        .map(l => parseCatLine(l))
        .map(c => ({ category: (c[0] || '').trim(), subCategory: (c[1] || '').trim() }))
        .filter(r => r.category);
      if (rows.length === 0) { addToast('CSV vide ou invalide', 'error'); return; }
      const { count } = await importCategories(rows);
      addToast(`Catégories actualisées : ${count} ligne(s)`, 'success');
    } catch {
      addToast('Erreur import — vérifiez le CSV (Catégorie ; Sous-catégorie)', 'error');
    } finally {
      setCatBusy(false);
      if (catFileRef.current) catFileRef.current.value = '';
    }
  };

  // ── Réinitialisation ─────────────────────────────────────────────────────
  const [resetLoading, setResetLoading] = useState(false);
  const [resetText,    setResetText]    = useState('');   // mot-clé « TOUT SUPPRIMER »
  // Réinitialisation du magazin (entrepôt) — déplacée ici depuis la page Magaziniers.
  const [magResetText,    setMagResetText]    = useState('');
  const [magResetLoading, setMagResetLoading] = useState(false);
  const [magResetDone,    setMagResetDone]    = useState(false);
  const handleResetMagazin = async () => {
    if (magResetText.trim().toUpperCase() !== 'RÉINITIALISER') return;
    setMagResetLoading(true);
    try { await resetEntrepot(); setMagResetDone(true); setMagResetText(''); addToast('Stock entrepôt réinitialisé', 'success'); }
    catch { addToast('Erreur lors de la réinitialisation de l\'entrepôt', 'error'); }
    finally { setMagResetLoading(false); }
  };
  const [cleanLoading, setCleanLoading] = useState(false);
  const [cleanDone,    setCleanDone]    = useState(false);
  const [cleanText,    setCleanText]    = useState('');   // mot-clé « NETTOYER »

  const handleCleanTransactions = async () => {
    if (cleanText.trim().toUpperCase() !== 'NETTOYER') return;
    setCleanLoading(true);
    try {
      const res = await fetch('/api/admin/clean-transactions', { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error('Erreur serveur');
      setCleanDone(true);
      addToast('Ventes et sessions de test supprimées — produits conservés ✓', 'success');
    } catch {
      addToast('Erreur lors du nettoyage', 'error');
    } finally {
      setCleanLoading(false);
    }
  };

  const handleReset = async () => {
    if (resetText.trim().toUpperCase() !== 'TOUT SUPPRIMER') return;
    setResetLoading(true);
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error('Erreur serveur');
      addToast('Base réinitialisée — bienvenue en production !', 'success');
      setResetText('');
      setTimeout(() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }, 2000);
    } catch {
      addToast('Erreur lors de la réinitialisation', 'error');
    } finally {
      setResetLoading(false);
    }
  };

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

          {/* ── Couleur principale ───────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Couleur de la boutique</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: form.couleurPrincipale || 'var(--fs-wine-700)', border: '2px solid var(--fs-line-2)', overflow: 'hidden', cursor: 'pointer' }}>
                  <input
                    type="color"
                    value={form.couleurPrincipale || '#FF0000'}
                    onChange={e => {
                      mkChange('couleurPrincipale')(e.target.value);
                      if (typeof applyPrimaryColor === 'function') applyPrimaryColor(e.target.value);
                    }}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>Code couleur hex</label>
                <input
                  type="text"
                  value={form.couleurPrincipale || '#FF0000'}
                  onChange={e => {
                    mkChange('couleurPrincipale')(e.target.value);
                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value) && typeof applyPrimaryColor === 'function') applyPrimaryColor(e.target.value);
                  }}
                  placeholder="#FF0000"
                  style={{ ...INPUT_STYLE, fontFamily: 'var(--fs-font-mono)', width: 130 }}
                />
                <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '6px 0 0' }}>
                  S'applique sur toute l'interface — boutons, sidebar, en-têtes.
                </p>
              </div>
              <button onClick={() => { mkChange('couleurPrincipale')('#FF0000'); if (typeof applyPrimaryColor === 'function') applyPrimaryColor('#FF0000'); }}
                style={{ padding: '7px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)' }}>
                Défaut
              </button>
            </div>
          </div>

          {/* ── Catégories de produits (éditable sans code) ──────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>Catégories de produits</p>
            <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Gérez les catégories et sous-catégories <strong>sans toucher au code</strong> : exportez le CSV, éditez-le dans Excel
              (2 colonnes : <em>Catégorie ; Sous-catégorie</em>, une ligne par sous-catégorie), puis réimportez pour <strong>actualiser le serveur</strong>.
              L'import <strong>remplace</strong> toute la liste. (Les administrateurs peuvent aussi ajouter une catégorie directement depuis la fiche produit, via « Autre… ».)
            </p>
            <input ref={catFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importCatCsv(f); }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={exportCatCsv}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-ink-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ⬇ Exporter (CSV)
              </button>
              <button onClick={() => catFileRef.current?.click()} disabled={catBusy}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: catBusy ? 'default' : 'pointer', opacity: catBusy ? 0.6 : 1 }}>
                ⬆ {catBusy ? 'Import…' : 'Importer (CSV)'}
              </button>
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
            <p style={SECTION_TITLE}>Monnaie</p>
            <Field label="Devise" value={form.devise} onChange={mkChange('devise')} placeholder="XAF"/>
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

          {/* ── Zone de danger : réinitialisation ── */}
          <div style={{ marginTop: 32, border: '2px solid #fca5a5', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#fef2f2', padding: '14px 20px', borderBottom: '1px solid #fca5a5' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#991b1b', letterSpacing: '0.05em' }}>
                ⚠️ ZONE DE DANGER — Mise en production
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>
                Actions irréversibles.
              </p>
            </div>
            <div style={{ padding: '16px 20px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ── Nettoyage données test (garde produits) ── */}
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C2410C' }}>🧹 Nettoyer les données de test</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fs-ink-600)', lineHeight: 1.5 }}>
                    Supprime : <strong>ventes · factures · sessions · mouvements · dépenses · logs</strong><br/>
                    Conserve : <strong>produits · caissiers · gestionnaires · caisses</strong>
                  </p>
                </div>
                {cleanDone ? (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ Nettoyage effectué avec succès</p>
                ) : (
                  <>
                    <input value={cleanText} onChange={e => setCleanText(e.target.value)} placeholder="Tapez NETTOYER pour confirmer"
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box' }}/>
                    <button onClick={handleCleanTransactions} disabled={cleanLoading || cleanText.trim().toUpperCase() !== 'NETTOYER'}
                      style={{ alignSelf: 'flex-start', padding: '9px 18px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (cleanLoading || cleanText.trim().toUpperCase() !== 'NETTOYER') ? 'not-allowed' : 'pointer', opacity: (cleanLoading || cleanText.trim().toUpperCase() !== 'NETTOYER') ? 0.5 : 1 }}>
                      {cleanLoading ? 'Nettoyage…' : 'Supprimer les données de test uniquement'}
                    </button>
                  </>
                )}
              </div>

              <div style={{ borderTop: '1px solid #fca5a5' }}/>

              {/* ── Réinitialiser le magazin (entrepôt) ── */}
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C2410C' }}>📦 Réinitialiser le magazin (entrepôt)</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fs-ink-600)', lineHeight: 1.5 }}>
                    Remet à <strong>zéro le stock entrepôt</strong> de tous les produits et <strong>supprime l'historique des réceptions</strong>.<br/>
                    N'affecte <strong>pas</strong> le stock caisse, les ventes ni les produits.
                  </p>
                </div>
                {magResetDone ? (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ Magazin réinitialisé</p>
                ) : (
                  <>
                    <input value={magResetText} onChange={e => setMagResetText(e.target.value)} placeholder="Tapez RÉINITIALISER pour confirmer"
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box' }}/>
                    <button onClick={handleResetMagazin} disabled={magResetLoading || magResetText.trim().toUpperCase() !== 'RÉINITIALISER'}
                      style={{ alignSelf: 'flex-start', padding: '9px 18px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (magResetLoading || magResetText.trim().toUpperCase() !== 'RÉINITIALISER') ? 'not-allowed' : 'pointer', opacity: (magResetLoading || magResetText.trim().toUpperCase() !== 'RÉINITIALISER') ? 0.5 : 1 }}>
                      {magResetLoading ? 'Réinitialisation…' : 'Réinitialiser le magazin'}
                    </button>
                  </>
                )}
              </div>

              <div style={{ borderTop: '1px solid #fca5a5' }}/>

              <div style={{ fontSize: 12, color: 'var(--fs-ink-600)', lineHeight: 1.6 }}>
                <strong>Réinitialisation complète :</strong> supprime <strong>tout</strong> y compris les produits · caissiers · gestionnaires.<br/>
                Conserve : votre compte <strong>Admin Patron</strong> + configuration des caisses.
              </div>

              <input value={resetText} onChange={e => setResetText(e.target.value)} placeholder="Tapez TOUT SUPPRIMER pour confirmer"
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box' }}/>
              <button onClick={handleReset} disabled={resetLoading || resetText.trim().toUpperCase() !== 'TOUT SUPPRIMER'}
                style={{ alignSelf: 'flex-start', padding: '10px 20px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: (resetLoading || resetText.trim().toUpperCase() !== 'TOUT SUPPRIMER') ? 'not-allowed' : 'pointer', opacity: (resetLoading || resetText.trim().toUpperCase() !== 'TOUT SUPPRIMER') ? 0.5 : 1 }}>
                {resetLoading ? 'Réinitialisation en cours…' : '🗑️ Réinitialiser pour la mise en production'}
              </button>
            </div>
          </div>

        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast}/>
    </div>
  );
}
