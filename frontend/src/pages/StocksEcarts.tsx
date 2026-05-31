import React, { useCallback, useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { getEcarts, resoudreEcart, EcartRecord } from '../api/ecarts';

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TH: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em',
  borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: 'var(--fs-ivory)', zIndex: 1,
};

export default function StocksEcarts() {
  const { toasts, addToast, removeToast } = useToast();
  const [ecarts,   setEcarts]   = useState<EcartRecord[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [filtre,   setFiltre]   = useState<'tous' | 'en_attente' | 'resolu'>('en_attente');
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEcarts({ statut: filtre === 'tous' ? undefined : filtre, limit: 100 });
      setEcarts(res.data);
      setTotal(res.total);
    } catch { addToast('Erreur chargement des écarts', 'error'); }
    finally { setLoading(false); }
  }, [filtre, addToast]);

  useEffect(() => { load(); }, [load]);

  const handleResoudre = async (id: string) => {
    setResolving(id);
    try {
      await resoudreEcart(id);
      addToast('Écart marqué comme résolu ✓', 'success');
      load();
    } catch { addToast('Erreur', 'error'); }
    finally { setResolving(null); }
  };

  const totalEcart = ecarts.reduce((s, e) => s + Math.abs(e.ecart), 0);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar alertCount={0}/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Écarts de stock</h1>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['en_attente', 'resolu', 'tous'] as const).map(f => (
                <button key={f} onClick={() => setFiltre(f)} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: filtre === f ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                  color: filtre === f ? '#fff' : 'var(--fs-ink-500)',
                }}>
                  {f === 'en_attente' ? '⚠ En attente' : f === 'resolu' ? '✓ Résolus' : 'Tous'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, padding: '14px 28px', flexShrink: 0 }}>
          {[
            { label: 'Écarts trouvés',  val: fmtN(total),        color: 'var(--fs-danger-700)' },
            { label: 'Unités manquantes', val: fmtN(totalEcart), color: 'var(--fs-warning-700)' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 18px', minWidth: 120 }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflowX: 'auto', marginTop: 8 }}>
              <table className="fs-grid" style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    {['Date', 'Produit', 'Stock système', 'Qté vendue', 'Écart', 'Caissière', 'Statut', 'Action'].map(h => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ecarts.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13 }}>
                      {filtre === 'en_attente' ? '✓ Aucun écart en attente' : 'Aucun écart enregistré'}
                    </td></tr>
                  ) : ecarts.map((e, i) => (
                    <tr key={e._id} style={{ borderBottom: '1px solid var(--fs-line)', background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--fs-ink-500)', whiteSpace: 'nowrap' }}>{fmtDate(e.createdAt)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--fs-ink-900)' }}>{e.nomProduit}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{e.stockSysteme}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{e.quantiteVendue}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: '#DC2626' }}>{e.ecart}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--fs-ink-600)' }}>{e.caissiereName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                          background: e.statut === 'resolu' ? '#F0FDF4' : '#FEF2F2',
                          color: e.statut === 'resolu' ? '#16A34A' : '#DC2626',
                        }}>
                          {e.statut === 'resolu' ? '✓ Résolu' : '● En attente'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {e.statut === 'en_attente' && (
                          <button onClick={() => handleResoudre(e._id)} disabled={resolving === e._id}
                            style={{ padding: '5px 12px', border: '1px solid #D97706', borderRadius: 6, background: '#FFF7ED', color: '#92400E', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: resolving === e._id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                            {resolving === e._id ? '…' : '✓ Marquer résolu'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
