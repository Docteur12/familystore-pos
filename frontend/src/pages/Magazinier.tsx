import React, { useCallback, useEffect, useState } from 'react';
import { getAllProducts, createProduct, updateProduct, Product } from '../api/products';
import { getTokenPayload } from '../api/dashboard';
import ToastContainer, { useToast } from '../components/Toast';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  createReception, getDemandes, marquerEnvoye, getHistorique,
  DemandeStock, ReceptionRecord,
} from '../api/magazinier';

// ── Icons ─────────────────────────────────────────────────────────────────────

function I({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const D = {
  reception: 'M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  demande:   'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 1 1 2 2',
  history:   'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2',
  plus:      'M12 5v14M5 12h14',
  trash:     'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  check:     'M20 6L9 17l-5-5',
  logout:    'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12',
  truck:     'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
  pkg:       'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zM12 22V11.5M3 6.5l9 5 9-5',
};

// ── Shared styles ─────────────────────────────────────────────────────────────

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
const BTN_OUTLINE: React.CSSProperties = {
  padding: '7px 16px', background: '#fff', color: 'var(--fs-wine-700)',
  border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, fontSize: 12,
  fontWeight: 700, cursor: 'pointer',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'receptions' | 'demandes' | 'historique' | 'dashboard';

// ── Reception form row ────────────────────────────────────────────────────────

interface RecRow { productId: string; quantity: number }

// ── Component ─────────────────────────────────────────────────────────────────

export default function Magazinier() {
  const payload   = getTokenPayload();
  const isMobile  = useIsMobile();
  const { toasts, addToast, removeToast } = useToast();
  const [tab,       setTab]       = useState<Tab>('receptions');
  const [sideOpen,  setSideOpen]  = useState(false);

  // ── Product list ─────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const loadProducts = useCallback(() => getAllProducts().then(setProducts).catch(() => {}), []);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Fournisseurs connus (depuis l'historique) ─────────────────────────────
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  useEffect(() => {
    getHistorique().then(h => {
      const unique = [...new Set(h.receptions.map((r: ReceptionRecord) => r.fournisseur).filter(Boolean))];
      setKnownSuppliers(unique as string[]);
    }).catch(() => {});
  }, []);

  // ── Nouveau produit inline ────────────────────────────────────────────────
  const [showNewProd,    setShowNewProd]    = useState(false);
  const [newProdName,    setNewProdName]    = useState('');
  const [newProdQty,     setNewProdQty]     = useState('');
  const [newProdSeuil,   setNewProdSeuil]   = useState('');
  const [newProdLoading, setNewProdLoading] = useState(false);

  const handleCreateProd = async () => {
    if (!newProdName.trim()) { addToast('Le nom du produit est requis', 'error'); return; }
    setNewProdLoading(true);
    try {
      await createProduct({
        name:                newProdName.trim().charAt(0).toUpperCase() + newProdName.trim().slice(1),
        price:               0,
        costPrice:           0,
        stock:               parseInt(newProdQty) || 0,
        alertThreshold:      5,
        unit:                'unité',
        magazinierThreshold: parseInt(newProdSeuil) || 0,
      });
      await loadProducts();
      setShowNewProd(false);
      setNewProdName(''); setNewProdQty(''); setNewProdSeuil('');
      addToast('Produit créé ✓', 'success');
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
    finally { setNewProdLoading(false); }
  };

  // ── Dernière réception par produit ───────────────────────────────────────
  const [lastRecByProd, setLastRecByProd] = useState<Record<string, string>>({});
  useEffect(() => {
    getHistorique().then(h => {
      const map: Record<string, string> = {};
      [...h.receptions].reverse().forEach((r: ReceptionRecord) => {
        r.items?.forEach((it: any) => {
          const id = it.productId ?? it.product ?? it.product?._id;
          if (id && !map[id]) map[id] = r.createdAt;
        });
      });
      setLastRecByProd(map);
    }).catch(() => {});
  }, []);

  // ── Commander un produit depuis le catalogue ──────────────────────────────
  const commanderProduit = (product: Product) => {
    setRows([{ productId: product._id, quantity: Math.max(1, product.alertThreshold * 2) }]);
    setTab('receptions');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  // ── Reception form ────────────────────────────────────────────────────────
  const [fournisseur,  setFournisseur]  = useState('');
  const [note,         setNote]         = useState('');
  const [rows,         setRows]         = useState<RecRow[]>([{ productId: '', quantity: 1 }]);
  const [recLoading,   setRecLoading]   = useState(false);

  const addRow    = useCallback(() => setRows(r => [...r, { productId: '', quantity: 1 }]), []);
  const removeRow = useCallback((i: number) => setRows(r => r.filter((_, n) => n !== i)), []);
  const setRow    = useCallback((i: number, field: keyof RecRow, val: string | number) =>
    setRows(r => r.map((row, n) => n === i ? { ...row, [field]: val } : row)), []);

  const handleValidateReception = useCallback(async () => {
    if (!fournisseur.trim()) { addToast('Indiquez le nom du fournisseur', 'error'); return; }
    const validRows = rows.filter(r => r.productId && r.quantity > 0);
    if (validRows.length === 0) { addToast('Ajoutez au moins un produit', 'error'); return; }
    setRecLoading(true);
    try {
      await createReception({ fournisseur: fournisseur.trim(), items: validRows, note });
      addToast(`Réception validée — ${validRows.length} produit(s) mis à jour`, 'success');
      setFournisseur(''); setNote(''); setRows([{ productId: '', quantity: 1 }]);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setRecLoading(false); }
  }, [fournisseur, rows, note, addToast]);

  // ── Demandes ──────────────────────────────────────────────────────────────
  const [demandes,    setDemandes]    = useState<DemandeStock[]>([]);
  const [dLoading,    setDLoading]    = useState(false);
  const [sending,     setSending]     = useState<string | null>(null);

  const loadDemandes = useCallback(async () => {
    setDLoading(true);
    try { setDemandes(await getDemandes()); }
    catch { addToast('Erreur chargement demandes', 'error'); }
    finally { setDLoading(false); }
  }, [addToast]);

  useEffect(() => { if (tab === 'demandes') loadDemandes(); }, [tab, loadDemandes]);

  const handleEnvoyer = useCallback(async (id: string) => {
    setSending(id);
    try {
      await marquerEnvoye(id);
      setDemandes(prev => prev.filter(d => d._id !== id));
      addToast('Marchandise marquée comme envoyée ✅', 'success');
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setSending(null); }
  }, [addToast]);

  // ── Historique ────────────────────────────────────────────────────────────
  const [histo,    setHisto]    = useState<{ receptions: ReceptionRecord[]; envois: DemandeStock[] } | null>(null);
  const [hLoading, setHLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'historique' || histo) return;
    setHLoading(true);
    getHistorique().then(setHisto).catch(() => addToast('Erreur chargement historique', 'error')).finally(() => setHLoading(false));
  }, [tab, histo, addToast]);

  const initials = (payload?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  // ── Tabs config ───────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'receptions', label: 'Réceptions',         icon: D.reception },
    { key: 'demandes',   label: 'Demandes en attente', icon: D.demande   },
    { key: 'historique', label: 'Historique',          icon: D.history   },
    { key: 'dashboard',  label: 'Tableau de bord',      icon: D.pkg       },
  ];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      {/* ── Bouton hamburger mobile ──────────────────────────────────────── */}
      {isMobile && (
        <button onClick={() => setSideOpen(o => !o)} style={{
          position: 'fixed', top: 12, left: sideOpen ? 212 : 12, zIndex: 201,
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--fs-wine-900)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'left 0.25s',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--fs-gold-400)" strokeWidth="2" strokeLinecap="round">
            {sideOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      )}

      {/* Overlay mobile */}
      {isMobile && sideOpen && (
        <div onClick={() => setSideOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.4)' }}/>
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: 200, height: '100vh', background: 'var(--fs-wine-900)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        ...(isMobile ? {
          position: 'fixed', top: 0, left: sideOpen ? 0 : -216,
          zIndex: 200, transition: 'left 0.25s',
          boxShadow: sideOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
        } : {}),
      }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fs-gold-500)', marginBottom: 4 }}>Family Store</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Magazinier</div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSideOpen(false); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 10px', marginBottom: 2, borderRadius: 8, border: 'none',
              background: tab === t.key ? 'var(--fs-wine-700)' : 'transparent',
              borderLeft: tab === t.key ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
              color: tab === t.key ? '#fff' : 'rgba(245,235,217,0.65)',
              cursor: 'pointer', textAlign: 'left', fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400, fontFamily: 'var(--fs-font-sans)',
            }}>
              <span style={{ color: tab === t.key ? 'var(--fs-gold-300)' : 'var(--fs-gold-500)', flexShrink: 0 }}>
                <I d={t.icon} size={15}/>
              </span>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name?.split(' ')[0] ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-400)' }}>Magazinier</div>
          </div>
          <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
            style={{ background: 'none', border: 'none', color: 'var(--fs-gold-400)', cursor: 'pointer', padding: 2 }} title="Déconnexion">
            <I d={D.logout} size={14}/>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isMobile ? '12px 14px 12px 58px' : '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Espace Magazinier</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>
            {TABS.find(t => t.key === tab)?.label}
          </h1>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 1 — RÉCEPTIONS
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'receptions' && (
            <div style={{ maxWidth: 640 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 24, boxShadow: 'var(--fs-shadow-sm)' }}>

                {/* Fournisseur avec autocomplete */}
                <div style={{ marginBottom: 16 }}>
                  <label style={LABEL}>Fournisseur</label>
                  <input
                    list="suppliers-list"
                    style={INPUT} value={fournisseur}
                    onChange={e => setFournisseur(e.target.value)}
                    placeholder="Nom du fournisseur ou sélectionner…"
                  />
                  <datalist id="suppliers-list">
                    {knownSuppliers.map(s => <option key={s} value={s}/>)}
                  </datalist>
                  {knownSuppliers.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {knownSuppliers.slice(0, 5).map(s => (
                        <button key={s} type="button" onClick={() => setFournisseur(s)}
                          style={{ padding: '3px 10px', border: '1px solid var(--fs-line-2)', borderRadius: 20, fontSize: 11, background: fournisseur === s ? 'var(--fs-wine-700)' : '#fff', color: fournisseur === s ? '#fff' : 'var(--fs-ink-600)', cursor: 'pointer' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Produits reçus */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ ...LABEL, marginBottom: 0 }}>Produits reçus</label>
                    <button type="button" onClick={() => setShowNewProd(v => !v)}
                      style={{ ...BTN_OUTLINE, fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <I d={D.plus} size={11}/> {showNewProd ? 'Annuler' : 'Nouveau produit'}
                    </button>
                  </div>

                  {/* Mini formulaire nouveau produit */}
                  {showNewProd && (
                    <div style={{ background: '#f8faf7', border: '1.5px solid #86efac', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Nouveau produit</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 8, marginBottom: 10 }}>
                        <input
                          style={INPUT}
                          value={newProdName}
                          onChange={e => setNewProdName(e.target.value)}
                          placeholder="Nom du produit *"
                          autoFocus
                        />
                        <input
                          style={{ ...INPUT, textAlign: 'center' }}
                          type="number" min={0}
                          value={newProdQty}
                          onChange={e => setNewProdQty(e.target.value)}
                          placeholder="Quantité"
                        />
                        <input
                          style={{ ...INPUT, textAlign: 'center' }}
                          type="number" min={0}
                          value={newProdSeuil}
                          onChange={e => setNewProdSeuil(e.target.value)}
                          placeholder="Seuil"
                          title="Seuil d'alerte pour commander"
                        />
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--fs-ink-400)', margin: '0 0 10px' }}>
                        Le prix et les autres détails seront complétés par l'administrateur.
                      </p>
                      <button onClick={handleCreateProd} disabled={newProdLoading}
                        style={{ ...BTN_PRIMARY, fontSize: 12, padding: '8px 16px', opacity: newProdLoading ? 0.7 : 1 }}>
                        {newProdLoading ? 'Création…' : '✓ Créer le produit'}
                      </button>
                    </div>
                  )}

                  {rows.map((row, i) => {
                    const prod = products.find(p => p._id === row.productId);
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 36px', gap: 8, marginBottom: prod ? 4 : 0 }}>
                          <select value={row.productId} onChange={e => setRow(i, 'productId', e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                            <option value="">— Choisir un produit —</option>
                            {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                          </select>
                          <input type="number" min={1} value={row.quantity}
                            onChange={e => setRow(i, 'quantity', parseInt(e.target.value) || 1)}
                            style={{ ...INPUT, textAlign: 'right' }} placeholder="Qté"/>
                          <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                            style={{ padding: '9px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-danger-500)', cursor: rows.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <I d={D.trash} size={14}/>
                          </button>
                        </div>
                        {prod && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px', background: 'var(--fs-ivory)', borderRadius: 6, fontSize: 11 }}>
                            <span style={{ color: 'var(--fs-ink-400)' }}>Stock actuel : <strong style={{ color: prod.stock <= prod.alertThreshold ? 'var(--fs-danger-700)' : 'var(--fs-ink-700)' }}>{prod.stock} {prod.unit}</strong></span>
                            <span style={{ color: 'var(--fs-ink-300)' }}>|</span>
                            <span style={{ color: 'var(--fs-ink-400)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              Seuil :
                              <input type="number" min={0} defaultValue={prod.alertThreshold}
                                onBlur={e => {
                                  const v = parseInt(e.target.value);
                                  if (!isNaN(v) && v !== prod.alertThreshold) {
                                    updateProduct(prod._id, { alertThreshold: v })
                                      .then(loadProducts)
                                      .catch(() => {});
                                  }
                                }}
                                style={{ width: 48, padding: '2px 6px', border: '1px solid var(--fs-line-2)', borderRadius: 5, fontSize: 11, textAlign: 'center', fontFamily: 'var(--fs-font-mono)' }}
                              />
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button onClick={addRow} style={{ ...BTN_OUTLINE, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <I d={D.plus} size={13}/> Ajouter une ligne
                  </button>
                </div>

                {/* Note */}
                <div style={{ marginTop: 16, marginBottom: 20 }}>
                  <label style={LABEL}>Note (optionnel)</label>
                  <input style={INPUT} value={note} onChange={e => setNote(e.target.value)} placeholder="Bon de livraison n°..."/>
                </div>

                <button onClick={handleValidateReception} disabled={recLoading} style={{ ...BTN_PRIMARY, opacity: recLoading ? 0.7 : 1 }}>
                  {recLoading ? 'Enregistrement…' : 'Valider la réception'}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 2 — DEMANDES EN ATTENTE
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'demandes' && (
            <div style={{ maxWidth: 640 }}>
              {dLoading ? (
                <div style={{ color: 'var(--fs-ink-400)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Chargement…</div>
              ) : demandes.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13 }}>
                  <I d={D.check} size={32}/><br/>Aucune demande en attente
                </div>
              ) : demandes.map(d => (
                <div key={d._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', marginBottom: 10, boxShadow: 'var(--fs-shadow-sm)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF0E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <I d={D.pkg} size={18}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.produit?.name ?? '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', marginTop: 2 }}>
                      {d.quantiteDemandee} {d.produit?.unit ?? 'u.'} demandé(s) · par {d.demandePar?.name ?? '?'} · {fmtDate(d.createdAt)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-300)', marginTop: 1 }}>
                      Stock actuel : {d.produit?.stock ?? '?'} {d.produit?.unit ?? 'u.'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEnvoyer(d._id)}
                    disabled={sending === d._id}
                    style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: sending === d._id ? 0.7 : 1 }}
                  >
                    <I d={D.truck} size={13}/>
                    {sending === d._id ? 'Envoi…' : 'Marquer comme envoyé'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 3 — HISTORIQUE
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'historique' && (
            <div style={{ maxWidth: 740 }}>
              {hLoading ? (
                <div style={{ color: 'var(--fs-ink-400)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Chargement…</div>
              ) : (
                <>
                  {/* Réceptions */}
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                    Mes réceptions
                  </p>
                  {(histo?.receptions ?? []).length === 0 ? (
                    <div style={{ color: 'var(--fs-ink-300)', fontSize: 13, marginBottom: 24 }}>Aucune réception enregistrée</div>
                  ) : (histo?.receptions ?? []).map(r => (
                    <div key={r._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '14px 18px', marginBottom: 8, boxShadow: 'var(--fs-shadow-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                            <I d={D.truck} size={13}/> {r.fournisseur}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>
                            {r.items.length} article(s) · {fmtDate(r.createdAt)}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '3px 10px', borderRadius: 20 }}>
                          Reçu
                        </span>
                      </div>
                      {r.items.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {r.items.map((item, i) => (
                            <span key={i} style={{ fontSize: 11, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '3px 8px', color: 'var(--fs-ink-700)' }}>
                              {item.productName} × {item.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Envois */}
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '24px 0 10px' }}>
                    Mes envois
                  </p>
                  {(histo?.envois ?? []).length === 0 ? (
                    <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucun envoi enregistré</div>
                  ) : (histo?.envois ?? []).map(e => (
                    <div key={e._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '14px 18px', marginBottom: 8, boxShadow: 'var(--fs-shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{e.produit?.name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>
                          {e.quantiteDemandee} {e.produit?.unit ?? 'u.'} · demandé par {e.demandePar?.name ?? '?'} · envoyé le {e.dateEnvoi ? fmtDate(e.dateEnvoi) : '—'}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 10px', borderRadius: 20 }}>
                        Envoyé
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 4 — TABLEAU DE BORD MAGAZINIER
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'dashboard' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--fs-line)' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                    Mes produits — {products.length} référence{products.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--fs-ivory)' }}>
                      {['Produit', 'Quantité', 'Seuil commande'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap' }}>
                          {h}
                          {h === 'Seuil commande' && <div style={{ fontWeight: 400, textTransform: 'none', fontSize: 9, letterSpacing: 0, marginTop: 1 }}>Cliquer pour modifier</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: 'var(--fs-ink-300)', fontStyle: 'italic' }}>
                          Aucun produit enregistré
                        </td>
                      </tr>
                    ) : products.map((p, i) => {
                      const seuil = p.magazinierThreshold ?? 0;
                      const bas   = seuil > 0 && p.stock <= seuil;
                      return (
                        <tr key={p._id} style={{ borderBottom: '1px solid var(--fs-line)', background: bas ? '#fef9f9' : i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--fs-ink-900)' }}>
                            {p.name}
                            {bas && <span style={{ marginLeft: 8, fontSize: 10, background: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>À commander</span>}
                            {p.category && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 400 }}>{p.category}</span>}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, fontSize: 20, fontFamily: 'var(--fs-font-mono)', color: bas ? '#dc2626' : 'var(--fs-wine-700)' }}>
                            {p.stock}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                            <input
                              type="number" min={0}
                              defaultValue={seuil}
                              placeholder="0"
                              onBlur={e => {
                                const v = parseInt(e.target.value) || 0;
                                if (v !== seuil) {
                                  updateProduct(p._id, { magazinierThreshold: v })
                                    .then(loadProducts)
                                    .catch(() => addToast('Erreur mise à jour seuil', 'error'));
                                }
                              }}
                              style={{ width: 64, padding: '5px 8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 7, fontSize: 13, textAlign: 'center', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: seuil > 0 ? 'var(--fs-ink-800)' : 'var(--fs-ink-300)', background: seuil > 0 ? '#fff' : 'var(--fs-ivory)' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
