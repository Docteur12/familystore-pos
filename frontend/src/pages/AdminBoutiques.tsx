/**
 * Boutiques & licences — back-office du revendeur (superadmin).
 *
 * MODE LICENCE MANUELLE : le commerçant règle de la main à la main (Mobile
 * Money sur le numéro du revendeur, espèces, virement), et c'est ICI que le
 * revendeur enregistre le règlement et prolonge la licence d'un an. Chaque
 * prolongation laisse un paiement confirmé, source « manuel », qu'on retrouve
 * dans l'historique de la boutique — la trace d'un litige.
 *
 * Ordre d'affichage : les boutiques expirées d'abord, puis celles qui
 * approchent — c'est la liste des gens à appeler.
 */
import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import {
  listerBoutiques, prolongerLicence, changerStatutBoutique, paiementsBoutique, creerBoutique,
  BoutiquePlateforme, PaiementPlateforme, MoyenReglement, MOYENS_REGLEMENT,
} from '../api/plateforme';
import { etiquetteLicence, trierBoutiques, libelleMoyen, montantLisible } from '../utils/plateforme';
import { useIsMobile } from '../hooks/useIsMobile';
import { t, dateLocale } from '../i18n';

const MONTANT_ANNUEL = 120_000;

const COULEURS: Record<string, { fond: string; texte: string }> = {
  aucun:    { fond: '#E6F4EA', texte: '#1E6B3A' },
  info:     { fond: '#EFF6FF', texte: '#1E3A8A' },
  proche:   { fond: '#FEF3C7', texte: '#7C2D12' },
  urgent:   { fond: '#FFEDD5', texte: '#9A3412' },
  expire:   { fond: '#FEE2E2', texte: '#7F1D1D' },
  inconnue: { fond: '#EEE',    texte: '#555' },
};

const TH: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em',
  borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '10px 12px', fontSize: 12.5, borderBottom: '1px solid var(--fs-line)', verticalAlign: 'top' };
const CHAMP: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line)', borderRadius: 8,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)', background: '#fff',
};
const ETIQUETTE: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase',
  letterSpacing: '0.08em', display: 'block', marginBottom: 5,
};
const BOUTON = (variante: 'plein' | 'ligne' | 'danger'): React.CSSProperties => ({
  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: variante === 'ligne' ? '1.5px solid var(--fs-line-2)' : 'none',
  background: variante === 'plein' ? 'var(--fs-wine-700)' : variante === 'danger' ? '#FEE2E2' : '#fff',
  color: variante === 'plein' ? '#fff' : variante === 'danger' ? '#7F1D1D' : 'var(--fs-ink-900)',
});

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ── Modale de règlement ───────────────────────────────────────────────────────

