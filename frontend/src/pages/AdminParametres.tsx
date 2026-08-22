import { deconnexion } from '../services/session';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { updateUser } from '../api/auth';
import { getTokenPayload } from '../api/dashboard';
import { getSettings, updateSettings, SETTINGS_DEFAULTS, StoreSettings, applyPrimaryColor, applySecondaryColor, OffreFacture, OFFRE_DEFAULTS, MODULES_DISPONIBLES, ModuleId, MODULE_AUCUN, METIER_DEFAULTS } from '../api/settings';
import { useSettings } from '../contexts/SettingsContext';
import { getPendingSales, getLastSyncTime, syncPendingSales } from '../services/offlineSync';
import { getPrintSettings, savePrintSettings, PrintSettings } from '../components/ReceiptPrint';
import { getCategoryTree, importCategories } from '../api/categories';
import { resetEntrepot } from '../api/magazinier';
import { authHeaders } from '../api/http';
import { useIsMobile } from '../hooks/useIsMobile';
import { t } from '../i18n';

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
  couleurSecondaire: string;
  // Identité imprimée (tickets, PDF, e-mails)
  slogan: string;
  signatureTicket: string;
  mentionsLegales: string;
  telephonesTicket: string;   // un numéro par ligne
  // Modules et règles métier
  modules: ModuleId[];
  inactiviteMinutes: string;
  seedFournisseursDemo: boolean;
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
    couleurSecondaire: s.couleurSecondaire ?? '#B8893E',
    slogan:            s.slogan ?? '',
    signatureTicket:   s.signatureTicket ?? '',
    mentionsLegales:   s.mentionsLegales ?? '',
    telephonesTicket:  (s.telephonesTicket ?? []).join('\n'),
    // Liste vide côté serveur = tous les modules actifs (rétro-compatibilité)
    modules:           (s.modules && s.modules.length) ? s.modules.filter((x): x is ModuleId => (MODULES_DISPONIBLES as readonly { id: string }[]).some(m => m.id === x)) : MODULES_DISPONIBLES.map(m => m.id),
    inactiviteMinutes: String(s.metier?.inactiviteMinutes ?? METIER_DEFAULTS.inactiviteMinutes),
    seedFournisseursDemo: s.metier?.seedFournisseursDemo ?? METIER_DEFAULTS.seedFournisseursDemo,
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
    couleurSecondaire: f.couleurSecondaire || '#B8893E',
    slogan:            f.slogan.trim(),
    signatureTicket:   f.signatureTicket.trim(),
    mentionsLegales:   f.mentionsLegales.trim(),
    telephonesTicket:  f.telephonesTicket.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
    // [] signifierait « tout actif » (rétro-compat) : « rien » = [MODULE_AUCUN]
    modules:           f.modules.length ? f.modules : [MODULE_AUCUN],
    metier: {
      inactiviteMinutes:    Math.max(1, Math.min(240, Number(f.inactiviteMinutes) || METIER_DEFAULTS.inactiviteMinutes)),
      seedFournisseursDemo: f.seedFournisseursDemo,
    },
  };
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminParametres() {
  const { reloadSettings } = useSettings();
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);

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
      const rows = [t('Catégorie;Sous-catégorie', 'Category;Sub-category')];
      for (const [cat, subs] of Object.entries(tree)) {
        if (!subs.length) rows.push(`${esc(cat)};${esc('')}`);
        else subs.forEach(s => rows.push(`${esc(cat)};${esc(s)}`));
      }
      const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `categories_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { addToast(t('Erreur export catégories', 'Category export error'), 'error'); }
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
      if (rows.length === 0) { addToast(t('CSV vide ou invalide', 'Empty or invalid CSV'), 'error'); return; }
      const { count } = await importCategories(rows);
      addToast(t(`Catégories actualisées : ${count} ligne(s)`, `Categories updated: ${count} row(s)`), 'success');
    } catch {
      addToast(t('Erreur import — vérifiez le CSV (Catégorie ; Sous-catégorie)', 'Import error — check the CSV (Category; Sub-category)'), 'error');
    } finally {
      setCatBusy(false);
      if (catFileRef.current) catFileRef.current.value = '';
    }
  };

  // ── Offre marketing du ticket (éditable + import/export CSV) ──────────────
  const offreFileRef = useRef<HTMLInputElement>(null);
  const [offre, setOffre] = useState<OffreFacture>({ ...OFFRE_DEFAULTS });
  const [offreBusy, setOffreBusy] = useState(false);
  useEffect(() => { getSettings().then(s => setOffre({ ...OFFRE_DEFAULTS, ...(s.offreFacture ?? {}) })).catch(() => {}); }, []);

  const OFFRE_KEYS: { key: keyof OffreFacture; csv: string; label: string; ph: string }[] = [
    { key: 'titre',      csv: 'TITRE_OFFRE',    label: t('Titre de l\'offre', 'Offer title'),   ph: t('ex : Ne laissez pas votre remise expirer !', "e.g.: Don't let your discount expire!") },
    { key: 'message',    csv: 'MESSAGE_OFFRE',  label: t('Message de l\'offre', 'Offer message'), ph: t('ex : *Merci pour votre achat !* Family Store vous offre 5 %…', 'e.g.: *Thank you for your purchase!* Family Store offers you 5%…') },
    { key: 'validite',   csv: 'VALIDITE_OFFRE', label: t('Validité', 'Validity'),            ph: t('ex : *Offre valable jusqu\'au 31 août 2026 uniquement.*', 'e.g.: *Offer valid until 31 August 2026 only.*') },
    { key: 'cta',        csv: 'CALL_TO_ACTION', label: t('Appel à l\'action', 'Call to action'),   ph: t('ex : *Revenez avant le 31 août avec cette facture…*', 'e.g.: *Come back before 31 August with this receipt…*') },
    { key: 'salutation', csv: 'SALUTATION_FIN', label: t('Salutation de fin', 'Closing greeting'),   ph: t('ex : *À très bientôt chez Family Store !*', 'e.g.: *See you soon at Family Store!*') },
  ];

  const saveOffre = async (next: OffreFacture, msg = t('Offre marketing enregistrée ✅', 'Marketing offer saved ✅')) => {
    try { await updateSettings({ offreFacture: next }); reloadSettings(); addToast(msg, 'success'); }
    catch { addToast(t('Erreur sauvegarde de l\'offre', 'Failed to save the offer'), 'error'); }
  };

  const exportOffreCsv = () => {
    const rows = OFFRE_KEYS.map(k => `${k.csv}: ${(offre[k.key] ?? '').replace(/\r?\n/g, ' ')}`);
    // BOM UTF-8 : Excel affiche correctement les accents (é, à, …)
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'OFFRE_MARKETING.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const importOffreCsv = async (file: File) => {
    setOffreBusy(true);
    try {
      const text = (await file.text()).replace(/^﻿/, '');
      const next = { ...offre };
      let found = 0;
      for (const raw of text.split(/\r?\n/)) {
        // Tolère les guillemets et séparateurs ajoutés par Excel autour de la cellule
        const line = raw.trim().replace(/^"/, '').replace(/"?[;,]*$/, '');
        const m = line.match(/^(TITRE_OFFRE|MESSAGE_OFFRE|VALIDITE_OFFRE|CALL_TO_ACTION|SALUTATION_FIN)\s*:\s*(.*)$/i);
        if (!m) continue;
        const entry = OFFRE_KEYS.find(x => x.csv === m[1].toUpperCase());
        if (!entry) continue;
        next[entry.key] = m[2].replace(/""/g, '"').trim();
        found++;
      }
      if (found === 0) { addToast(t('CSV invalide — aucune clé reconnue (TITRE_OFFRE, MESSAGE_OFFRE…)', 'Invalid CSV — no recognized key (TITRE_OFFRE, MESSAGE_OFFRE…)'), 'error'); return; }
      setOffre(next);
      await saveOffre(next, t(`Offre importée : ${found} champ(s) mis à jour ✅`, `Offer imported: ${found} field(s) updated ✅`));
    } catch { addToast(t('Erreur lecture du fichier CSV', 'Error reading the CSV file'), 'error'); }
    finally { setOffreBusy(false); if (offreFileRef.current) offreFileRef.current.value = ''; }
  };

  // ── Réinitialisation ─────────────────────────────────────────────────────
  const [resetLoading, setResetLoading] = useState(false);
  const [resetText,    setResetText]    = useState('');   // mot-clé « TOUT SUPPRIMER »
  // Réinitialisation du magazin (entrepôt) — déplacée ici depuis la page Magasiniers.
  const [magResetText,    setMagResetText]    = useState('');
  const [magResetLoading, setMagResetLoading] = useState(false);
  const [magResetDone,    setMagResetDone]    = useState(false);
  const handleResetMagazin = async () => {
    if (magResetText.trim().toUpperCase() !== 'RÉINITIALISER') return;
    setMagResetLoading(true);
    try { await resetEntrepot(); setMagResetDone(true); setMagResetText(''); addToast(t('Stock entrepôt réinitialisé', 'Warehouse stock reset'), 'success'); }
    catch { addToast(t('Erreur lors de la réinitialisation de l\'entrepôt', 'Error resetting the warehouse'), 'error'); }
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
      addToast(t('Ventes et sessions de test supprimées — produits conservés ✓', 'Test sales and sessions deleted — products kept ✓'), 'success');
    } catch {
      addToast(t('Erreur lors du nettoyage', 'Error during cleanup'), 'error');
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
      addToast(t('Base réinitialisée — bienvenue en production !', 'Database reset — welcome to production!'), 'success');
      setResetText('');
      setTimeout(() => { void deconnexion().then(ok => { if (ok) window.location.href = '/login'; }); }, 2000);
    } catch {
      addToast(t('Erreur lors de la réinitialisation', 'Error during reset'), 'error');
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
    if (!d) return t('Jamais', 'Never');
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return t('À l\'instant', 'Just now');
    if (diff === 1) return t('Il y a 1 minute', '1 minute ago');
    if (diff < 60) return t(`Il y a ${diff} minutes`, `${diff} minutes ago`);
    const h = Math.floor(diff / 60);
    return t(`Il y a ${h} heure${h > 1 ? 's' : ''}`, `${h} hour${h > 1 ? 's' : ''} ago`);
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

  const mkChange = useCallback((k: keyof SForm) => (v: string) => setField(k, v as never), [setField]);
  const toggleModule = useCallback((id: ModuleId) => setForm(prev => ({
    ...prev,
    modules: prev.modules.includes(id) ? prev.modules.filter(m => m !== id) : [...prev.modules, id],
  })), []);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert(t('Logo trop lourd (max 500 Ko)', 'Logo too large (max 500 KB)')); return; }
    const reader = new FileReader();
    reader.onload = ev => setField('logoUrl', ev.target?.result as string ?? '');
    reader.readAsDataURL(file);
  }, [setField]);

  const handleSaveSettings = useCallback(async () => {
    setSLoading(true);
    try {
      await updateSettings(fromSForm(form));
      reloadSettings();
      addToast(t('Paramètres sauvegardés ✅', 'Settings saved ✅'), 'success');
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : t('Erreur sauvegarde', 'Save error'), 'error');
    } finally { setSLoading(false); }
  }, [form, reloadSettings, addToast]);

  // ── Mon compte ───────────────────────────────────────────────────────────
  const payload   = getTokenPayload();
  const nameParts = (payload?.name ?? t('Patron', 'Owner')).split(' ');

  const [accPrenom,  setAccPrenom]  = useState(nameParts[0] ?? '');
  const [accNom,     setAccNom]     = useState(nameParts.slice(1).join(' ') ?? '');
  const [accPwd,     setAccPwd]     = useState('');
  const [accPwd2,    setAccPwd2]    = useState('');
  const [accError,   setAccError]   = useState('');
  const [accLoading, setAccLoading] = useState(false);

  const handleAccSave = useCallback(async () => {
    if (!accPrenom) { setAccError(t('Le prénom est obligatoire.', 'First name is required.')); return; }
    if (accPwd && accPwd !== accPwd2) { setAccError(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.')); return; }
    if (accPwd && accPwd.length < 6) { setAccError(t('Mot de passe : 6 caractères minimum.', 'Password: 6 characters minimum.')); return; }
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
      addToast(t('Compte mis à jour ✅', 'Account updated ✅'), 'success');
    } catch (e: unknown) {
      setAccError(e instanceof Error ? e.message : t('Erreur', 'Error'));
    } finally { setAccLoading(false); }
  }, [accPrenom, accNom, accPwd, accPwd2, payload, addToast]);

  const onAccPrenom = useCallback((v: string) => setAccPrenom(v), []);
  const onAccNom    = useCallback((v: string) => setAccNom(v), []);
  const onAccPwd    = useCallback((v: string) => setAccPwd(v), []);
  const onAccPwd2   = useCallback((v: string) => setAccPwd2(v), []);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0, paddingLeft: isMobile ? 52 : (isNarrow ? 16 : 28) }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Système', 'System')}</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>{t('Paramètres magasin', 'Store settings')}</h1>
        </div>

        <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', padding: isNarrow ? '20px 16px' : '24px 28px', maxWidth: 660 }}>

          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Logo du magasin', 'Store logo')}</p>
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
                  {t('Choisir un logo', 'Choose a logo')}
                </button>
                {form.logoUrl && (
                  <button onClick={() => setField('logoUrl', '')}
                    style={{ marginLeft: 8, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-400)' }}>
                    {t('Supprimer', 'Remove')}
                  </button>
                )}
                <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '4px 0 0' }}>{t('PNG, JPG · max 500 Ko · stocké en base64', 'PNG, JPG · max 500 KB · stored as base64')}</p>
              </div>
            </div>
          </div>

          {/* ── Couleur principale ───────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Couleur de la boutique', 'Store color')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
                <label style={LABEL_STYLE}>{t('Code couleur hex', 'Hex color code')}</label>
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
                  {t("S'applique sur toute l'interface — boutons, sidebar, en-têtes.", 'Applies across the whole interface — buttons, sidebar, headers.')}
                </p>
              </div>
              <button onClick={() => { mkChange('couleurPrincipale')('#FF0000'); if (typeof applyPrimaryColor === 'function') applyPrimaryColor('#FF0000'); }}
                style={{ padding: '7px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)' }}>
                {t('Défaut', 'Default')}
              </button>
            </div>
          </div>

          {/* ── Couleur secondaire (accents « or ») ─────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Couleur secondaire (accents)', 'Secondary color (accents)')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: form.couleurSecondaire || 'var(--fs-gold-500)', border: '2px solid var(--fs-line-2)', overflow: 'hidden', cursor: 'pointer' }}>
                  <input type="color" value={form.couleurSecondaire || '#B8893E'}
                    onChange={e => { mkChange('couleurSecondaire')(e.target.value); applySecondaryColor(e.target.value); }}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}/>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>{t('Code couleur hex', 'Hex color code')}</label>
                <input type="text" value={form.couleurSecondaire || '#B8893E'}
                  onChange={e => { mkChange('couleurSecondaire')(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) applySecondaryColor(e.target.value); }}
                  placeholder="#B8893E" style={{ ...INPUT_STYLE, fontFamily: 'var(--fs-font-mono)', width: 130 }}/>
                <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '6px 0 0' }}>
                  {t('Titres de la caisse, filets décoratifs, mises en avant.', 'Checkout headings, decorative rules, highlights.')}
                </p>
              </div>
              <button onClick={() => { mkChange('couleurSecondaire')('#B8893E'); applySecondaryColor('#B8893E'); }}
                style={{ padding: '7px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)' }}>
                {t('Défaut', 'Default')}
              </button>
            </div>
          </div>

          {/* ── Catégories de produits (éditable sans code) ──────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Catégories de produits', 'Product categories')}</p>
            <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {t('Gérez les catégories et sous-catégories ', 'Manage categories and sub-categories ')}<strong>{t('sans toucher au code', 'without touching the code')}</strong>{t(' : exportez le CSV, éditez-le dans Excel', ': export the CSV, edit it in Excel')}
              {t('(2 colonnes : ', '(2 columns: ')}<em>{t('Catégorie ; Sous-catégorie', 'Category; Sub-category')}</em>{t(', une ligne par sous-catégorie), puis réimportez pour ', ', one row per sub-category), then re-import to ')}<strong>{t('actualiser le serveur', 'update the server')}</strong>.
              {t("L'import ", 'The import ')}<strong>{t('remplace', 'replaces')}</strong>{t(' toute la liste. (Les administrateurs peuvent aussi ajouter une catégorie directement depuis la fiche produit, via « Autre… ».)', ' the whole list. (Administrators can also add a category directly from the product form, via "Other…".)')}
            </p>
            <input ref={catFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importCatCsv(f); }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={exportCatCsv}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-ink-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ⬇ {t('Exporter (CSV)', 'Export (CSV)')}
              </button>
              <button onClick={() => catFileRef.current?.click()} disabled={catBusy}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: catBusy ? 'default' : 'pointer', opacity: catBusy ? 0.6 : 1 }}>
                ⬆ {catBusy ? t('Import…', 'Importing…') : t('Importer (CSV)', 'Import (CSV)')}
              </button>
            </div>
          </div>

          {/* ── Offre marketing du ticket (éditable sans code) ───────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Offre marketing (facture)', 'Marketing offer (receipt)')}</p>
            <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {t('Personnalisez les textes imprimés en ', 'Customize the texts printed at the ')}<strong>{t('pied de ticket', 'bottom of the receipt')}</strong>{t(' sans toucher au code : modifiez les champs ci-dessous ou passez par Excel (', ' without touching the code: edit the fields below or use Excel (')}<strong>{t('Exporter', 'Export')}</strong>{t(' le CSV, l\'éditer, puis ', ' the CSV, edit it, then ')}<strong>{t('Importer', 'Import')}</strong>{t(').', ').')}
              {t(' Les mots entourés d\'astérisques ', ' Words wrapped in asterisks ')}<em>{t('*comme ceci*', '*like this*')}</em>{t(' sont imprimés ', ' are printed ')}<strong>{t('en gras', 'in bold')}</strong>{t('. Un champ vide n\'est pas imprimé.', '. An empty field is not printed.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {OFFRE_KEYS.map(k => (
                <div key={k.key}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                    {k.label} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({k.csv})</span>
                  </label>
                  <textarea value={offre[k.key]} onChange={e => setOffre(prev => ({ ...prev, [k.key]: e.target.value }))}
                    placeholder={k.ph} rows={k.key === 'message' || k.key === 'cta' ? 2 : 1}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', resize: 'vertical' }}/>
                </div>
              ))}
            </div>
            <input ref={offreFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importOffreCsv(f); }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => saveOffre(offre)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                💾 {t("Enregistrer l'offre", 'Save the offer')}
              </button>
              <button onClick={exportOffreCsv}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-ink-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ⬇ {t('Exporter (CSV)', 'Export (CSV)')}
              </button>
              <button onClick={() => offreFileRef.current?.click()} disabled={offreBusy}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-ink-600)', fontSize: 13, fontWeight: 600, cursor: offreBusy ? 'default' : 'pointer', opacity: offreBusy ? 0.6 : 1 }}>
                ⬆ {offreBusy ? t('Import…', 'Importing…') : t('Importer (CSV)', 'Import (CSV)')}
              </button>
            </div>
          </div>

          {/* ── Informations générales ────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Informations générales', 'General information')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label={t('Nom du magasin', 'Store name')}  value={form.nomMagasin} onChange={mkChange('nomMagasin')} placeholder="Family Store"/>
              <Field label={t('Adresse', 'Address')}         value={form.adresse}    onChange={mkChange('adresse')}    placeholder="Rue de la Joie, Akwa"/>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <Field label={t('Ville', 'City')}         value={form.ville}      onChange={mkChange('ville')}      placeholder="Douala"/>
                <Field label={t('Téléphone', 'Phone')}     value={form.telephone}  onChange={mkChange('telephone')}  placeholder="+237 6XX XXX XXX"/>
              </div>
              <Field label={t('Email de contact', 'Contact email')} value={form.email}     onChange={mkChange('email')}      type="email" placeholder="contact@familystore.cm"/>
            </div>
          </div>

          {/* ── Identité imprimée (tickets, PDF, e-mails) ────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Identité sur les tickets et documents', 'Identity on receipts and documents')}</p>
            <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {t("En-tête du ticket de caisse, des PDF et des e-mails. Un champ vide n'imprime rien.", 'Header of the receipt, PDFs and e-mails. An empty field prints nothing.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <Field label={t('Signature (sous le nom)', 'Signature (under the name)')} value={form.signatureTicket} onChange={mkChange('signatureTicket')} placeholder={t('ex : BY RDCT', 'e.g.: BY RDCT')}/>
                <Field label={t('Slogan', 'Slogan')} value={form.slogan} onChange={mkChange('slogan')} placeholder={t('ex : Beauté • Saveur • Bien-être', 'e.g.: Beauty • Flavour • Well-being')}/>
              </div>
              <Field label={t('Mentions légales', 'Legal notice')} value={form.mentionsLegales} onChange={mkChange('mentionsLegales')} placeholder={t('ex : NIU : MO2211… • RC : RC/DLN/2021/…', 'e.g.: NIU: MO2211… • RC: RC/DLN/2021/…')}/>
              <div>
                <label style={LABEL_STYLE}>{t('Téléphones imprimés sur le ticket (un par ligne)', 'Phone numbers printed on the receipt (one per line)')}</label>
                <textarea value={form.telephonesTicket} onChange={e => setField('telephonesTicket', e.target.value)} rows={2}
                  placeholder={'+237 6XX XXX XXX\n+237 6XX XXX XXX'}
                  style={{ ...INPUT_STYLE, resize: 'vertical', fontFamily: 'var(--fs-font-mono)' }}/>
                <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '4px 0 0' }}>{t('Vide : le téléphone de contact ci-dessus est utilisé.', 'Empty: the contact phone above is used.')}</p>
              </div>
            </div>
          </div>

          {/* ── Horaires ─────────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t("Horaires d'ouverture", 'Opening hours')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Field label={t("Heure d'ouverture", 'Opening time')} value={form.ouverture} onChange={mkChange('ouverture')} type="time"/>
              <Field label={t('Heure de fermeture', 'Closing time')} value={form.fermeture} onChange={mkChange('fermeture')} type="time"/>
            </div>
            <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '10px 0 0' }}>
              {t('Horaires affichés sur les tickets et rapports.', 'Hours shown on receipts and reports.')}
            </p>
          </div>

          {/* ── Fiscal & Monnaie ─────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Monnaie', 'Currency')}</p>
            <Field label={t('Devise', 'Currency')} value={form.devise} onChange={mkChange('devise')} placeholder="XAF"/>
          </div>

          {/* ── Langue ───────────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t("Langue de l'interface", 'Interface language')}</p>
            <SelectField
              label={t('Langue', 'Language')}
              value={form.langue}
              onChange={mkChange('langue')}
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>

          {/* ── Modules & règles métier ──────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Modules et règles métier', 'Modules and business rules')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MODULES_DISPONIBLES.map(m => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.modules.includes(m.id)} onChange={() => toggleModule(m.id)}/>
                  <span>{t('Module', 'Module')} <strong>{m.label}</strong></span>
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.seedFournisseursDemo} onChange={e => setField('seedFournisseursDemo', e.target.checked)}/>
                <span>{t('Créer les ', 'Create the ')}<strong>{t('fournisseurs de démonstration', 'demo suppliers')}</strong>{t(' quand la liste est vide', ' when the list is empty')}</span>
              </label>
              <div style={{ maxWidth: 260 }}>
                <Field label={t('Déconnexion après inactivité (minutes)', 'Sign out after inactivity (minutes)')} value={form.inactiviteMinutes} onChange={mkChange('inactiviteMinutes')} type="number" placeholder="10"/>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: '10px 0 0' }}>
              {t("Un module désactivé disparaît des menus et de l'accueil. La caisse garde son propre verrouillage par PIN.", 'A disabled module disappears from the menus and the home page. The checkout keeps its own PIN lock.')}
            </p>
          </div>

          {/* ── Réseaux sociaux ──────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Réseaux sociaux', 'Social media')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label={t('Page Facebook', 'Facebook page')}   value={form.facebook} onChange={mkChange('facebook')} placeholder="https://facebook.com/familystore"/>
              <Field label="WhatsApp Business" value={form.whatsapp} onChange={mkChange('whatsapp')} placeholder="+237 6XX XXX XXX"/>
            </div>
          </div>

          {/* ── Impression des reçus ─────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Impression des reçus', 'Receipt printing')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Toggle impression automatique */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{t('Impression automatique', 'Automatic printing')}</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>{t("Imprimer le reçu dès la validation d'une vente", 'Print the receipt as soon as a sale is confirmed')}</div>
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
                <label style={LABEL_STYLE}>{t('Nombre de copies', 'Number of copies')}</label>
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
                      {t(`${n} copie${n > 1 ? 's' : ''}`, `${n} cop${n > 1 ? 'ies' : 'y'}`)}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ── Synchronisation hors-ligne ───────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
            <p style={SECTION_TITLE}>{t('Synchronisation hors-ligne', 'Offline synchronization')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--fs-ivory)', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--fs-ink-500)', fontWeight: 500 }}>{t('Dernière synchronisation', 'Last synchronization')}</span>
                <span style={{ color: 'var(--fs-ink-900)', fontWeight: 600, fontFamily: 'var(--fs-font-mono)' }}>{formatLastSync(lastSync)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: syncPending > 0 ? '#fff7ed' : 'var(--fs-ivory)', borderRadius: 8, fontSize: 13, border: syncPending > 0 ? '1px solid #fed7aa' : 'none' }}>
                <span style={{ color: 'var(--fs-ink-500)', fontWeight: 500 }}>{t('Ventes en attente', 'Pending sales')}</span>
                <span style={{ color: syncPending > 0 ? '#c2410c' : '#16a34a', fontWeight: 700, fontFamily: 'var(--fs-font-mono)' }}>
                  {syncPending > 0 ? t(`${syncPending} vente(s)`, `${syncPending} sale(s)`) : t('Aucune', 'None')}
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
                {isSyncing ? t('Synchronisation…', 'Syncing…') : t('Forcer la synchronisation', 'Force synchronization')}
              </button>
            </div>
          </div>

          {/* ── Bouton Enregistrer ────────────────────────────────────────── */}
          <button onClick={handleSaveSettings} disabled={sLoading}
            style={{ padding: '11px 32px', background: sLoading ? 'var(--fs-ink-400)' : 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: sLoading ? 'not-allowed' : 'pointer', opacity: sLoading ? 0.8 : 1 }}>
            {sLoading ? t('Enregistrement…', 'Saving…') : t('Enregistrer les modifications', 'Save changes')}
          </button>

          {/* ── Mon compte ───────────────────────────────────────────────── */}
          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--fs-wine-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {`${accPrenom[0] ?? ''}${accNom[0] ?? ''}`.toUpperCase() || 'P'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{accPrenom} {accNom}</div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{t('Patron', 'Owner')} · {payload?.email ?? ''}</div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <p style={SECTION_TITLE}>{t('Mon compte', 'My account')}</p>
              {accError && <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600 }}>{accError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <Field label={t('Prénom', 'First name')} value={accPrenom} onChange={onAccPrenom} placeholder={t('Prénom', 'First name')}/>
                  <Field label={t('Nom', 'Last name')}    value={accNom}    onChange={onAccNom}    placeholder={t('Nom de famille', 'Last name')}/>
                </div>
                <Field label="Email" value={payload?.email ?? ''} onChange={() => {}} disabled placeholder="email@familystore.cm"/>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <Field label={t('Nouveau mot de passe', 'New password')}     value={accPwd}  onChange={onAccPwd}  type="password" placeholder={t('Laisser vide pour ne pas changer', 'Leave blank to keep unchanged')}/>
                  <Field label={t('Confirmer le mot de passe', 'Confirm password')} value={accPwd2} onChange={onAccPwd2} type="password" placeholder={t('Répéter le mot de passe', 'Repeat the password')}/>
                </div>
                <button onClick={handleAccSave} disabled={accLoading}
                  style={{ alignSelf: 'flex-start', padding: '10px 24px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: accLoading ? 0.7 : 1 }}>
                  {accLoading ? t('Enregistrement…', 'Saving…') : t('Mettre à jour mon compte', 'Update my account')}
                </button>
              </div>
            </div>
          </div>

          {/* ── Zone de danger : réinitialisation ── */}
          <div style={{ marginTop: 32, border: '2px solid #fca5a5', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#fef2f2', padding: '14px 20px', borderBottom: '1px solid #fca5a5' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#991b1b', letterSpacing: '0.05em' }}>
                ⚠️ {t('ZONE DE DANGER — Mise en production', 'DANGER ZONE — Going live')}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>
                {t('Actions irréversibles.', 'Irreversible actions.')}
              </p>
            </div>
            <div style={{ padding: '16px 20px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ── Nettoyage données test (garde produits) ── */}
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C2410C' }}>🧹 {t('Nettoyer les données de test', 'Clean test data')}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fs-ink-600)', lineHeight: 1.5 }}>
                    {t('Supprime : ', 'Deletes: ')}<strong>{t('ventes · factures · sessions · mouvements · dépenses · logs', 'sales · invoices · sessions · movements · expenses · logs')}</strong><br/>
                    {t('Conserve : ', 'Keeps: ')}<strong>{t('produits · caissiers · gestionnaires · caisses', 'products · cashiers · managers · cash registers')}</strong>
                  </p>
                </div>
                {cleanDone ? (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ {t('Nettoyage effectué avec succès', 'Cleanup completed successfully')}</p>
                ) : (
                  <>
                    <input value={cleanText} onChange={e => setCleanText(e.target.value)} placeholder={t('Tapez NETTOYER pour confirmer', 'Type NETTOYER to confirm')}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box' }}/>
                    <button onClick={handleCleanTransactions} disabled={cleanLoading || cleanText.trim().toUpperCase() !== 'NETTOYER'}
                      style={{ alignSelf: 'flex-start', padding: '9px 18px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (cleanLoading || cleanText.trim().toUpperCase() !== 'NETTOYER') ? 'not-allowed' : 'pointer', opacity: (cleanLoading || cleanText.trim().toUpperCase() !== 'NETTOYER') ? 0.5 : 1 }}>
                      {cleanLoading ? t('Nettoyage…', 'Cleaning…') : t('Supprimer les données de test uniquement', 'Delete test data only')}
                    </button>
                  </>
                )}
              </div>

              <div style={{ borderTop: '1px solid #fca5a5' }}/>

              {/* ── Réinitialiser le magazin (entrepôt) ── */}
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#C2410C' }}>📦 {t('Réinitialiser le magazin (entrepôt)', 'Reset the warehouse')}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fs-ink-600)', lineHeight: 1.5 }}>
                    {t('Remet à ', 'Resets ')}<strong>{t('zéro le stock entrepôt', 'the warehouse stock to zero')}</strong>{t(' de tous les produits et ', ' for all products and ')}<strong>{t("supprime l'historique des réceptions", 'deletes the receiving history')}</strong>.<br/>
                    {t("N'affecte ", 'Does ')}<strong>{t('pas', 'not')}</strong>{t(' le stock caisse, les ventes ni les produits.', ' affect the register stock, sales or products.')}
                  </p>
                </div>
                {magResetDone ? (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ {t('Magazin réinitialisé', 'Warehouse reset')}</p>
                ) : (
                  <>
                    <input value={magResetText} onChange={e => setMagResetText(e.target.value)} placeholder={t('Tapez RÉINITIALISER pour confirmer', 'Type RÉINITIALISER to confirm')}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box' }}/>
                    <button onClick={handleResetMagazin} disabled={magResetLoading || magResetText.trim().toUpperCase() !== 'RÉINITIALISER'}
                      style={{ alignSelf: 'flex-start', padding: '9px 18px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (magResetLoading || magResetText.trim().toUpperCase() !== 'RÉINITIALISER') ? 'not-allowed' : 'pointer', opacity: (magResetLoading || magResetText.trim().toUpperCase() !== 'RÉINITIALISER') ? 0.5 : 1 }}>
                      {magResetLoading ? t('Réinitialisation…', 'Resetting…') : t('Réinitialiser le magazin', 'Reset the warehouse')}
                    </button>
                  </>
                )}
              </div>

              <div style={{ borderTop: '1px solid #fca5a5' }}/>

              <div style={{ fontSize: 12, color: 'var(--fs-ink-600)', lineHeight: 1.6 }}>
                <strong>{t('Réinitialisation complète :', 'Full reset:')}</strong>{t(' supprime ', ' deletes ')}<strong>{t('tout', 'everything')}</strong>{t(' y compris les produits · caissiers · gestionnaires.', ' including products · cashiers · managers.')}<br/>
                {t('Conserve : votre compte ', 'Keeps: your ')}<strong>{t('Admin Patron', 'Owner Admin')}</strong>{t(' + configuration des caisses.', ' account + cash register configuration.')}
              </div>

              <input value={resetText} onChange={e => setResetText(e.target.value)} placeholder={t('Tapez TOUT SUPPRIMER pour confirmer', 'Type TOUT SUPPRIMER to confirm')}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', boxSizing: 'border-box' }}/>
              <button onClick={handleReset} disabled={resetLoading || resetText.trim().toUpperCase() !== 'TOUT SUPPRIMER'}
                style={{ alignSelf: 'flex-start', padding: '10px 20px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: (resetLoading || resetText.trim().toUpperCase() !== 'TOUT SUPPRIMER') ? 'not-allowed' : 'pointer', opacity: (resetLoading || resetText.trim().toUpperCase() !== 'TOUT SUPPRIMER') ? 0.5 : 1 }}>
                {resetLoading ? t('Réinitialisation en cours…', 'Reset in progress…') : t('🗑️ Réinitialiser pour la mise en production', '🗑️ Reset for production go-live')}
              </button>
            </div>
          </div>

        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast}/>
    </div>
  );
}
