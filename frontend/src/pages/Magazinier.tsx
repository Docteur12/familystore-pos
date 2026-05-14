import React, { useCallback, useEffect, useState } from 'react';
import { getAllProducts, Product } from '../api/products';
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

type Tab = 'receptions' | 'demandes' | 'historique';

// ── Reception form row ────────────────────────────────────────────────────────

interface RecRow { productId: string; quantity: number }

// ── Component ─────────────────────────────────────────────────────────────────

export default function Magazinier() {
  const payload   = getTokenPayload();
  const isMobile  = useIsMobile();
  const { toasts, addToast, removeToast } = useToast();
  const [tab,       setTab]       = useState<Tab>('receptions');
  const [sideOpen,  setSideOpen]  = useState(false);

  // ── Product list for reception form ──────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { getAllProducts().then(setProducts).catch(() => {}); }, []);

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
    { key: 'receptions', label: 'Réceptions',        icon: D.reception },
    { key: 'demandes',   label: 'Demandes en attente', icon: D.demande  },
    { key: 'historique', label: 'Historique',         icon: D.history  },
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

                {/* Fournisseur */}
                <div style={{ marginBottom: 16 }}>
                  <label style={LABEL}>Fournisseur</label>
                  <input style={INPUT} value={fournisseur} onChange={e => setFournisseur(e.target.value)} placeholder="Nom du fournisseur"/>
                </div>

                {/* Produits */}
                <div style={{ marginBottom: 8 }}>
                  <label style={LABEL}>Produits reçus</label>
                  {rows.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 36px', gap: 8, marginBottom: 8 }}>
                      <select
                        value={row.productId}
                        onChange={e => setRow(i, 'productId', e.target.value)}
                        style={{ ...INPUT, cursor: 'pointer' }}
                      >
                        <option value="">— Choisir un produit —</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        type="number" min={1} value={row.quantity}
                        onChange={e => setRow(i, 'quantity', parseInt(e.target.value) || 1)}
                        style={{ ...INPUT, textAlign: 'right' }}
                        placeholder="Qté"
                      />
                      <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                        style={{ padding: '9px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-danger-500)', cursor: rows.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <I d={D.trash} size={14}/>
                      </button>
                    </div>
                  ))}
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

        </div>
      </main>
    </div>
  );
}
