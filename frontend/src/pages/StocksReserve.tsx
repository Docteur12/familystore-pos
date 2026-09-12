/**
 * Réserve — onglet du profil Snack-bar dans l'espace stock.
 *
 * Trois gestes, tous exprimés en CASIERS là où le stock est compté en
 * bouteilles : définir le conditionnement d'un produit (bouteilles par casier,
 * consigne), réceptionner des casiers (conversion automatique, vides rendus au
 * livreur), déclarer une casse. Plus l'état : casiers pleins, bouteilles
 * seules, vides à rendre, consignes du jour.
 *
 * Phase 1 : écran rendu SANS route (branché au signal, item `module:
 * 'comptoir'` de `StocksSidebar`). Les mouvements de stock sont écrits par le
 * serveur avec les motifs existants (voir `backend/src/comptoir/motifs.ts`).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllProducts, Product } from '../api/products';
import StocksSidebar from '../components/StocksSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { displayName } from '../utils/text';
import { t, dateLocale } from '../i18n';
import {
  LigneReserve, ReceptionCasier, RapportConsignes,
  getReserve, getReceptionsCasiers, getConsignesDuJour, definirConditionnement, receptionnerCasiers, declarerCasse,
} from '../api/comptoir';

const fmt = (n: number) => `${n.toLocaleString(dateLocale())} F`;
const nouvelleCle = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type Formulaire =
  | { type: 'conditionnement'; productId?: string }
  | { type: 'reception'; ligne: LigneReserve }
  | { type: 'casse'; ligne: LigneReserve }
  | null;

export default function StocksReserve() {
  const { toasts, addToast, removeToast } = useToast();
  const [lignes, setLignes]       = useState<LigneReserve[]>([]);
  const [produits, setProduits]   = useState<Product[]>([]);
  const [receptions, setReceptions] = useState<ReceptionCasier[]>([]);
  const [consignes, setConsignes] = useState<RapportConsignes | null>(null);
  const [chargement, setChargement] = useState(true);
  const [formulaire, setFormulaire] = useState<Formulaire>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const [l, p, r, c] = await Promise.all([
        getReserve(), getAllProducts(), getReceptionsCasiers(20).catch(() => []), getConsignesDuJour().catch(() => null),
      ]);
      setLignes(l); setProduits(p); setReceptions(r); setConsignes(c);
    } catch (e) {
      addToast(e instanceof Error ? e.message : t('Erreur de chargement', 'Loading error'), 'error');
    } finally {
      setChargement(false);
    }
  }, [addToast]);

  useEffect(() => { void charger(); }, [charger]);

  const totaux = useMemo(() => ({
    casiersPleins:  lignes.reduce((s, l) => s + l.casiersPleins, 0),
    casiersARendre: lignes.reduce((s, l) => s + l.casiersVidesARendre, 0),
    videsSeuls:     lignes.reduce((s, l) => s + l.videsSeuls, 0),
  }), [lignes]);

  const sansConditionnement = useMemo(
    () => produits.filter(p => !lignes.some(l => l.productId === p._id)),
    [produits, lignes],
  );

  const apresAction = async (message: string) => {
    setFormulaire(null);
    addToast(message, 'success');
    await charger();
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar alertCount={0} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <main style={{ flex: 1, overflowX: 'hidden', overflowY: 'auto', background: 'var(--fs-ivory)' }}>
    <div data-testid="reserve" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('Réserve — casiers, consignes, vides', 'Stockroom — crates, deposits, empties')}</h1>
        <div style={{ flex: 1 }} />
        <button type="button" data-testid="btn-nouveau-conditionnement" onClick={() => setFormulaire({ type: 'conditionnement' })} style={boutonPrincipal}>
          + {t('Définir un casier / une consigne', 'Set crate size / deposit')}
        </button>
      </div>

      {/* Chiffres clés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <Tuile titre={t('Casiers pleins', 'Full crates')} valeur={String(totaux.casiersPleins)} testid="tuile-pleins" />
        <Tuile titre={t('Casiers de vides à rendre', 'Crates of empties to return')} valeur={`${totaux.casiersARendre}${totaux.videsSeuls ? ` + ${totaux.videsSeuls}` : ''}`} testid="tuile-vides" />
        <Tuile titre={t('Consignes encaissées (jour)', 'Deposits taken (today)')} valeur={consignes ? fmt(consignes.encaissees.montant) : '—'} testid="tuile-encaissees" />
        <Tuile titre={t('Consignes rendues (jour)', 'Deposits refunded (today)')} valeur={consignes ? fmt(consignes.rendues.montant) : '—'} testid="tuile-rendues" />
      </div>

      {/* Tableau */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #E6DED5' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#FAF7F2' }}>
              {[t('Produit', 'Product'), t('Stock', 'Stock'), t('Casier', 'Crate'), t('Consigne', 'Deposit'), t('Vides en réserve', 'Empties in stock'), ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--fs-ink-500)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chargement && <tr><td colSpan={6} style={{ padding: 20, color: 'var(--fs-ink-500)' }}>{t('Chargement…', 'Loading…')}</td></tr>}
            {!chargement && lignes.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, color: 'var(--fs-ink-500)' }}>
                {t('Aucun produit conditionné. Commencez par « Définir un casier / une consigne ».', 'No product set up yet. Start with “Set crate size / deposit”.')}
              </td></tr>
            )}
            {lignes.map(l => (
              <tr key={l.productId} data-testid="ligne-reserve" data-produit={l.productId} style={{ borderTop: '1px solid #F0EAE2' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                  {l.nomProduit}
                  {l.stock <= l.alertThreshold && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: 'var(--fs-danger-500)' }}>{t('STOCK BAS', 'LOW STOCK')}</span>}
                </td>
                <td data-testid="cellule-stock" style={{ padding: '10px 12px', fontFamily: 'var(--fs-font-mono)' }}>
                  {l.stock} {t('bout.', 'btl.')} = <b>{l.casiersPleins}</b> {t('casier(s)', 'crate(s)')}{l.bouteillesSeules ? ` + ${l.bouteillesSeules}` : ''}
                </td>
                <td style={{ padding: '10px 12px' }}>{l.bouteillesParCasier} / {t('casier', 'crate')}</td>
                <td style={{ padding: '10px 12px' }}>{l.consigne > 0 ? fmt(l.consigne) : <span style={{ color: 'var(--fs-ink-400)' }}>—</span>}</td>
                <td data-testid="cellule-vides" style={{ padding: '10px 12px', fontFamily: 'var(--fs-font-mono)' }}>
                  {l.videsEnReserve} = <b>{l.casiersVidesARendre}</b> {t('casier(s)', 'crate(s)')}{l.videsSeuls ? ` + ${l.videsSeuls}` : ''}
                </td>
                <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button type="button" data-testid="btn-reception" onClick={() => setFormulaire({ type: 'reception', ligne: l })} style={boutonLigne}>{t('Réception', 'Delivery')}</button>
                  <button type="button" data-testid="btn-casse" onClick={() => setFormulaire({ type: 'casse', ligne: l })} style={boutonLigne}>{t('Casse', 'Breakage')}</button>
                  <button type="button" data-testid="btn-modifier" onClick={() => setFormulaire({ type: 'conditionnement', productId: l.productId })} style={boutonLigne}>{t('Modifier', 'Edit')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Réceptions récentes */}
      {receptions.length > 0 && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 8px' }}>{t('Dernières réceptions', 'Latest deliveries')}</h2>
          <ul data-testid="receptions" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            {receptions.map(r => (
              <li key={r._id} style={{ display: 'flex', gap: 10, padding: '6px 10px', background: '#fff', borderRadius: 8, border: '1px solid #EEE' }}>
                <span style={{ color: 'var(--fs-ink-400)', minWidth: 110 }}>{new Date(r.createdAt).toLocaleString(dateLocale(), { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span style={{ fontWeight: 700 }}>{r.nomProduit}</span>
                <span>{r.casiers} × {r.bouteillesParCasier} = +{r.bouteilles}</span>
                {r.videsRendus > 0 && <span style={{ color: 'var(--fs-ink-500)' }}>· {r.videsRendus} {t('vides rendus', 'empties returned')}</span>}
                {r.note && <span style={{ color: 'var(--fs-ink-500)' }}>· {r.note}</span>}
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--fs-ink-400)' }}>{r.auteurNom}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {formulaire?.type === 'conditionnement' && (
        <FormConditionnement
          produits={produits} sansConditionnement={sansConditionnement} lignes={lignes} productId={formulaire.productId}
          onFermer={() => setFormulaire(null)}
          onFait={() => apresAction(t('Conditionnement enregistré', 'Packaging saved'))}
          onErreur={m => addToast(m, 'error')}
        />
      )}
      {formulaire?.type === 'reception' && (
        <FormReception ligne={formulaire.ligne} onFermer={() => setFormulaire(null)}
          onFait={(b) => apresAction(t(`Réception enregistrée : +${b} bouteilles`, `Delivery recorded: +${b} bottles`))}
          onErreur={m => addToast(m, 'error')} />
      )}
      {formulaire?.type === 'casse' && (
        <FormCasse ligne={formulaire.ligne} onFermer={() => setFormulaire(null)}
          onFait={(b) => apresAction(t(`Casse enregistrée : −${b} bouteilles`, `Breakage recorded: −${b} bottles`))}
          onErreur={m => addToast(m, 'error')} />
      )}
    </div>
      </main>
    </div>
  );
}

// ── Formulaires ───────────────────────────────────────────────────────────────

function FormConditionnement({ produits, sansConditionnement, lignes, productId, onFermer, onFait, onErreur }: {
  produits: Product[]; sansConditionnement: Product[]; lignes: LigneReserve[]; productId?: string;
  onFermer: () => void; onFait: () => void; onErreur: (m: string) => void;
}) {
  const existante = lignes.find(l => l.productId === productId);
  const [choix, setChoix] = useState(productId ?? '');
  const [parCasier, setParCasier] = useState(String(existante?.bouteillesParCasier ?? 24));
  const [consigne, setConsigne] = useState(String(existante?.consigne ?? 0));
  const [envoi, setEnvoi] = useState(false);
  const liste = productId ? produits.filter(p => p._id === productId) : sansConditionnement;

  const valider = async () => {
    const n = Number(parCasier), c = Number(consigne);
    if (!choix) return onErreur(t('Choisissez un produit', 'Choose a product'));
    if (!Number.isInteger(n) || n < 1) return onErreur(t('Bouteilles par casier : entier ≥ 1', 'Bottles per crate: integer ≥ 1'));
    if (!(c >= 0)) return onErreur(t('Consigne : montant ≥ 0', 'Deposit: amount ≥ 0'));
    setEnvoi(true);
    try { await definirConditionnement(choix, { bouteillesParCasier: n, consigne: c }); onFait(); }
    catch (e) { onErreur(e instanceof Error ? e.message : t('Erreur', 'Error')); }
    finally { setEnvoi(false); }
  };

  return (
    <Modale titre={t('Casier et consigne', 'Crate and deposit')} onFermer={onFermer} testid="form-conditionnement">
      <label style={etiquette}>{t('Produit', 'Product')}
        <select data-testid="champ-produit" value={choix} onChange={e => setChoix(e.target.value)} disabled={!!productId} style={champ}>
          <option value="">{t('— choisir —', '— choose —')}</option>
          {liste.map(p => <option key={p._id} value={p._id}>{displayName(p.name)}</option>)}
        </select>
      </label>
      <label style={etiquette}>{t('Bouteilles par casier', 'Bottles per crate')}
        <input data-testid="champ-par-casier" inputMode="numeric" value={parCasier} onChange={e => setParCasier(e.target.value.replace(/[^\d]/g, ''))} style={champ} />
      </label>
      <label style={etiquette}>{t('Consigne par bouteille (F) — 0 = aucune', 'Deposit per bottle (F) — 0 = none')}
        <input data-testid="champ-consigne" inputMode="numeric" value={consigne} onChange={e => setConsigne(e.target.value.replace(/[^\d]/g, ''))} style={champ} />
      </label>
      <PiedModale onFermer={onFermer} onValider={valider} envoi={envoi} libelle={t('Enregistrer', 'Save')} testid="btn-valider-conditionnement" />
    </Modale>
  );
}

function FormReception({ ligne, onFermer, onFait, onErreur }: {
  ligne: LigneReserve; onFermer: () => void; onFait: (bouteilles: number) => void; onErreur: (m: string) => void;
}) {
  const [casiers, setCasiers] = useState('1');
  const [videsRendus, setVidesRendus] = useState('0');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [cle] = useState(nouvelleCle);   // une clé par formulaire ouvert : le double clic ne compte qu'une fois
  const n = Number(casiers) || 0;
  const bouteilles = n * ligne.bouteillesParCasier;

  const valider = async () => {
    const v = Number(videsRendus) || 0;
    if (n < 1) return onErreur(t('Au moins un casier', 'At least one crate'));
    if (v > ligne.videsEnReserve) return onErreur(t(`Vides rendus : au plus ${ligne.videsEnReserve}`, `Empties returned: at most ${ligne.videsEnReserve}`));
    setEnvoi(true);
    try {
      await receptionnerCasiers({ productId: ligne.productId, casiers: n, videsRendus: v, note: note.trim() || undefined, idempotencyKey: cle });
      onFait(bouteilles);
    } catch (e) { onErreur(e instanceof Error ? e.message : t('Erreur', 'Error')); }
    finally { setEnvoi(false); }
  };

  return (
    <Modale titre={`${t('Réception', 'Delivery')} — ${ligne.nomProduit}`} onFermer={onFermer} testid="form-reception">
      <label style={etiquette}>{t('Casiers reçus', 'Crates received')}
        <input data-testid="champ-casiers" inputMode="numeric" value={casiers} onChange={e => setCasiers(e.target.value.replace(/[^\d]/g, ''))} style={champ} />
      </label>
      <div data-testid="apercu-bouteilles" style={{ fontSize: 14, color: 'var(--fs-ink-700)' }}>
        = <b>{bouteilles}</b> {t('bouteilles ajoutées au stock', 'bottles added to stock')} ({n} × {ligne.bouteillesParCasier})
      </div>
      <label style={etiquette}>{t(`Vides rendus au livreur (en réserve : ${ligne.videsEnReserve})`, `Empties given back to the supplier (in stock: ${ligne.videsEnReserve})`)}
        <input data-testid="champ-vides-rendus" inputMode="numeric" value={videsRendus} onChange={e => setVidesRendus(e.target.value.replace(/[^\d]/g, ''))} style={champ} />
      </label>
      <label style={etiquette}>{t('Note (livreur, bon…)', 'Note (supplier, slip…)')}
        <input data-testid="champ-note" value={note} onChange={e => setNote(e.target.value)} maxLength={200} style={champ} />
      </label>
      <PiedModale onFermer={onFermer} onValider={valider} envoi={envoi} libelle={t('Réceptionner', 'Record delivery')} testid="btn-valider-reception" />
    </Modale>
  );
}

function FormCasse({ ligne, onFermer, onFait, onErreur }: {
  ligne: LigneReserve; onFermer: () => void; onFait: (bouteilles: number) => void; onErreur: (m: string) => void;
}) {
  const [bouteilles, setBouteilles] = useState('1');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [cle] = useState(nouvelleCle);
  const n = Number(bouteilles) || 0;

  const valider = async () => {
    if (n < 1) return onErreur(t('Au moins une bouteille', 'At least one bottle'));
    if (n > ligne.stock) return onErreur(t(`Stock : ${ligne.stock} bouteilles au plus`, `Stock: at most ${ligne.stock} bottles`));
    setEnvoi(true);
    try {
      await declarerCasse({ productId: ligne.productId, bouteilles: n, note: note.trim() || undefined, idempotencyKey: cle });
      onFait(n);
    } catch (e) { onErreur(e instanceof Error ? e.message : t('Erreur', 'Error')); }
    finally { setEnvoi(false); }
  };

  return (
    <Modale titre={`${t('Casse', 'Breakage')} — ${ligne.nomProduit}`} onFermer={onFermer} testid="form-casse">
      <label style={etiquette}>{t('Bouteilles cassées', 'Broken bottles')}
        <input data-testid="champ-bouteilles" inputMode="numeric" value={bouteilles} onChange={e => setBouteilles(e.target.value.replace(/[^\d]/g, ''))} style={champ} />
      </label>
      <label style={etiquette}>{t('Motif (chute, casier tombé…)', 'Reason (fall, dropped crate…)')}
        <input data-testid="champ-note" value={note} onChange={e => setNote(e.target.value)} maxLength={200} style={champ} />
      </label>
      <PiedModale onFermer={onFermer} onValider={valider} envoi={envoi} libelle={t('Déclarer la casse', 'Record breakage')} testid="btn-valider-casse" />
    </Modale>
  );
}

// ── Briques ───────────────────────────────────────────────────────────────────

function Tuile({ titre, valeur, testid }: { titre: string; valeur: string; testid: string }) {
  return (
    <div data-testid={testid} style={{ background: '#fff', border: '1px solid #E6DED5', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: 'var(--fs-ink-500)', fontWeight: 700 }}>{titre}</div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--fs-font-mono)' }}>{valeur}</div>
    </div>
  );
}

function Modale({ titre, onFermer, testid, children }: { titre: string; onFermer: () => void; testid: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }} onClick={onFermer}>
      <div data-testid={testid} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(460px, 94vw)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>{titre}</div>
        {children}
      </div>
    </div>
  );
}

function PiedModale({ onFermer, onValider, envoi, libelle, testid }: { onFermer: () => void; onValider: () => void; envoi: boolean; libelle: string; testid: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
      <button type="button" onClick={onFermer} style={boutonLigne}>{t('Annuler', 'Cancel')}</button>
      <button type="button" data-testid={testid} onClick={onValider} disabled={envoi} style={boutonPrincipal}>{envoi ? t('Enregistrement…', 'Saving…') : libelle}</button>
    </div>
  );
}

const boutonPrincipal: React.CSSProperties = { minHeight: 44, border: 'none', borderRadius: 10, padding: '0 16px', background: 'var(--fs-wine-700)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' };
const boutonLigne: React.CSSProperties = { minHeight: 36, border: '1px solid #D9CFC4', borderRadius: 8, padding: '0 10px', background: '#fff', color: 'var(--fs-ink-700)', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginLeft: 6 };
const etiquette: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-700)' };
const champ: React.CSSProperties = { minHeight: 42, fontSize: 15, padding: '0 10px', border: '1px solid #D9CFC4', borderRadius: 8, fontWeight: 500 };
