import React, { useEffect, useMemo, useRef, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { getAllProducts, Product } from '../api/products';
import {
  FactureFournisseur, LigneValidee, getFactures, importerFacture, ouvrirJustificatif, rejeterFacture, validerFacture,
} from '../api/facturesFournisseurs';
import { contientTexte, displayName } from '../utils/text';
import { useIsMobile } from '../hooks/useIsMobile';
import { t, dateLocale } from '../i18n';

/**
 * Factures fournisseurs — scanner, lire, CONTRÔLER, valider.
 *
 * La lecture automatique propose ; la personne décide, ligne par ligne :
 * produit existant (appariement proposé, modifiable), produit à créer, ou
 * ligne ignorée (transport, remise). La validation déclenche la réception
 * fournisseur standard : stock entrepôt, mouvements tracés, justificatif
 * archivé et relié.
 */

type Mode = 'existant' | 'nouveau' | 'ignorer';
interface LigneEdit {
  designation: string;
  quantite: string;
  prixUnitaire: string;
  mode: Mode;
  produitId: string | null;
  produitNom: string;
  nouveauNom: string;
  nouveauPrix: string;
  recherche: string;
}

const fmtN = (n: number) => Math.round(n).toLocaleString(dateLocale());
const STATUTS = [
  { key: 'a_verifier', label: t('À vérifier', 'To review'),  couleur: '#B45309', fond: '#FEF3C7' },
  { key: 'validee',    label: t('Validées', 'Validated'),    couleur: '#166534', fond: '#DCFCE7' },
  { key: 'rejetee',    label: t('Rejetées', 'Rejected'),     couleur: '#991B1B', fond: '#FEE2E2' },
] as const;
const CONFIANCE: Record<string, { label: string; couleur: string }> = {
  haute:   { label: t('Lecture nette', 'Clear read'),       couleur: '#166534' },
  moyenne: { label: t('Lecture à vérifier', 'Check the read'), couleur: '#B45309' },
  basse:   { label: t('Lecture difficile', 'Poor read'),   couleur: '#991B1B' },
};

const versEdit = (f: FactureFournisseur): LigneEdit[] => f.lignes.map(l => ({
  designation: l.designation,
  quantite: String(l.quantite ?? ''),
  prixUnitaire: l.prixUnitaire == null ? '' : String(l.prixUnitaire),
  mode: l.appariement === 'existant' && l.produitId ? 'existant' : 'nouveau',
  produitId: l.produitId,
  produitNom: l.produitNom ?? '',
  nouveauNom: displayName(l.designation),
  nouveauPrix: '',
  recherche: '',
}));

export default function StocksFactures() {
  const { toasts, addToast, removeToast } = useToast();
  const isNarrow = useIsMobile(1024);
  const fileRef = useRef<HTMLInputElement>(null);

  const [produits, setProduits] = useState<Product[]>([]);
  const [factures, setFactures] = useState<FactureFournisseur[]>([]);
  const [filtre, setFiltre] = useState<'a_verifier' | 'validee' | 'rejetee' | 'toutes'>('a_verifier');
  const [selection, setSelection] = useState<FactureFournisseur | null>(null);
  const [lignes, setLignes] = useState<LigneEdit[]>([]);
  const [fournisseur, setFournisseur] = useState('');
  const [numero, setNumero] = useState('');
  const [majPrixAchat, setMajPrixAchat] = useState(false);
  const [lecture, setLecture] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const charger = async () => {
    try { setFactures(await getFactures()); }
    catch (e) { addToast(e instanceof Error ? e.message : t('Erreur', 'Error'), 'error'); }
  };
  useEffect(() => { charger(); getAllProducts().then(setProduits).catch(() => {}); }, []);

  const ouvrir = (f: FactureFournisseur) => {
    setSelection(f); setLignes(versEdit(f)); setFournisseur(f.fournisseur); setNumero(f.numeroFacture); setMajPrixAchat(false);
  };

  const visibles = useMemo(() => filtre === 'toutes' ? factures : factures.filter(f => f.statut === filtre), [factures, filtre]);

  // ── Import ─────────────────────────────────────────────────────────────────
  const surFichier = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    setLecture(true);
    try {
      const f = await importerFacture(fichier);
      addToast(t(`Facture lue : ${f.lignes.length} ligne(s) — à vérifier`, `Invoice read: ${f.lignes.length} line(s) — please review`), 'success');
      await charger(); setFiltre('a_verifier'); ouvrir(f);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('Échec de la lecture', 'Reading failed'), 'error');
    } finally { setLecture(false); }
  };

  // ── Édition des lignes ─────────────────────────────────────────────────────
  const maj = (i: number, patch: Partial<LigneEdit>) => setLignes(ls => ls.map((l, k) => k === i ? { ...l, ...patch } : l));
  const candidats = (q: string) => q.trim().length < 2 ? [] : produits.filter(p => contientTexte(p.name, q) || contientTexte(p.barcode ?? '', q)).slice(0, 8);

  // ── Validation / rejet ─────────────────────────────────────────────────────
  const valider = async () => {
    if (!selection) return;
    const corps: LigneValidee[] = [];
    for (const l of lignes) {
      if (l.mode === 'ignorer') { corps.push({ designation: l.designation, quantite: 0, ignorer: true }); continue; }
      const quantite = Number(l.quantite);
      if (!quantite || quantite <= 0) { addToast(t(`Quantité manquante : ${l.designation}`, `Missing quantity: ${l.designation}`), 'error'); return; }
      if (l.mode === 'existant' && !l.produitId) { addToast(t(`Choisissez le produit : ${l.designation}`, `Pick the product: ${l.designation}`), 'error'); return; }
      corps.push({
        designation: l.designation, quantite,
        prixUnitaire: l.prixUnitaire === '' ? null : Number(l.prixUnitaire),
        produitId: l.mode === 'existant' ? l.produitId : null,
        creer: l.mode === 'nouveau' ? { name: l.nouveauNom.trim() || l.designation, price: Number(l.nouveauPrix) || 0 } : null,
      });
    }
    setOccupe(true);
    try {
      const r = await validerFacture(selection._id, { fournisseur, numeroFacture: numero, lignes: corps, mettreAJourPrixAchat: majPrixAchat });
      addToast(t(`✓ ${r.articlesRecus} article(s) en entrepôt, ${r.produitsCrees} produit(s) créé(s)`, `✓ ${r.articlesRecus} item(s) in warehouse, ${r.produitsCrees} product(s) created`), 'success');
      await charger(); setSelection(null);
      getAllProducts().then(setProduits).catch(() => {});
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('Échec de la validation', 'Validation failed'), 'error');
    } finally { setOccupe(false); }
  };

  const rejeter = async () => {
    if (!selection) return;
    const motif = window.prompt(t('Motif du rejet (obligatoire) :', 'Reason for rejection (required):'), '');
    if (motif == null) return;
    setOccupe(true);
    try {
      await rejeterFacture(selection._id, motif);
      addToast(t('Facture rejetée', 'Invoice rejected'), 'success');
      await charger(); setSelection(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('Échec du rejet', 'Rejection failed'), 'error');
    } finally { setOccupe(false); }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  const badge = (statut: FactureFournisseur['statut']) => {
    const s = STATUTS.find(x => x.key === statut)!;
    return <span style={{ background: s.fond, color: s.couleur, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, letterSpacing: '0.04em' }}>{s.label}</span>;
  };
  const champ: React.CSSProperties = { border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '6px 8px', fontSize: 12, fontFamily: 'var(--fs-font-sans)', background: '#fff', width: '100%' };
  const bouton = (fond: string, couleur = '#fff'): React.CSSProperties => ({ padding: '9px 16px', border: 'none', borderRadius: 8, background: fond, color: couleur, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' });

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* En-tête */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Gestion de stock', 'Stock management')}</p>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>{t('Factures fournisseurs', 'Supplier invoices')}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {([...STATUTS.map(s => ({ key: s.key, label: s.label })), { key: 'toutes', label: t('Toutes', 'All') }] as { key: typeof filtre; label: string }[]).map(o => (
              <button key={o.key} onClick={() => setFiltre(o.key)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: filtre === o.key ? 'none' : '1.5px solid var(--fs-line-2)', background: filtre === o.key ? 'var(--fs-wine-700)' : '#fff', color: filtre === o.key ? '#fff' : 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)' }}>
                {o.label} <span style={{ opacity: 0.7 }}>({o.key === 'toutes' ? factures.length : factures.filter(f => f.statut === o.key).length})</span>
              </button>
            ))}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} onChange={surFichier}/>
            <button onClick={() => fileRef.current?.click()} disabled={lecture} style={{ ...bouton('var(--fs-wine-700)'), opacity: lecture ? 0.6 : 1 }}>
              {lecture ? t('Lecture en cours…', 'Reading…') : t('📷 Scanner / Importer une facture', '📷 Scan / Import an invoice')}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: isNarrow ? 'column' : 'row', overflow: 'hidden' }}>
          {/* Liste */}
          <div style={{ width: isNarrow ? '100%' : 340, flexShrink: 0, overflowY: 'auto', borderRight: isNarrow ? 'none' : '1px solid var(--fs-line)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibles.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13, padding: '40px 10px', lineHeight: 1.6 }}>
                {t('Aucune facture ici.', 'No invoice here.')}<br/>
                {filtre === 'a_verifier' && t('Photographiez ou importez une facture fournisseur : elle sera lue automatiquement et proposée ici pour contrôle.', 'Take a photo of or import a supplier invoice: it will be read automatically and proposed here for review.')}
              </div>
            )}
            {visibles.map(f => (
              <div key={f._id} onClick={() => ouvrir(f)} style={{ background: '#fff', border: `2px solid ${selection?._id === f._id ? 'var(--fs-wine-700)' : 'var(--fs-line)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fournisseur || t('Fournisseur non lu', 'Supplier not read')}</div>
                  {badge(f.statut)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 3 }}>
                  {f.numeroFacture ? `n° ${f.numeroFacture} · ` : ''}{f.lignes.length} {t('ligne(s)', 'line(s)')}{f.total != null ? ` · ${fmtN(f.total)} XAF` : ''}
                </div>
                <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 2 }}>{new Date(f.createdAt).toLocaleString(dateLocale())} · <span style={{ color: CONFIANCE[f.confiance]?.couleur }}>{CONFIANCE[f.confiance]?.label}</span></div>
              </div>
            ))}
          </div>

          {/* Détail / contrôle */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isNarrow ? 14 : 20 }}>
            {!selection ? (
              <div style={{ color: 'var(--fs-ink-400)', fontSize: 13, textAlign: 'center', padding: 60 }}>{t('Sélectionnez une facture pour la contrôler.', 'Select an invoice to review it.')}</div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 8, flex: 1, minWidth: 260 }}>
                    <label style={{ fontSize: 11, color: 'var(--fs-ink-500)', fontWeight: 600 }}>{t('Fournisseur', 'Supplier')}
                      <input value={fournisseur} onChange={e => setFournisseur(e.target.value)} disabled={selection.statut !== 'a_verifier'} style={{ ...champ, marginTop: 3 }}/></label>
                    <label style={{ fontSize: 11, color: 'var(--fs-ink-500)', fontWeight: 600 }}>{t('N° de facture', 'Invoice no.')}
                      <input value={numero} onChange={e => setNumero(e.target.value)} disabled={selection.statut !== 'a_verifier'} style={{ ...champ, marginTop: 3 }}/></label>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--fs-ink-500)', lineHeight: 1.6 }}>
                    {badge(selection.statut)}<br/>
                    {selection.dateFacture && <>{t('Date facture', 'Invoice date')} : <b>{selection.dateFacture}</b><br/></>}
                    {selection.total != null && <>{t('Total lu', 'Read total')} : <b>{fmtN(selection.total)} XAF</b><br/></>}
                    <span style={{ color: CONFIANCE[selection.confiance]?.couleur, fontWeight: 700 }}>{CONFIANCE[selection.confiance]?.label}</span>
                  </div>
                </div>
                {selection.remarques && (
                  <div style={{ background: '#FEF3C7', color: '#92400E', fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>⚠ {selection.remarques}</div>
                )}
                {selection.statut === 'rejetee' && selection.motifRejet && (
                  <div style={{ background: '#FEE2E2', color: '#991B1B', fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>{t('Rejetée', 'Rejected')} : {selection.motifRejet}</div>
                )}

                {/* Lignes */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 720 }}>
                    <thead>
                      <tr style={{ background: 'var(--fs-ivory)', textAlign: 'left' }}>
                        {[t('Désignation lue', 'Read label'), t('Qté', 'Qty'), t('P.U.', 'Unit price'), t('Produit en stock', 'Stock product')].map(h => (
                          <th key={h} style={{ padding: '8px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fs-ink-500)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((l, i) => {
                        const fige = selection.statut !== 'a_verifier';
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--fs-line)', opacity: l.mode === 'ignorer' ? 0.5 : 1 }}>
                            <td style={{ padding: '8px 10px', minWidth: 200 }}>
                              <input value={l.designation} disabled={fige} onChange={e => maj(i, { designation: e.target.value })} style={champ}/>
                            </td>
                            <td style={{ padding: '8px 10px', width: 80 }}>
                              <input type="number" min={0} value={l.quantite} disabled={fige} onChange={e => maj(i, { quantite: e.target.value })} style={{ ...champ, fontFamily: 'var(--fs-font-mono)' }}/>
                            </td>
                            <td style={{ padding: '8px 10px', width: 110 }}>
                              <input type="number" min={0} value={l.prixUnitaire} disabled={fige} onChange={e => maj(i, { prixUnitaire: e.target.value })} style={{ ...champ, fontFamily: 'var(--fs-font-mono)' }}/>
                            </td>
                            <td style={{ padding: '8px 10px', minWidth: 260 }}>
                              {fige ? (
                                <span>{l.produitNom || l.nouveauNom}</span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    {(['existant', 'nouveau', 'ignorer'] as Mode[]).map(m => (
                                      <button key={m} onClick={() => maj(i, { mode: m })} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--fs-line-2)', background: l.mode === m ? 'var(--fs-wine-700)' : '#fff', color: l.mode === m ? '#fff' : 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)' }}>
                                        {m === 'existant' ? t('Existant', 'Existing') : m === 'nouveau' ? t('Nouveau', 'New') : t('Ignorer', 'Skip')}
                                      </button>
                                    ))}
                                  </div>
                                  {l.mode === 'existant' && (
                                    <div style={{ position: 'relative' }}>
                                      <input value={l.recherche || (l.produitId ? displayName(l.produitNom) : '')} placeholder={t('Rechercher un produit…', 'Search a product…')}
                                        onChange={e => maj(i, { recherche: e.target.value, produitId: null, produitNom: '' })} style={{ ...champ, borderColor: l.produitId ? '#16A34A' : '#F59E0B' }}/>
                                      {l.recherche && candidats(l.recherche).length > 0 && (
                                        <div style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--fs-line-2)', borderRadius: 8, boxShadow: 'var(--fs-shadow-md)', maxHeight: 200, overflowY: 'auto' }}>
                                          {candidats(l.recherche).map(p => (
                                            <div key={p._id} onClick={() => maj(i, { produitId: p._id, produitNom: p.name, recherche: '' })} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--fs-line)' }}>
                                              {displayName(p.name)} <span style={{ color: 'var(--fs-ink-400)', fontSize: 10 }}>{p.barcode ? `· ${p.barcode}` : ''} · {t('stock entrepôt', 'warehouse stock')} {p.stockMagazin ?? 0}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {l.mode === 'nouveau' && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <input value={l.nouveauNom} onChange={e => maj(i, { nouveauNom: e.target.value })} placeholder={t('Nom du nouveau produit', 'New product name')} style={champ}/>
                                      <input type="number" min={0} value={l.nouveauPrix} onChange={e => maj(i, { nouveauPrix: e.target.value })} placeholder={t('Prix de vente', 'Selling price')} style={{ ...champ, width: 120, fontFamily: 'var(--fs-font-mono)' }}/>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <button onClick={() => ouvrirJustificatif(selection._id).catch(e => addToast(e.message, 'error'))} style={bouton('#fff', 'var(--fs-ink-700)')}>
                    📎 {t('Voir le justificatif', 'View attachment')} <span style={{ fontWeight: 400, fontSize: 11 }}>({selection.nomFichier}, {Math.round(selection.taille / 1024)} Ko)</span>
                  </button>
                  {selection.statut === 'a_verifier' && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: 12, color: 'var(--fs-ink-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={majPrixAchat} onChange={e => setMajPrixAchat(e.target.checked)}/>
                        {t('Reporter les prix dans le prix d’achat', 'Update purchase prices')}
                      </label>
                      <button onClick={rejeter} disabled={occupe} style={bouton('#FEE2E2', '#991B1B')}>{t('Rejeter', 'Reject')}</button>
                      <button onClick={valider} disabled={occupe} style={{ ...bouton('#1D7A4E'), opacity: occupe ? 0.6 : 1 }}>
                        {occupe ? t('Enregistrement…', 'Saving…') : t('✓ Valider → réception en entrepôt', '✓ Validate → warehouse receipt')}
                      </button>
                    </div>
                  )}
                  {selection.statut === 'validee' && (
                    <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>{t('Réception enregistrée', 'Receipt recorded')}{selection.valideeLe ? ` · ${new Date(selection.valideeLe).toLocaleString(dateLocale())}` : ''}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
