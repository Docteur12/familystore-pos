import React, { useEffect, useMemo, useRef, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  getFournisseurs, FournisseurRecord,
  getEvaluationFournisseurs, EvaluationFournisseurs, PeriodeEval,
  getSerieVentes, PointSerie, Granularite,
  getStockEvolution, SnapshotStock,
  getVersementsFournisseur, createVersementFournisseur, deleteVersementFournisseur, VersementFournisseur,
  getRetoursFournisseur, createRetourFournisseur, deleteRetourFournisseur, RetourFournisseur,
} from '../api/fournisseurs';
import { getAllProducts, Product } from '../api/products';
import { contientTexte } from '../utils/text';

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const PERIODES: { key: PeriodeEval; label: string }[] = [
  { key: 'semaine', label: 'Cette semaine' },
  { key: 'mois', label: 'Ce mois' },
  { key: 'trimestre', label: 'Ce trimestre' },
  { key: 'annee', label: 'Cette année' },
  { key: 'tout', label: 'Tout' },
];

const GRANS: { key: Granularite; label: string }[] = [
  { key: 'jour', label: 'Par jour' },
  { key: 'semaine', label: 'Par semaine' },
  { key: 'mois', label: 'Par mois' },
  { key: 'trimestre', label: 'Par trimestre' },
  { key: 'annee', label: 'Par année' },
];

const INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)',
  borderRadius: 8, fontSize: 13, fontFamily: 'var(--fs-font-sans)', outline: 'none',
  background: '#fff', color: 'var(--fs-ink-900)', boxSizing: 'border-box',
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: '10px 20px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none',
  borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)',
};
const CARD: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12,
  padding: 20, boxShadow: 'var(--fs-shadow-sm)',
};
const TH: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fs-ink-500)' };
const TD: React.CSSProperties = { padding: '10px 12px', fontSize: 13 };
const NUM: React.CSSProperties = { ...TD, textAlign: 'right', fontFamily: 'var(--fs-font-mono)', whiteSpace: 'nowrap' };