function ModaleReglement({ boutique, onFerme, onFait }: {
  boutique: BoutiquePlateforme; onFerme: () => void; onFait: (message: string) => void;
}) {
  const [montant, setMontant] = useState(String(MONTANT_ANNUEL));
  const [moyen, setMoyen]     = useState<MoyenReglement>('mobile_money');
  const [note, setNote]       = useState('');
  const [erreur, setErreur]   = useState('');
  const [envoi, setEnvoi]     = useState(false);

  const valider = async () => {
    const m = Number(montant.replace(/\s/g, ''));
    if (!Number.isFinite(m) || m < 0) return setErreur(t('Montant invalide.', 'Invalid amount.'));
    if (m === 0 && !note.trim()) return setErreur(t('Un règlement à 0 doit être expliqué dans la note.', 'A zero payment must be explained in the note.'));
    setEnvoi(true); setErreur('');
    try {
      const r = await prolongerLicence(boutique.id, { montant: m, moyen, note: note.trim() });
      onFait(t(
        `Licence de « ${boutique.nom} » prolongée jusqu'au ${fmtDate(r.dateEcheance)} — règlement ${montantLisible(m)} enregistré.`,
        `Licence for "${boutique.nom}" extended to ${fmtDate(r.dateEcheance)} — payment ${montantLisible(m)} recorded.`,
      ));
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : t('Erreur', 'Error'));
    } finally { setEnvoi(false); }
  };

  const echeance = boutique.licence?.dateEcheance;
  const repartDe = boutique.licence && !boutique.licence.expiree
    ? t(`Un an de plus à partir de l'échéance actuelle (${fmtDate(echeance)}) : le client ne perd aucun jour payé.`,
        `One more year from the current expiry (${fmtDate(echeance)}): the customer loses no paid day.`)
    : t('Un an à partir d’aujourd’hui.', 'One year from today.');

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onFerme(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--fs-line)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{t('Règlement reçu', 'Payment received')}</p>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '2px 0 0', color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-display)' }}>{boutique.nom}</h2>
          <p style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', margin: '6px 0 0', lineHeight: 1.5 }}>{repartDe}</p>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {erreur && <div style={{ background: '#FBE9E5', color: '#8C2B16', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{erreur}</div>}
          <div>
            <label style={ETIQUETTE}>{t('Montant reçu (XAF)', 'Amount received (XAF)')}</label>
            <input value={montant} onChange={e => setMontant(e.target.value)} inputMode="numeric" style={CHAMP}/>
          </div>
          <div>
            <label style={ETIQUETTE}>{t('Moyen de règlement', 'Payment method')}</label>
            <select value={moyen} onChange={e => setMoyen(e.target.value as MoyenReglement)} style={CHAMP}>
              {MOYENS_REGLEMENT.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={ETIQUETTE}>{t('Note (référence MoMo, payeur…)', 'Note (MoMo reference, payer…)')}</label>
            <input value={note} onChange={e => setNote(e.target.value)} style={CHAMP} placeholder={t('Ex. MoMo 6 90 00 00 00, reçu le 10/09', 'e.g. MoMo 6 90 00 00 00, received 10/09')}/>
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 10 }}>
          <button onClick={valider} disabled={envoi} style={{ ...BOUTON('plein'), flex: 2, padding: '11px', opacity: envoi ? 0.7 : 1 }}>
            {envoi ? t('Enregistrement…', 'Saving…') : t('Enregistrer et prolonger d’un an', 'Record and extend by one year')}
          </button>
          <button onClick={onFerme} style={{ ...BOUTON('ligne'), flex: 1, padding: '11px' }}>{t('Annuler', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire de nouvelle boutique ───────────────────────────────────────────

function FormulaireBoutique({ onFerme, onFait }: { onFerme: () => void; onFait: (message: string) => void }) {
  const [f, setF] = useState({ nom: '', ville: 'Douala', proprioEmail: '', proprioNom: '', proprioTel: '', patronNom: '', patronEmail: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const maj = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const valider = async () => {
    if (!f.nom.trim()) return setErreur(t('Le nom de la boutique est obligatoire.', 'The store name is required.'));
    if (!f.proprioEmail.trim()) return setErreur(t('L’e-mail du propriétaire est obligatoire.', 'The owner’s email is required.'));
    if (!f.patronNom.trim() || !f.patronEmail.trim()) return setErreur(t('Nom et e-mail du patron sont obligatoires.', 'Manager name and email are required.'));
    if (f.motDePasse.length < 8) return setErreur(t('Mot de passe du patron : 8 caractères minimum.', 'Manager password: at least 8 characters.'));
    setEnvoi(true); setErreur('');
    try {
      await creerBoutique({
        nom: f.nom.trim(), ville: f.ville.trim(),
        proprietaire: { email: f.proprioEmail.trim(), nom: f.proprioNom.trim() || undefined, telephone: f.proprioTel.trim() || undefined },
        patron: { nom: f.patronNom.trim(), email: f.patronEmail.trim(), motDePasse: f.motDePasse },
      });
      onFait(t(`Boutique « ${f.nom.trim()} » créée, licence d'un an posée.`, `Store "${f.nom.trim()}" created with a one-year licence.`));
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : t('Erreur', 'Error'));
    } finally { setEnvoi(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--fs-ink-900)' }}>{t('Nouvelle boutique', 'New store')}</h2>
      <p style={{ fontSize: 11.5, color: 'var(--fs-ink-500)', margin: 0, lineHeight: 1.6 }}>
        {t('La boutique est créée immédiatement avec une licence d’un an : encaissez avant de valider.',
           'The store is created immediately with a one-year licence: collect payment before confirming.')}
      </p>
      {erreur && <div style={{ background: '#FBE9E5', color: '#8C2B16', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{erreur}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div><label style={ETIQUETTE}>{t('Nom de la boutique', 'Store name')}</label><input value={f.nom} onChange={maj('nom')} style={CHAMP}/></div>
        <div><label style={ETIQUETTE}>{t('Ville', 'City')}</label><input value={f.ville} onChange={maj('ville')} style={CHAMP}/></div>
      </div>
      <p style={{ ...ETIQUETTE, color: 'var(--fs-wine-700)', margin: '4px 0 0' }}>{t('Propriétaire (clé maîtresse de ses boutiques)', 'Owner (master key to their stores)')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div><label style={ETIQUETTE}>E-mail</label><input type="email" value={f.proprioEmail} onChange={maj('proprioEmail')} style={CHAMP}/></div>
        <div><label style={ETIQUETTE}>{t('Nom (si nouveau)', 'Name (if new)')}</label><input value={f.proprioNom} onChange={maj('proprioNom')} style={CHAMP}/></div>
        <div><label style={ETIQUETTE}>{t('Téléphone', 'Phone')}</label><input value={f.proprioTel} onChange={maj('proprioTel')} style={CHAMP} placeholder="6XXXXXXXX"/></div>
      </div>
      <p style={{ ...ETIQUETTE, color: 'var(--fs-wine-700)', margin: '4px 0 0' }}>{t('Compte patron de la boutique', 'Store manager account')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div><label style={ETIQUETTE}>{t('Nom complet', 'Full name')}</label><input value={f.patronNom} onChange={maj('patronNom')} style={CHAMP}/></div>
        <div><label style={ETIQUETTE}>E-mail</label><input type="email" value={f.patronEmail} onChange={maj('patronEmail')} style={CHAMP}/></div>
        <div><label style={ETIQUETTE}>{t('Mot de passe', 'Password')}</label><input type="password" value={f.motDePasse} onChange={maj('motDePasse')} style={CHAMP} placeholder={t('8 caractères minimum', 'At least 8 characters')}/></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={valider} disabled={envoi} style={{ ...BOUTON('plein'), padding: '10px 18px', opacity: envoi ? 0.7 : 1 }}>
          {envoi ? t('Création…', 'Creating…') : t('Créer la boutique', 'Create the store')}
        </button>
        <button onClick={onFerme} style={{ ...BOUTON('ligne'), padding: '10px 18px' }}>{t('Annuler', 'Cancel')}</button>
      </div>
    </div>
  );
}

// ── Historique d'une boutique ─────────────────────────────────────────────────

function Historique({ boutiqueId }: { boutiqueId: string }) {
  const [paiements, setPaiements] = useState<PaiementPlateforme[] | null>(null);
  useEffect(() => { paiementsBoutique(boutiqueId).then(setPaiements).catch(() => setPaiements([])); }, [boutiqueId]);
  if (paiements === null) return <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: 0 }}>{t('Chargement…', 'Loading…')}</p>;
  if (paiements.length === 0) return <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: 0 }}>{t('Aucun règlement enregistré.', 'No payment recorded.')}</p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead><tr>
        <th style={TH}>{t('Date', 'Date')}</th><th style={TH}>{t('Montant', 'Amount')}</th><th style={TH}>{t('Moyen', 'Method')}</th>
        <th style={TH}>{t('Statut', 'Status')}</th><th style={TH}>{t('Enregistré par', 'Recorded by')}</th><th style={TH}>{t('Note', 'Note')}</th><th style={TH}>{t('Référence', 'Reference')}</th>
      </tr></thead>
      <tbody>
        {paiements.map(p => (
          <tr key={p.reference}>
            <td style={TD}>{fmtDate(p.cree)}</td>
            <td style={TD}>{montantLisible(p.montant, p.devise)}</td>
            <td style={TD}>{p.fournisseur === 'manuel' ? libelleMoyen(p.moyenReglement) : p.fournisseur}</td>
            <td style={TD}>{p.statut}</td>
            <td style={TD}>{p.enregistrePar || '—'}</td>
            <td style={TD}>{p.note || '—'}</td>
            <td style={{ ...TD, fontFamily: 'var(--fs-font-mono)', fontSize: 11 }}>{p.reference}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBoutiques() {
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);
  const { toasts, addToast, removeToast } = useToast();

  const [boutiques, setBoutiques] = useState<BoutiquePlateforme[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [reglementPour, setReglementPour] = useState<BoutiquePlateforme | null>(null);
  const [historiqueDe, setHistoriqueDe] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true); setErreur('');
    try { setBoutiques(trierBoutiques(await listerBoutiques())); }
    catch (e: unknown) { setErreur(e instanceof Error ? e.message : t('Erreur', 'Error')); }
    finally { setChargement(false); }
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const basculerStatut = async (b: BoutiquePlateforme) => {
    const vers = b.statut === 'active' ? 'suspendue' : 'active';
    const question = vers === 'suspendue'
      ? t(`Suspendre « ${b.nom} » ? Ses utilisateurs ne pourront plus s'y connecter.`, `Suspend "${b.nom}"? Its users will no longer be able to log in.`)
      : t(`Réactiver « ${b.nom} » ?`, `Reactivate "${b.nom}"?`);
    if (!window.confirm(question)) return;
    try {
      await changerStatutBoutique(b.id, vers);
      addToast(vers === 'suspendue' ? t('Boutique suspendue.', 'Store suspended.') : t('Boutique réactivée.', 'Store reactivated.'), 'success');
      await charger();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : t('Erreur', 'Error'), 'error'); }
  };

  const aRappeler = boutiques.filter(b => b.licence && (b.licence.expiree || b.licence.joursRestants <= 14)).length;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      {reglementPour && (
        <ModaleReglement boutique={reglementPour} onFerme={() => setReglementPour(null)}
          onFait={m => { setReglementPour(null); addToast(m, 'success'); void charger(); }}/>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Plateforme', 'Platform')}</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
                {t('Boutiques & licences', 'Stores & licences')} · {boutiques.length}
                {aRappeler > 0 && <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: '#9A3412', background: '#FFEDD5', padding: '3px 9px', borderRadius: 20, verticalAlign: 'middle' }}>{aRappeler} {t('à rappeler', 'to call')}</span>}
              </h1>
            </div>
            <button onClick={() => setNouvelle(v => !v)} style={{ ...BOUTON('plein'), padding: '9px 18px' }}>
              {nouvelle ? t('Fermer', 'Close') : `+ ${t('Nouvelle boutique', 'New store')}`}
            </button>
          </div>
        </div>

        <div style={{ padding: isNarrow ? 16 : '20px 28px 40px' }}>
          {nouvelle && <FormulaireBoutique onFerme={() => setNouvelle(false)} onFait={m => { setNouvelle(false); addToast(m, 'success'); void charger(); }}/>}

          {erreur && <div style={{ background: '#FBE9E5', color: '#8C2B16', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{erreur}</div>}

          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead><tr>
                <th style={TH}>{t('Boutique', 'Store')}</th>
                <th style={TH}>{t('Propriétaire', 'Owner')}</th>
                <th style={TH}>{t('Statut', 'Status')}</th>
                <th style={TH}>{t('Échéance', 'Expiry')}</th>
                <th style={TH}>{t('Licence', 'Licence')}</th>
                <th style={{ ...TH, textAlign: 'right' }}>{t('Actions', 'Actions')}</th>
              </tr></thead>
              <tbody>
                {chargement && <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: 'var(--fs-ink-400)' }}>{t('Chargement…', 'Loading…')}</td></tr>}
                {!chargement && boutiques.length === 0 && (
                  <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: 'var(--fs-ink-400)' }}>{t('Aucune boutique au registre.', 'No store registered.')}</td></tr>
                )}
                {boutiques.map(b => {
                  const etiq = etiquetteLicence(b.licence);
                  const couleur = COULEURS[etiq.niveau] ?? COULEURS.inconnue;
                  const ouvert = historiqueDe === b.id;
                  return (
                    <React.Fragment key={b.id}>
                      <tr style={{ opacity: b.statut === 'suspendue' ? 0.6 : 1 }}>
                        <td style={TD}>
                          <div style={{ fontWeight: 700, color: 'var(--fs-ink-900)' }}>{b.nom}</div>
                          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{b.ville}</div>
                        </td>
                        <td style={TD}>
                          {b.proprietaire ? <><div>{b.proprietaire.nom}</div><div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{b.proprietaire.email}</div></> : '—'}
                        </td>
                        <td style={TD}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: b.statut === 'active' ? '#E6F4EA' : '#EEE', color: b.statut === 'active' ? '#1E6B3A' : '#555' }}>
                            {b.statut === 'active' ? t('Active', 'Active') : t('Suspendue', 'Suspended')}
                          </span>
                        </td>
                        <td style={TD}>{fmtDate(b.licence?.dateEcheance)}</td>
                        <td style={TD}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: couleur.fond, color: couleur.texte, whiteSpace: 'nowrap' }}>{etiq.texte}</span>
                        </td>
                        <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button onClick={() => setReglementPour(b)} style={BOUTON('plein')}>{t('Règlement reçu → +1 an', 'Payment received → +1 year')}</button>
                            <button onClick={() => setHistoriqueDe(ouvert ? null : b.id)} style={BOUTON('ligne')}>{t('Historique', 'History')}</button>
                            <button onClick={() => basculerStatut(b)} style={BOUTON(b.statut === 'active' ? 'danger' : 'ligne')}>
                              {b.statut === 'active' ? t('Suspendre', 'Suspend') : t('Réactiver', 'Reactivate')}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {ouvert && (
                        <tr><td colSpan={6} style={{ ...TD, background: 'var(--fs-ivory)' }}><Historique boutiqueId={b.id}/></td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
