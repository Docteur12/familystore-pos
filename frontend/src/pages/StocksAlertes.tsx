import React, { useCallback, useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product, updateProduct } from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';

// ── Helpers ────────────────────────────────────────────────────────────────────

type AlertStatus = 'rupture' | 'critique' | 'alerte';
function getStatus(p: Product): AlertStatus {
  if (p.stock === 0) return 'rupture';
  if (p.stock <= Math.ceil(p.alertThreshold * 0.4)) return 'critique';
  return 'alerte';
}
const STATUS_CFG: Record<AlertStatus, { label: string; bg: string; color: string }> = {
  rupture:  { label: 'Rupture',  bg: '#FAE5DF', color: '#8B2C1A' },
  critique: { label: 'Critique', bg: '#FEF0E0', color: '#8B5A14' },
  alerte:   { label: 'Alerte',   bg: '#F7ECD4', color: '#8B5A14' },
};

// Deterministic expiry simulation (matches Stocks.tsx)
function expiryOf(p: Product): Date {
  const h = p._id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const days = (h % 450) - 30;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function daysUntil(d: Date) {
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = {
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  check:   'M20 6L9 17l-5-5',
  mail:    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  zap:     'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
};

type TabKey = 'reappro' | 'peremption' | 'suggestions';
type ExpiryFilter = '30' | '90' | '180';

// ── Main component ─────────────────────────────────────────────────────────────

export default function StocksAlertes() {
  const { toasts, addToast, removeToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [tab, setTab]           = useState<TabKey>('reappro');
  const [expiryFilter, setExpFilter] = useState<ExpiryFilter>('180');

  const load = useCallback(async () => {
    setLoading(true);
    try { setProducts(await getAllProducts()); }
    catch { addToast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveThreshold = async (p: Product) => {
    const val = parseInt(editing[p._id] ?? '');
    if (isNaN(val) || val < 0) return;
    setSaving(p._id);
    try {
      await updateProduct(p._id, { alertThreshold: val });
      addToast(`Seuil mis à jour — ${p.name}`, 'success');
      load();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setSaving(null); }
  };

  // Tab 1: low stock
  const lowProducts = products
    .filter(p => p.stock <= p.alertThreshold)
    .sort((a, b) => (a.stock / a.alertThreshold) - (b.stock / b.alertThreshold));

  // Tab 2: expiry
  const maxDays = parseInt(expiryFilter);
  const expiryProducts = products
    .map(p => ({ p, days: daysUntil(expiryOf(p)) }))
    .filter(({ days }) => days <= maxDays)
    .sort((a, b) => a.days - b.days);

  // Tab 3: suggestions (products needing reorder)
  const suggestions = products
    .filter(p => p.stock <= p.alertThreshold * 1.5)
    .map(p => ({
      p,
      recommended: Math.max(p.alertThreshold * 2 - p.stock, 0),
      urgency: p.stock === 0 ? 'Urgent' : p.stock <= p.alertThreshold * 0.4 ? 'Critique' : 'Normal',
    }))
    .sort((a, b) => b.recommended - a.recommended);

  const alertCount = lowProducts.length;

  const handleEmailRecap = () => {
    const lines = lowProducts.map(p => `• ${p.name} : stock ${p.stock}/${p.alertThreshold}`).join('\n');
    const mailto = `mailto:?subject=Recap%20alertes%20stock%20—%20Family%20Store&body=${encodeURIComponent(`Résumé alertes stock — ${new Date().toLocaleDateString('fr-FR')}\n\n${lines}`)}`;
    window.open(mailto);
  };

  const tabs: { id: TabKey; label: string; count: number; color: string }[] = [
    { id: 'reappro',     label: 'Réapprovisionnement', count: lowProducts.length,     color: '#D97706' },
    { id: 'peremption',  label: 'Péremption proche',   count: expiryProducts.length,  color: '#DC2626' },
    { id: 'suggestions', label: 'Suggestions auto',    count: suggestions.length,     color: 'var(--fs-wine-700)' },
  ];

  const ruptures  = lowProducts.filter(p => p.stock === 0).length;
  const critiques = lowProducts.filter(p => p.stock > 0 && p.stock <= Math.ceil(p.alertThreshold * 0.4)).length;
  const alertes   = lowProducts.length - ruptures - critiques;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <StocksSidebar alertCount={alertCount}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Alertes & Seuils</h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleEmailRecap}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--fs-font-sans)' }}>
                <I d={D.mail} size={13}/> Récap email
              </button>
              <button onClick={load}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--fs-font-sans)' }}>
                <I d={D.refresh} size={13}/> Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 14, padding: '16px 24px', flexShrink: 0 }}>
          {[
            { label: 'Ruptures',  count: ruptures,  bg: '#FAE5DF', color: '#8B2C1A' },
            { label: 'Critiques', count: critiques, bg: '#FEF0E0', color: '#8B5A14' },
            { label: 'Alertes',   count: alertes,   bg: '#F7ECD4', color: '#8B5A14' },
            { label: 'Total',     count: alertCount, bg: 'var(--fs-wine-50)', color: 'var(--fs-wine-800)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.count}</span>
                {s.count > 0 && <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{s.label}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px 12px', gap: 6, flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: tab === t.id ? 'none' : '1.5px solid var(--fs-line-2)',
              background: tab === t.id ? t.color : '#fff',
              color: tab === t.id ? '#fff' : 'var(--fs-ink-500)',
              fontFamily: 'var(--fs-font-sans)',
            }}>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--fs-ivory)', padding: '1px 6px', borderRadius: 10, color: tab === t.id ? '#fff' : 'var(--fs-ink-400)' }}>
                {t.count}
              </span>
            </button>
          ))}
          {tab === 'peremption' && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {(['30', '90', '180'] as ExpiryFilter[]).map(f => (
                <button key={f} onClick={() => setExpFilter(f)} style={{
                  padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: expiryFilter === f ? 'none' : '1.5px solid var(--fs-line-2)',
                  background: expiryFilter === f ? '#DC2626' : '#fff',
                  color: expiryFilter === f ? '#fff' : 'var(--fs-ink-400)',
                  fontFamily: 'var(--fs-font-sans)',
                }}>≤ {f}j</button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : tab === 'reappro' ? (
            lowProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Tous les stocks sont suffisants</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Produit', 'Catégorie', 'Stock actuel', 'Seuil actuel', 'Modifier seuil', 'Statut'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 && i <= 4 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lowProducts.map((p, idx) => {
                    const status = getStatus(p);
                    const st = STATUS_CFG[status];
                    const isEditing = editing[p._id] !== undefined;
                    return (
                      <tr key={p._id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{p.category ?? '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: p.stock === 0 ? 'var(--fs-danger-700)' : 'var(--fs-warning-700)' }}>
                          {p.stock} <span style={{ fontSize: 11, fontWeight: 400 }}>{p.unit}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>{p.alertThreshold}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <input type="number" min={0} placeholder={String(p.alertThreshold)}
                              value={editing[p._id] ?? ''}
                              onChange={e => setEditing(prev => ({ ...prev, [p._id]: e.target.value }))}
                              style={{ width: 80, padding: '5px 8px', textAlign: 'center', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--fs-font-mono)', outline: 'none' }}/>
                            {isEditing && (
                              <button onClick={() => handleSaveThreshold(p)} disabled={saving === p._id}
                                style={{ padding: '5px 8px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: saving === p._id ? 0.6 : 1 }}>
                                <I d={D.check} size={12}/>
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : tab === 'peremption' ? (
            expiryProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Aucune péremption dans les {maxDays} jours</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Produit', 'Catégorie', 'Stock', 'Date péremption', 'Délai', 'Urgence'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expiryProducts.map(({ p, days }, idx) => {
                    const exp = expiryOf(p);
                    const isExpired = days < 0;
                    const isSoon = days >= 0 && days <= 30;
                    const bg   = isExpired ? '#FAE5DF' : isSoon ? '#FEF0E0' : '#F7ECD4';
                    const color = isExpired ? '#8B2C1A' : '#8B5A14';
                    return (
                      <tr key={p._id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{p.category ?? '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{p.stock} {p.unit}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>
                          {exp.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color }}>
                          {isExpired ? 'Expiré' : `${days} j`}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                            {isExpired ? 'Expiré' : isSoon ? 'Urgent' : 'À surveiller'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            // Suggestions tab
            suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Aucune suggestion de commande</div>
              </div>
            ) : (
              <>
                <div style={{ background: '#fff', border: '1px solid rgba(122,29,46,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 12, color: 'var(--fs-wine-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <I d={D.zap} size={14}/> Ces suggestions sont calculées automatiquement : stock conseillé = 2× seuil d'alerte.
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Produit', 'Catégorie', 'Stock actuel', 'Seuil', 'Qté recommandée', 'Urgence'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map(({ p, recommended, urgency }, idx) => (
                      <tr key={p._id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{p.category ?? '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: p.stock === 0 ? 'var(--fs-danger-700)' : 'var(--fs-warning-700)' }}>{p.stock}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>{p.alertThreshold}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>+{recommended}</span>
                          <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginLeft: 4 }}>{p.unit}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                            background: urgency === 'Urgent' ? '#FAE5DF' : urgency === 'Critique' ? '#FEF0E0' : '#F7ECD4',
                            color: urgency === 'Urgent' ? '#8B2C1A' : '#8B5A14',
                          }}>{urgency}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )
          )}
        </div>
      </main>
    </div>
  );
}