// Sélecteur de produit avec recherche (accents ignorés)
function ProduitPicker({ products, value, onChange }: { products: Product[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const list = useMemo(() => {
    const base = q.trim() ? products.filter(p => contientTexte(p.name, q) || contientTexte(p.localName ?? '', q) || (p.barcode ?? '').includes(q)) : products;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [products, q]);
  const sel = products.find(p => p._id === value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input value={open ? q : (sel?.name ?? '')} placeholder="Rechercher un produit…"
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={e => { setQ(e.target.value); setOpen(true); }} style={INPUT}/>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid var(--fs-line-2)', borderRadius: 8, maxHeight: 240, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          <div style={{ padding: '5px 10px', fontSize: 10, color: 'var(--fs-ink-400)', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: 'var(--fs-ivory)' }}>
            {list.length} produit(s) — tapez pour filtrer
          </div>
          {list.map(p => (
            <div key={p._id} onClick={() => { onChange(p._id); setOpen(false); }}
              style={{ padding: '8px 10px', fontSize: 12.5, cursor: 'pointer', borderBottom: '1px solid var(--fs-line)', background: p._id === value ? 'var(--fs-ivory)' : '#fff' }}>
              {p.name}{p.fournisseur ? <span style={{ color: 'var(--fs-ink-400)', fontSize: 11 }}> · {p.fournisseur}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = 'evaluation' | 'courbes' | 'stock' | 'versements' | 'retours';

export default function AdminFournisseurs() {
  const { toasts, addToast, removeToast } = useToast();
  const [tab, setTab] = useState<Tab>('evaluation');
  const [fiches, setFiches] = useState<FournisseurRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    getFournisseurs().then(setFiches).catch(() => {});
    getAllProducts().then(setProducts).catch(() => {});
  }, []);

  // Noms de fournisseurs proposés (fiches + champ libre des produits)
  const nomsFournisseurs = useMemo(() => {
    const s = new Set<string>();
    fiches.forEach(f => s.add(f.name));
    products.forEach(p => { if (p.fournisseur) s.add(p.fournisseur); });
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [fiches, products]);

  // ── Onglet Évaluation ────────────────────────────────────────────────────────
  const [periode, setPeriode] = useState<PeriodeEval>('mois');
  const [evalData, setEvalData] = useState<EvaluationFournisseurs | null>(null);
  const [loadingEval, setLoadingEval] = useState(false);
  const chargerEval = () => {
    setLoadingEval(true);
    getEvaluationFournisseurs(periode).then(setEvalData).catch(() => addToast('Erreur chargement évaluation', 'error')).finally(() => setLoadingEval(false));
  };
  useEffect(chargerEval, [periode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Onglet Courbes des ventes ────────────────────────────────────────────────
  const [modeCourbe, setModeCourbe] = useState<'fournisseur' | 'produit'>('fournisseur');
  const [courbeFourn, setCourbeFourn] = useState('');
  const [courbeProd, setCourbeProd] = useState('');
  const [gran, setGran] = useState<Granularite>('semaine');
  const [serie, setSerie] = useState<PointSerie[]>([]);
  const [loadingSerie, setLoadingSerie] = useState(false);
  useEffect(() => {
    const cible = modeCourbe === 'fournisseur' ? courbeFourn : courbeProd;
    if (!cible) { setSerie([]); return; }
    setLoadingSerie(true);
    getSerieVentes(modeCourbe === 'fournisseur' ? { fournisseur: courbeFourn, granularite: gran } : { productId: courbeProd, granularite: gran })
      .then(setSerie).catch(() => addToast('Erreur chargement de la courbe', 'error')).finally(() => setLoadingSerie(false));
  }, [modeCourbe, courbeFourn, courbeProd, gran]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Onglet Valeur du stock ───────────────────────────────────────────────────
  const [stockJours, setStockJours] = useState(90);
  const [typeValeur, setTypeValeur] = useState<'achat' | 'vente'>('achat');
  const [snaps, setSnaps] = useState<SnapshotStock[]>([]);
  useEffect(() => {
    if (tab !== 'stock') return;
    getStockEvolution(stockJours).then(setSnaps).catch(() => addToast('Erreur chargement évolution du stock', 'error'));
  }, [tab, stockJours]); // eslint-disable-line react-hooks/exhaustive-deps

  const dataStock = useMemo(() => snaps.map(s => ({
    date: `${s.dateKey.slice(8, 10)}/${s.dateKey.slice(5, 7)}`,
    Boutique: typeValeur === 'achat' ? s.achatBoutique : s.venteBoutique,
    'Entrepôt': typeValeur === 'achat' ? s.achatEntrepot : s.venteEntrepot,
    Total: (typeValeur === 'achat' ? s.achatBoutique + s.achatEntrepot : s.venteBoutique + s.venteEntrepot),
  })), [snaps, typeValeur]);

  // ── Onglet Versements ────────────────────────────────────────────────────────
  const [versements, setVersements] = useState<VersementFournisseur[]>([]);
  const [vForm, setVForm] = useState({ fournisseur: '', montant: '', note: '', date: new Date().toISOString().slice(0, 10) });
  const [busyV, setBusyV] = useState(false);
  const [confirmDelV, setConfirmDelV] = useState<string | null>(null);
  const chargerVersements = () => getVersementsFournisseur().then(setVersements).catch(() => {});
  useEffect(() => { if (tab === 'versements') chargerVersements(); }, [tab]);

  const enregistrerVersement = async () => {
    const montant = parseInt(vForm.montant) || 0;
    if (!vForm.fournisseur) { addToast('Choisissez un fournisseur', 'error'); return; }
    if (montant <= 0) { addToast('Saisissez un montant valide', 'error'); return; }
    setBusyV(true);
    try {
      await createVersementFournisseur({ fournisseur: vForm.fournisseur, montant, note: vForm.note, date: vForm.date });
      addToast(`Versement de ${fmtN(montant)} XAF à ${vForm.fournisseur} enregistré ✓`, 'success');
      setVForm(f => ({ ...f, montant: '', note: '' }));
      chargerVersements();
      chargerEval();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
    finally { setBusyV(false); }
  };

  const supprimerVersement = async (id: string) => {
    try {
      await deleteVersementFournisseur(id);
      addToast('Versement supprimé — la dette est recalculée', 'success');
      setConfirmDelV(null);
      chargerVersements();
      chargerEval();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  // ── Onglet Retours ───────────────────────────────────────────────────────────
  type LigneRetour = { productId: string; quantite: string; origine: 'boutique' | 'entrepot' };
  const [retours, setRetours] = useState<RetourFournisseur[]>([]);
  const [rForm, setRForm] = useState<{ fournisseur: string; note: string; lignes: LigneRetour[] }>({ fournisseur: '', note: '', lignes: [{ productId: '', quantite: '1', origine: 'entrepot' }] });
  const [busyR, setBusyR] = useState(false);
  const [confirmDelR, setConfirmDelR] = useState<string | null>(null);
  const chargerRetours = () => getRetoursFournisseur().then(setRetours).catch(() => {});
  useEffect(() => { if (tab === 'retours') chargerRetours(); }, [tab]);

  const setLigneR = (i: number, patch: Partial<LigneRetour>) =>
    setRForm(f => ({ ...f, lignes: f.lignes.map((l, j) => j === i ? { ...l, ...patch } : l) }));

  const enregistrerRetour = async () => {
    if (!rForm.fournisseur) { addToast('Choisissez le fournisseur destinataire', 'error'); return; }
    const lignes = rForm.lignes
      .filter(l => l.productId && (parseInt(l.quantite) || 0) > 0)
      .map(l => ({ productId: l.productId, quantite: parseInt(l.quantite) || 0, origine: l.origine }));
    if (lignes.length === 0) { addToast('Ajoutez au moins un produit à retourner', 'error'); return; }
    setBusyR(true);
    try {
      await createRetourFournisseur({ fournisseur: rForm.fournisseur, note: rForm.note, lignes });
      addToast('Retour fournisseur enregistré ✓ — stock mis à jour', 'success');
      setRForm({ fournisseur: rForm.fournisseur, note: '', lignes: [{ productId: '', quantite: '1', origine: 'entrepot' }] });
      chargerRetours();
      getAllProducts().then(setProducts).catch(() => {});
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
    finally { setBusyR(false); }
  };

  const annulerRetour = async (id: string) => {
    try {
      await deleteRetourFournisseur(id);
      addToast('Retour annulé — quantités remises en stock', 'success');
      setConfirmDelR(null);
      chargerRetours();
      getAllProducts().then(setProducts).catch(() => {});
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  // Pré-remplir un versement depuis le tableau d'évaluation
  const verserDepuisEval = (nom: string, dette: number) => {
    setVForm({ fournisseur: nom, montant: dette > 0 ? String(dette) : '', note: '', date: new Date().toISOString().slice(0, 10) });
    setTab('versements');
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'evaluation', label: '📊 Évaluation & dettes' },
    { key: 'courbes', label: '📈 Courbes des ventes' },
    { key: 'stock', label: '📦 Valeur du stock' },
    { key: 'versements', label: '💰 Versements' },
    { key: 'retours', label: '↩ Retours fournisseur' },
  ];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <AdminSidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Approvisionnement</p>
        <h1 style={{ margin: '2px 0 18px', fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)' }}>Fournisseurs — ventes, versements & dettes</h1>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '8px 16px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                border: tab === t.key ? 'none' : '1.5px solid var(--fs-line-2)',
                background: tab === t.key ? 'var(--fs-wine-700)' : '#fff',
                color: tab === t.key ? '#fff' : 'var(--fs-ink-600)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ Évaluation ══ */}
        {tab === 'evaluation' && (
          <div style={{ maxWidth: 1080 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              {PERIODES.map(p => (
                <button key={p.key} onClick={() => setPeriode(p.key)}
                  style={{ padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: periode === p.key ? 'none' : '1px solid var(--fs-line-2)',
                    background: periode === p.key ? 'var(--fs-ink-900)' : '#fff',
                    color: periode === p.key ? '#fff' : 'var(--fs-ink-600)' }}>
                  {p.label}
                </button>
              ))}
              {loadingEval && <span style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>Chargement…</span>}
            </div>

            {evalData && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
                  {[
                    { t: 'Vendu (prix de vente)', v: evalData.totaux.caVendu, c: 'var(--fs-ink-900)' },
                    { t: 'À verser sur la période (prix d\'achat)', v: evalData.totaux.coutVendu, c: '#B45309' },
                    { t: 'Versements de la période', v: evalData.totaux.versements, c: '#16a34a' },
                    { t: 'Dette totale restante', v: evalData.totaux.dette, c: 'var(--fs-danger-700)' },
                  ].map((k, i) => (
                    <div key={i} style={{ ...CARD, padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, color: 'var(--fs-ink-500)', fontWeight: 600, marginBottom: 4 }}>{k.t}</div>
                      <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: k.c }}>{fmtN(k.v)} XAF</div>
                    </div>
                  ))}
                </div>

                <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--fs-ivory)' }}>
                          <th style={TH}>Fournisseur</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Qté vendue</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Montant vendu</th>
                          <th style={{ ...TH, textAlign: 'right' }}>À verser (période)</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Versé (période)</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Retours</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Dette restante*</th>
                          <th style={TH}/>
                        </tr>
                      </thead>
                      <tbody>
                        {evalData.rows.map((r, i) => (
                          <tr key={r.fournisseur} style={{ borderTop: '1px solid var(--fs-line)', background: i % 2 ? 'var(--fs-ivory)' : '#fff' }}>
                            <td style={{ ...TD, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                              {r.fournisseur}
                              {r.phone && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--fs-ink-400)' }}>{r.phone}</div>}
                            </td>
                            <td style={NUM}>{fmtN(r.qteVendue)}</td>
                            <td style={NUM}>{fmtN(r.caVendu)}</td>
                            <td style={{ ...NUM, color: '#B45309', fontWeight: 700 }}>{fmtN(r.coutVendu)}</td>
                            <td style={{ ...NUM, color: '#16a34a' }}>{fmtN(r.versements)}</td>
                            <td style={NUM}>{r.retours ? fmtN(r.retours) : '—'}</td>
                            <td style={{ ...NUM, fontWeight: 800, color: r.dette > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>
                              {fmtN(r.dette)}
                            </td>
                            <td style={{ ...TD, textAlign: 'right' }}>
                              <button onClick={() => verserDepuisEval(r.fournisseur, r.dette)} title="Enregistrer un versement à ce fournisseur"
                                style={{ padding: '5px 12px', border: 'none', borderRadius: 7, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                💰 Verser
                              </button>
                            </td>
                          </tr>
                        ))}
                        {evalData.rows.length === 0 && (
                          <tr><td colSpan={8} style={{ ...TD, textAlign: 'center', color: 'var(--fs-ink-300)' }}>Aucune donnée sur cette période</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {evalData.sansFournisseur && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fs-ink-500)', background: '#FEF3C7', border: '1px solid rgba(180,83,9,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                    ⚠ {fmtN(evalData.sansFournisseur.caVendu)} XAF vendus sur la période concernent des produits <strong>sans fournisseur renseigné</strong> — complétez le champ « Fournisseur » de ces produits pour les classer.
                  </div>
                )}
                <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--fs-ink-400)' }}>
                  * La <strong>dette restante</strong> est cumulée depuis le début : valeur au prix d'achat de tout ce qui a été vendu − tous les versements effectués.
                  Les <strong>retours</strong> (marchandise renvoyée) sont informatifs : ils ne réduisent pas la dette, car on ne doit au fournisseur que ce qui a été vendu.
                </p>
              </>
            )}
          </div>
        )}

        {/* ══ Courbes des ventes ══ */}
        {tab === 'courbes' && (
          <div style={{ maxWidth: 980 }}>
            <div style={{ ...CARD, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ width: 190 }}>
                  <label style={LABEL}>Analyser</label>
                  <select value={modeCourbe} onChange={e => setModeCourbe(e.target.value as 'fournisseur' | 'produit')} style={{ ...INPUT, cursor: 'pointer' }}>
                    <option value="fournisseur">Un fournisseur</option>
                    <option value="produit">Un produit</option>
                  </select>
                </div>
                {modeCourbe === 'fournisseur' ? (
                  <div style={{ width: 260 }}>
                    <label style={LABEL}>Fournisseur</label>
                    <select value={courbeFourn} onChange={e => setCourbeFourn(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                      <option value="">— Choisir —</option>
                      {nomsFournisseurs.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                ) : (
                  <div style={{ width: 300 }}>
                    <label style={LABEL}>Produit</label>
                    <ProduitPicker products={products} value={courbeProd} onChange={setCourbeProd}/>
                  </div>
                )}
                <div style={{ width: 170 }}>
                  <label style={LABEL}>Regrouper</label>
                  <select value={gran} onChange={e => setGran(e.target.value as Granularite)} style={{ ...INPUT, cursor: 'pointer' }}>
                    {GRANS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ ...CARD }}>
              {loadingSerie ? (
                <div style={{ color: 'var(--fs-ink-400)', fontSize: 13, padding: 30, textAlign: 'center' }}>Chargement…</div>
              ) : serie.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13, padding: 30, textAlign: 'center' }}>
                  {modeCourbe === 'fournisseur' && !courbeFourn ? 'Choisissez un fournisseur pour afficher sa courbe de ventes.' :
                   modeCourbe === 'produit' && !courbeProd ? 'Choisissez un produit pour afficher sa courbe de ventes.' :
                   'Aucune vente trouvée sur la période analysée.'}
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={330}>
                    <LineChart data={serie} margin={{ top: 8, right: 18, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)"/>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
                      <YAxis yAxisId="ca" tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}/>
                      <YAxis yAxisId="qte" orientation="right" tick={{ fontSize: 11 }}/>
                      <Tooltip formatter={(v: number, name: string) => name === 'Montant vendu (XAF)' ? `${fmtN(v)} XAF` : fmtN(v)}/>
                      <Legend wrapperStyle={{ fontSize: 12 }}/>
                      <Line yAxisId="ca" type="monotone" dataKey="ca" name="Montant vendu (XAF)" stroke="var(--fs-wine-700)" strokeWidth={2.5} dot={{ r: 3 }}/>
                      <Line yAxisId="qte" type="monotone" dataKey="qte" name="Quantité vendue" stroke="#3A5E8F" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fs-ink-500)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <span>Total période affichée : <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(serie.reduce((s, p) => s + p.ca, 0))} XAF</strong></span>
                    <span>Quantité : <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(serie.reduce((s, p) => s + p.qte, 0))}</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ Valeur du stock ══ */}
        {tab === 'stock' && (
          <div style={{ maxWidth: 980 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              {[30, 90, 180, 365].map(j => (
                <button key={j} onClick={() => setStockJours(j)}
                  style={{ padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: stockJours === j ? 'none' : '1px solid var(--fs-line-2)',
                    background: stockJours === j ? 'var(--fs-ink-900)' : '#fff',
                    color: stockJours === j ? '#fff' : 'var(--fs-ink-600)' }}>
                  {j} jours
                </button>
              ))}
              <div style={{ width: 1, height: 22, background: 'var(--fs-line-2)' }}/>
              <select value={typeValeur} onChange={e => setTypeValeur(e.target.value as 'achat' | 'vente')} style={{ ...INPUT, width: 210, cursor: 'pointer' }}>
                <option value="achat">Valeur au prix d'achat</option>
                <option value="vente">Valeur au prix de vente</option>
              </select>
            </div>

            <div style={CARD}>
              {dataStock.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13, padding: 30, textAlign: 'center' }}>Pas encore de données</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={330}>
                    <LineChart data={dataStock} margin={{ top: 8, right: 18, bottom: 4, left: 14 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)"/>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }}/>
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}/>
                      <Tooltip formatter={(v: number) => `${fmtN(v)} XAF`}/>
                      <Legend wrapperStyle={{ fontSize: 12 }}/>
                      <Line type="monotone" dataKey="Boutique" stroke="var(--fs-wine-700)" strokeWidth={2.5} dot={{ r: 3 }}/>
                      <Line type="monotone" dataKey="Entrepôt" stroke="#B45309" strokeWidth={2.5} dot={{ r: 3 }}/>
                      <Line type="monotone" dataKey="Total" stroke="#3A5E8F" strokeWidth={2} strokeDasharray="6 4" dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                  {snaps.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fs-ink-500)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      {(() => { const d = snaps[snaps.length - 1]; const b = typeValeur === 'achat' ? d.achatBoutique : d.venteBoutique; const e = typeValeur === 'achat' ? d.achatEntrepot : d.venteEntrepot; return (
                        <>
                          <span>Aujourd'hui — Boutique : <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(b)} XAF</strong> ({fmtN(d.qteBoutique)} art.)</span>
                          <span>Entrepôt : <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(e)} XAF</strong> ({fmtN(d.qteEntrepot)} art.)</span>
                          <span>Total : <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(b + e)} XAF</strong></span>
                        </>
                      ); })()}
                    </div>
                  )}
                </>
              )}
            </div>
            <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--fs-ink-400)' }}>
              Une photo de la valeur du stock est prise automatiquement chaque jour — la courbe s'enrichit donc jour après jour à partir d'aujourd'hui.
            </p>
          </div>
        )}

        {/* ══ Versements ══ */}
        {tab === 'versements' && (
          <div style={{ maxWidth: 860 }}>
            <div style={{ ...CARD, marginBottom: 18 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Nouveau versement à un fournisseur</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ width: 230 }}>
                  <label style={LABEL}>Fournisseur</label>
                  <select value={vForm.fournisseur} onChange={e => setVForm(f => ({ ...f, fournisseur: e.target.value }))} style={{ ...INPUT, cursor: 'pointer' }}>
                    <option value="">— Choisir —</option>
                    {nomsFournisseurs.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ width: 150 }}>
                  <label style={LABEL}>Montant (XAF)</label>
                  <input type="number" min={0} value={vForm.montant} onChange={e => setVForm(f => ({ ...f, montant: e.target.value }))} placeholder="0" style={{ ...INPUT, textAlign: 'center' }}/>
                </div>
                <div style={{ width: 150 }}>
                  <label style={LABEL}>Date</label>
                  <input type="date" value={vForm.date} onChange={e => setVForm(f => ({ ...f, date: e.target.value }))} style={INPUT}/>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={LABEL}>Note (facultatif)</label>
                  <input value={vForm.note} onChange={e => setVForm(f => ({ ...f, note: e.target.value }))} placeholder="ex : règlement juillet" style={INPUT}/>
                </div>
                <button onClick={enregistrerVersement} disabled={busyV} style={{ ...BTN_PRIMARY, opacity: busyV ? 0.6 : 1 }}>
                  {busyV ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Historique des versements</p>
            {versements.length === 0 ? (
              <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucun versement enregistré</div>
            ) : (
              <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--fs-ivory)' }}>
                      <th style={TH}>Date</th><th style={TH}>Fournisseur</th><th style={{ ...TH, textAlign: 'right' }}>Montant</th><th style={TH}>Note</th><th style={TH}>Par</th><th style={TH}/>
                    </tr>
                  </thead>
                  <tbody>
                    {versements.map((v, i) => (
                      <tr key={v._id} style={{ borderTop: '1px solid var(--fs-line)', background: i % 2 ? 'var(--fs-ivory)' : '#fff' }}>
                        <td style={{ ...TD, whiteSpace: 'nowrap', color: 'var(--fs-ink-500)' }}>{v.date || fmtDate(v.createdAt)}</td>
                        <td style={{ ...TD, fontWeight: 700 }}>{v.fournisseur}</td>
                        <td style={{ ...NUM, color: '#16a34a', fontWeight: 700 }}>{fmtN(v.montant)}</td>
                        <td style={{ ...TD, color: 'var(--fs-ink-500)' }}>{v.note || '—'}</td>
                        <td style={{ ...TD, fontSize: 11, color: 'var(--fs-ink-400)' }}>{typeof v.creePar === 'object' ? v.creePar?.name : '—'}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>
                          {confirmDelV === v._id ? (
                            <button onClick={() => supprimerVersement(v._id)} style={{ padding: '4px 9px', border: 'none', borderRadius: 7, background: 'var(--fs-danger-700)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Confirmer ?</button>
                          ) : (
                            <button onClick={() => setConfirmDelV(v._id)} title="Supprimer (réservé au patron)" style={{ padding: '4px 9px', border: '1px solid rgba(194,62,36,0.25)', borderRadius: 7, background: '#fef2f2', color: 'var(--fs-danger-700)', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ Retours fournisseur ══ */}
        {tab === 'retours' && (
          <div style={{ maxWidth: 900 }}>
            <div style={{ background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--fs-ink-600)' }}>
              Un <strong>retour fournisseur</strong> renvoie de la marchandise (invendus, périmés, défectueux) : la quantité <strong>sort du stock choisi</strong> (boutique ou entrepôt) et le mouvement est tracé.
              Cela <strong>ne réduit pas la dette</strong> : on ne doit au fournisseur que ce qui a été <em>vendu</em>.
            </div>

            <div style={{ ...CARD, marginBottom: 18 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Nouveau retour</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ width: 240 }}>
                  <label style={LABEL}>Fournisseur destinataire</label>
                  <select value={rForm.fournisseur} onChange={e => setRForm(f => ({ ...f, fournisseur: e.target.value }))} style={{ ...INPUT, cursor: 'pointer' }}>
                    <option value="">— Choisir —</option>
                    {nomsFournisseurs.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={LABEL}>Motif / note (facultatif)</label>
                  <input value={rForm.note} onChange={e => setRForm(f => ({ ...f, note: e.target.value }))} placeholder="ex : produits périmés" style={INPUT}/>
                </div>
              </div>

              <label style={LABEL}>Produits retournés</label>
              {rForm.lignes.map((l, i) => {
                const prod = products.find(p => p._id === l.productId);
                const dispo = l.origine === 'boutique' ? (prod?.stock ?? 0) : (prod?.stockMagazin ?? 0);
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 36px', gap: 6, marginBottom: 6, alignItems: 'start' }}>
                    <ProduitPicker products={products} value={l.productId} onChange={id => setLigneR(i, { productId: id })}/>
                    <div>
                      <select value={l.origine} onChange={e => setLigneR(i, { origine: e.target.value as 'boutique' | 'entrepot' })} style={{ ...INPUT, cursor: 'pointer', padding: '9px 8px' }}>
                        <option value="entrepot">Entrepôt</option>
                        <option value="boutique">Boutique</option>
                      </select>
                      {prod && <div style={{ fontSize: 9, color: dispo > 0 ? 'var(--fs-ink-400)' : 'var(--fs-danger-700)', textAlign: 'center', marginTop: 2 }}>dispo : {dispo}</div>}
                    </div>
                    <input type="number" min={1} value={l.quantite} onChange={e => setLigneR(i, { quantite: e.target.value })} placeholder="Qté" style={{ ...INPUT, textAlign: 'center' }}/>
                    <button onClick={() => setRForm(f => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) }))} title="Retirer"
                      style={{ padding: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-danger-500)', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setRForm(f => ({ ...f, lignes: [...f.lignes, { productId: '', quantite: '1', origine: 'entrepot' }] }))}
                  style={{ background: '#fff', color: 'var(--fs-wine-700)', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '7px 16px' }}>
                  + Ajouter une ligne
                </button>
                <button onClick={enregistrerRetour} disabled={busyR} style={{ ...BTN_PRIMARY, opacity: busyR ? 0.6 : 1 }}>
                  {busyR ? 'Enregistrement…' : 'Valider le retour'}
                </button>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Historique des retours</p>
            {retours.length === 0 ? (
              <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucun retour enregistré</div>
            ) : retours.map(r => (
              <div key={r._id} style={{ ...CARD, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                    {r.fournisseur} · <span style={{ fontFamily: 'var(--fs-font-mono)', color: '#B45309' }}>{fmtN(r.total)} XAF</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--fs-ink-400)' }}> (valeur d'achat)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{fmtDate(r.createdAt)}</span>
                    {confirmDelR === r._id ? (
                      <button onClick={() => annulerRetour(r._id)} style={{ padding: '4px 9px', border: 'none', borderRadius: 7, background: 'var(--fs-danger-700)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Confirmer ?</button>
                    ) : (
                      <button onClick={() => setConfirmDelR(r._id)} title="Annuler ce retour (quantités remises en stock)" style={{ padding: '4px 9px', border: '1px solid rgba(194,62,36,0.25)', borderRadius: 7, background: '#fef2f2', color: 'var(--fs-danger-700)', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.lignes.map((lg, i) => (
                    <span key={i} style={{ fontSize: 11, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '3px 8px', color: 'var(--fs-ink-700)' }}>
                      {lg.productName} × {lg.quantite} <span style={{ color: 'var(--fs-ink-400)' }}>({lg.origine === 'boutique' ? 'boutique' : 'entrepôt'})</span>
                    </span>
                  ))}
                </div>
                {r.note && <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--fs-ink-500)' }}>Note : {r.note}</div>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
