import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTokenPayload } from '../api/dashboard';
import { getAllProducts, Product } from '../api/products';
import {
  getPartenaires, createPartenaire, updatePartenaire, deletePartenaire,
  getLivraisons, createLivraison, getDernierPrix,
  getCompte, createPaiement,
  Partenaire, LivraisonPartenaire, ComptePartenaire,
} from '../api/partenaires';
import ToastContainer, { useToast } from '../components/Toast';

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');
function fmtDateTime(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' à ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function I({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
  );
}
const D = {
  livraison: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  clients:   'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  compte:    'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  print:     'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  back:      'M19 12H5M12 19l-7-7 7-7',
  logout:    'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12',
  plus:      'M12 5v14M5 12h14',
  trash:     'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  edit:      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)',
  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--fs-font-sans)', background: '#fff',
};
const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)',
  textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4,
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: '9px 22px', background: 'var(--fs-wine-700)', color: '#fff',
  border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

// Sélecteur de produit (recherche) — uniquement l'entrepôt
function ProductSelect({ products, value, onChange }: {
  products: Product[]; value: string; onChange: (id: string) => void;
}) {
  const selected = products.find(p => p._id === value) ?? null;
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = products.filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={open ? search : (selected?.name ?? '')}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(''); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Chercher un produit (entrepôt)…"
        style={{ ...INPUT, cursor: 'text' }}
      />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, boxShadow: 'var(--fs-shadow-md)', zIndex: 20, maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
          {filtered.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fs-ink-400)' }}>Aucun produit en entrepôt</div>}
          {filtered.slice(0, 40).map(p => (
            <button key={p._id} type="button" onMouseDown={() => { onChange(p._id); setOpen(false); }}
              style={{ width: '100%', padding: '7px 12px', border: 'none', background: p._id === value ? 'var(--fs-ivory)' : '#fff', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--fs-line)', display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Entrepôt : {p.stockMagazin ?? 0}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = 'livraisons' | 'partenaires' | 'comptes';
interface Row { productId: string; quantite: string; prix: string }

export default function Partenaires() {
  const navigate = useNavigate();
  const payload = getTokenPayload();
  const isPatron = payload?.role === 'patron';
  const { toasts, addToast, removeToast } = useToast();

  const [tab, setTab] = useState<Tab>('livraisons');
  const [partenaires, setPartenaires] = useState<Partenaire[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [livraisons, setLivraisons] = useState<LivraisonPartenaire[]>([]);

  // Formulaire livraison
  const [partId, setPartId] = useState('');
  const [rows, setRows] = useState<Row[]>([{ productId: '', quantite: '1', prix: '' }]);
  const [montantPaye, setMontantPaye] = useState('');
  const [dernierPrix, setDernierPrix] = useState<Record<string, number>>({});
  const [loadingLiv, setLoadingLiv] = useState(false);

  // Formulaire partenaire
  const [pForm, setPForm] = useState({ name: '', phone: '', lieu: '', note: '' });
  const [editing, setEditing] = useState<string | null>(null);

  // Comptes (relevé)
  const [compteId, setCompteId] = useState('');
  const [compte, setCompte] = useState<ComptePartenaire | null>(null);
  const [paieMontant, setPaieMontant] = useState('');
  const [paieNote, setPaieNote] = useState('');

  const loadCompte = (id: string) => {
    if (!id) { setCompte(null); return; }
    getCompte(id).then(setCompte).catch(() => setCompte(null));
  };
  useEffect(() => { loadCompte(compteId); }, [compteId]);

  const enregistrerPaiement = async () => {
    const montant = parseInt(paieMontant) || 0;
    if (!compteId || montant <= 0) { addToast('Saisissez un montant', 'error'); return; }
    try {
      await createPaiement(compteId, { montant, note: paieNote.trim() || undefined });
      addToast('Paiement enregistré ✓', 'success');
      setPaieMontant(''); setPaieNote('');
      loadCompte(compteId);
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  const imprimerReleve = () => {
    if (!compte) return;
    const c = compte;
    const lignesHtml = [
      ...c.livraisons.map(l => `<tr><td>${fmtDateTime(l.createdAt)}</td><td>Livraison ${l.numeroBL}</td><td style="text-align:right">${fmtN(l.total)}</td><td style="text-align:right">${fmtN(l.montantPaye)}</td></tr>`),
      ...c.paiements.map(p => `<tr><td>${fmtDateTime(p.createdAt)}</td><td>Paiement${p.note ? ' — ' + p.note : ''}</td><td></td><td style="text-align:right">${fmtN(p.montant)}</td></tr>`),
    ].join('');
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <html><head><title>Relevé — ${c.partenaire.name}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h2{margin:0 0 2px} .sub{color:#666;font-size:13px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
        th,td{border:1px solid #999;padding:6px 8px} th{background:#f0f0f0;text-align:left}
        .tot{margin-top:16px;font-size:15px} .solde{font-size:20px;font-weight:bold;color:#7A1D2E}
      </style></head><body>
        <h2>Relevé de compte — ${c.partenaire.name}</h2>
        <div class="sub">${[c.partenaire.lieu, c.partenaire.phone].filter(Boolean).join(' · ')} &middot; Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
        <table>
          <thead><tr><th>Date</th><th>Opération</th><th style="text-align:right">Montant livré</th><th style="text-align:right">Payé</th></tr></thead>
          <tbody>${lignesHtml || '<tr><td colspan="4" style="text-align:center;color:#888">Aucune opération</td></tr>'}</tbody>
        </table>
        <div class="tot">Total livré : <b>${fmtN(c.totalLivre)} XAF</b> &nbsp;·&nbsp; Total payé : <b>${fmtN(c.payeLivraison + c.totalPaiements)} XAF</b></div>
        <div class="tot solde">Solde dû : ${fmtN(c.solde)} XAF</div>
        <script>window.onload=()=>window.print()<\/script>
      </body></html>`);
    win.document.close();
  };

  const warehouse = useMemo(() => products.filter(p => (p.stockMagazin ?? 0) > 0), [products]);

  const loadAll = () => {
    getPartenaires().then(setPartenaires).catch(() => {});
    getAllProducts().then(setProducts).catch(() => {});
    getLivraisons().then(setLivraisons).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []);

  // Rappel des derniers prix quand on change de partenaire
  useEffect(() => {
    if (partId) getDernierPrix(partId).then(setDernierPrix).catch(() => setDernierPrix({}));
    else setDernierPrix({});
  }, [partId]);

  const setRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((row, n) => n === i ? { ...row, ...patch } : row));
  const addRow = () => setRows(r => [...r, { productId: '', quantite: '1', prix: '' }]);
  const removeRow = (i: number) => setRows(r => r.length === 1 ? [{ productId: '', quantite: '1', prix: '' }] : r.filter((_, n) => n !== i));

  const total = rows.reduce((s, r) => s + (parseInt(r.quantite) || 0) * (parseInt(r.prix) || 0), 0);
  const creance = Math.max(0, total - (parseInt(montantPaye) || 0));

  const validerLivraison = async () => {
    if (!partId) { addToast('Choisissez un partenaire', 'error'); return; }
    const lignes = rows
      .filter(r => r.productId && (parseInt(r.quantite) || 0) > 0)
      .map(r => ({ productId: r.productId, quantite: parseInt(r.quantite) || 0, prixUnitaire: parseInt(r.prix) || 0 }));
    if (lignes.length === 0) { addToast('Ajoutez au moins un produit', 'error'); return; }
    setLoadingLiv(true);
    try {
      await createLivraison(partId, { lignes, montantPaye: parseInt(montantPaye) || 0 });
      addToast('Bon de livraison validé ✓ — stock entrepôt mis à jour', 'success');
      setRows([{ productId: '', quantite: '1', prix: '' }]);
      setMontantPaye('');
      getAllProducts().then(setProducts).catch(() => {});
      getLivraisons().then(setLivraisons).catch(() => {});
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setLoadingLiv(false); }
  };

  const savePartenaire = async () => {
    if (!pForm.name.trim()) { addToast('Le nom du partenaire est requis', 'error'); return; }
    try {
      if (editing) { await updatePartenaire(editing, pForm); addToast('Partenaire modifié ✓', 'success'); }
      else { await createPartenaire(pForm); addToast('Partenaire ajouté ✓', 'success'); }
      setPForm({ name: '', phone: '', lieu: '', note: '' });
      setEditing(null);
      getPartenaires().then(setPartenaires).catch(() => {});
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  const removePartenaire = async (id: string) => {
    try { await deletePartenaire(id); setPartenaires(prev => prev.filter(p => p._id !== id)); addToast('Partenaire supprimé', 'success'); }
    catch { addToast('Erreur suppression', 'error'); }
  };

  const initials = (payload?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Sidebar */}
      <aside className="fs-sidebar-drawer" style={{ width: 200, background: 'var(--fs-wine-900)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fs-gold-500)', marginBottom: 4 }}>Family Store</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Partenaires</div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {([
            { key: 'livraisons', label: 'Livraisons', icon: D.livraison },
            { key: 'comptes', label: 'Comptes & créances', icon: D.compte },
            { key: 'partenaires', label: 'Partenaires', icon: D.clients },
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', marginBottom: 2,
              borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13,
              background: tab === t.key ? 'var(--fs-wine-700)' : 'transparent',
              borderLeft: tab === t.key ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
              color: tab === t.key ? '#fff' : 'rgba(245,235,217,0.65)', fontWeight: tab === t.key ? 600 : 400,
              fontFamily: 'var(--fs-font-sans)',
            }}>
              <span style={{ color: tab === t.key ? 'var(--fs-gold-300)' : 'var(--fs-gold-500)' }}><I d={t.icon} size={15}/></span>
              {t.label}
            </button>
          ))}
        </nav>

        {isPatron && (
          <div style={{ padding: '0 12px 8px' }}>
            <button onClick={() => navigate('/admin/dashboard')}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--fs-gold-300)', cursor: 'pointer', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              <I d={D.back} size={13}/> Retour admin
            </button>
          </div>
        )}

        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-400)' }}>{isPatron ? 'Administrateur' : 'Magazinier'}</div>
          </div>
          <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
            style={{ background: 'none', border: 'none', color: 'var(--fs-gold-400)', cursor: 'pointer', padding: 2 }} title="Déconnexion">
            <I d={D.logout} size={14}/>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Espace Partenaires</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>{tab === 'livraisons' ? 'Bon de livraison' : tab === 'comptes' ? 'Comptes & créances' : 'Partenaires'}</h1>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

          {/* ── Onglet Livraisons ── */}
          {tab === 'livraisons' && (
            <div style={{ maxWidth: 820 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <label style={LABEL}>Partenaire</label>
                <select value={partId} onChange={e => setPartId(e.target.value)} style={{ ...INPUT, cursor: 'pointer', marginBottom: 14 }}>
                  <option value="">— Choisir un partenaire —</option>
                  {partenaires.map(p => <option key={p._id} value={p._id}>{p.name}{p.lieu ? ` · ${p.lieu}` : ''}</option>)}
                </select>
                {partenaires.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', marginBottom: 12 }}>
                    Aucun partenaire — créez-en un dans l'onglet « Partenaires ».
                  </div>
                )}

                <label style={LABEL}>Produits livrés (depuis l'entrepôt)</label>
                {rows.map((row, i) => {
                  const dp = row.productId ? dernierPrix[row.productId] : undefined;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 36px', gap: 6, marginBottom: 6, alignItems: 'start' }}>
                      <ProductSelect products={warehouse} value={row.productId} onChange={id => setRow(i, { productId: id, prix: row.prix || (dernierPrix[id] ? String(dernierPrix[id]) : '') })}/>
                      <input type="number" min={1} value={row.quantite} onChange={e => setRow(i, { quantite: e.target.value })} placeholder="Qté" style={{ ...INPUT, textAlign: 'center' }}/>
                      <div>
                        <input type="number" min={0} value={row.prix} onChange={e => setRow(i, { prix: e.target.value })} placeholder="Prix" style={{ ...INPUT, textAlign: 'center' }}/>
                        {dp !== undefined && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', textAlign: 'center', marginTop: 2 }}>dernier : {fmtN(dp)}</div>}
                      </div>
                      <button onClick={() => removeRow(i)} title="Retirer"
                        style={{ padding: '8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-danger-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <I d={D.trash} size={13}/>
                      </button>
                    </div>
                  );
                })}
                <button onClick={addRow} style={{ background: '#fff', color: 'var(--fs-wine-700)', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <I d={D.plus} size={13}/> Ajouter une ligne
                </button>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--fs-line)' }}>
                  <div style={{ width: 160 }}>
                    <label style={LABEL}>Montant payé (XAF)</label>
                    <input type="number" min={0} value={montantPaye} onChange={e => setMontantPaye(e.target.value)} placeholder="0" style={{ ...INPUT, textAlign: 'center' }}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fs-ink-500)' }}>Total</span><strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(total)} XAF</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fs-ink-500)' }}>Reste dû (créance)</span><strong style={{ fontFamily: 'var(--fs-font-mono)', color: creance > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(creance)} XAF</strong></div>
                  </div>
                  <button onClick={validerLivraison} disabled={loadingLiv} style={{ ...BTN_PRIMARY, opacity: loadingLiv ? 0.7 : 1 }}>
                    {loadingLiv ? 'Validation…' : 'Valider la livraison'}
                  </button>
                </div>
              </div>

              {/* Historique des livraisons */}
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Dernières livraisons</p>
              {livraisons.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune livraison enregistrée</div>
              ) : livraisons.slice(0, 30).map(l => (
                <div key={l._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                      {typeof l.partenaire === 'object' ? l.partenaire.name : '—'} · <span style={{ fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(l.total)} XAF</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{l.numeroBL} · {fmtDateTime(l.createdAt)}</div>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {l.lignes.map((lg, i) => (
                      <span key={i} style={{ fontSize: 11, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '3px 8px', color: 'var(--fs-ink-700)' }}>
                        {lg.productName} × {lg.quantite} @ {fmtN(lg.prixUnitaire)}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fs-ink-500)' }}>
                    Payé : {fmtN(l.montantPaye)} XAF · Reste : <strong style={{ color: (l.total - l.montantPaye) > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(Math.max(0, l.total - l.montantPaye))} XAF</strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Onglet Comptes & créances ── */}
          {tab === 'comptes' && (
            <div style={{ maxWidth: 820 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <label style={LABEL}>Partenaire</label>
                <select value={compteId} onChange={e => setCompteId(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                  <option value="">— Choisir un partenaire —</option>
                  {partenaires.map(p => <option key={p._id} value={p._id}>{p.name}{p.lieu ? ` · ${p.lieu}` : ''}</option>)}
                </select>
              </div>

              {compte && (
                <>
                  {/* Solde + actions */}
                  <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fs-ink-900)' }}>{compte.partenaire.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{[compte.partenaire.lieu, compte.partenaire.phone].filter(Boolean).join(' · ') || '—'}</div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--fs-ink-500)' }}>
                          <span>Livré : <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(compte.totalLivre)}</strong></span>
                          <span>Payé : <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(compte.payeLivraison + compte.totalPaiements)}</strong></span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Solde dû (créance)</div>
                        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: compte.solde > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(compte.solde)} XAF</div>
                      </div>
                      <button onClick={imprimerReleve} style={{ padding: '9px 16px', background: '#fff', color: 'var(--fs-wine-700)', border: '1.5px solid var(--fs-wine-700)', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <I d={D.print} size={14}/> Imprimer le relevé
                      </button>
                    </div>

                    {/* Enregistrer un paiement */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--fs-line)' }}>
                      <div style={{ width: 150 }}>
                        <label style={LABEL}>Paiement reçu (XAF)</label>
                        <input type="number" min={0} value={paieMontant} onChange={e => setPaieMontant(e.target.value)} placeholder="0" style={{ ...INPUT, textAlign: 'center' }}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <label style={LABEL}>Note (optionnel)</label>
                        <input value={paieNote} onChange={e => setPaieNote(e.target.value)} placeholder="ex : espèces, MoMo…" style={INPUT}/>
                      </div>
                      <button onClick={enregistrerPaiement} style={BTN_PRIMARY}>Enregistrer le paiement</button>
                    </div>
                  </div>

                  {/* Relevé : livraisons + paiements */}
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Relevé des opérations</p>
                  {(compte.livraisons.length === 0 && compte.paiements.length === 0) ? (
                    <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune opération</div>
                  ) : (
                    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                      {compte.livraisons.map(l => (
                        <div key={l._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--fs-line)', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Livraison {l.numeroBL}</div>
                            <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{fmtDateTime(l.createdAt)} · {l.lignes.length} article(s)</div>
                          </div>
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>+{fmtN(l.total)}</div>
                            <div style={{ fontSize: 10, color: 'var(--fs-success-700)' }}>payé {fmtN(l.montantPaye)}</div>
                          </div>
                        </div>
                      ))}
                      {compte.paiements.map(p => (
                        <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--fs-line)', background: '#f0fdf4', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>Paiement{p.note ? ` — ${p.note}` : ''}</div>
                            <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{fmtDateTime(p.createdAt)}</div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: '#15803d', whiteSpace: 'nowrap' }}>−{fmtN(p.montant)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Onglet Partenaires ── */}
          {tab === 'partenaires' && (
            <div style={{ maxWidth: 720 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{editing ? 'Modifier le partenaire' : 'Nouveau partenaire'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={LABEL}>Nom *</label><input value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} style={INPUT} placeholder="ex : Boutique Mbappé"/></div>
                  <div><label style={LABEL}>Téléphone</label><input value={pForm.phone} onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))} style={INPUT} placeholder="+237 6XX XXX XXX"/></div>
                  <div><label style={LABEL}>Lieu</label><input value={pForm.lieu} onChange={e => setPForm(f => ({ ...f, lieu: e.target.value }))} style={INPUT} placeholder="ex : Bonabéri"/></div>
                  <div><label style={LABEL}>Note</label><input value={pForm.note} onChange={e => setPForm(f => ({ ...f, note: e.target.value }))} style={INPUT} placeholder="(optionnel)"/></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={savePartenaire} style={BTN_PRIMARY}>{editing ? 'Enregistrer' : 'Ajouter'}</button>
                  {editing && <button onClick={() => { setEditing(null); setPForm({ name: '', phone: '', lieu: '', note: '' }); }} style={{ padding: '9px 18px', background: '#fff', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>Annuler</button>}
                </div>
              </div>

              {partenaires.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucun partenaire pour l'instant</div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                  {partenaires.map((p, i) => {
                    return (
                      <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: i < partenaires.length - 1 ? '1px solid var(--fs-line)' : 'none', background: i % 2 ? 'var(--fs-ivory)' : '#fff' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{[p.lieu, p.phone].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                        <button onClick={() => { setCompteId(p._id); setTab('comptes'); }} title="Voir le compte / créance"
                          style={{ background: 'var(--fs-wine-50)', border: '1px solid var(--fs-wine-200)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--fs-wine-700)', fontSize: 12, fontWeight: 700, marginRight: 4 }}>
                          Compte
                        </button>
                        <button onClick={() => { setEditing(p._id); setPForm({ name: p.name, phone: p.phone, lieu: p.lieu, note: p.note }); }} title="Modifier"
                          style={{ background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: 'var(--fs-ink-600)', display: 'inline-flex' }}><I d={D.edit} size={13}/></button>
                        <button onClick={() => removePartenaire(p._id)} title="Supprimer"
                          style={{ background: '#fef2f2', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'inline-flex' }}><I d={D.trash} size={13}/></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
