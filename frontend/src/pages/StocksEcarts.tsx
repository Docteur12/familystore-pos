import React, { useCallback, useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { useIsMobile } from '../hooks/useIsMobile';
import { getEcarts, resoudreEcart, EcartRecord } from '../api/ecarts';
import { t, dateLocale } from '../i18n';

const fmtN = (n: number) => Math.round(n).toLocaleString(dateLocale());

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TH: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em',
  borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: 'var(--fs-ivory)', zIndex: 1,
};

export default function StocksEcarts() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024); // mobile + tablette : agencement empilé du contenu
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
    } catch { addToast(t('Erreur chargement des écarts', 'Error loading discrepancies'), 'error'); }
    finally { setLoading(false); }
  }, [filtre, addToast]);

  useEffect(() => { load(); }, [load]);

  const handleResoudre = async (id: string) => {
    setResolving(id);
    try {
      await resoudreEcart(id);
      addToast(t('Écart marqué comme résolu ✓', 'Discrepancy marked as resolved ✓'), 'success');
      load();
    } catch { addToast(t('Erreur', 'Error'), 'error'); }
    finally { setResolving(null); }
  };

  const totalEcart = ecarts.reduce((s, e) => s + Math.abs(e.ecart), 0);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar alertCount={0}/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: isNarrow ? 10 : 16 }}>
            <div style={{ paddingLeft: isMobile ? 44 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Gestion de stock', 'Stock management')}</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>{t('Écarts de stock', 'Stock discrepancies')}</h1>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(['en_attente', 'resolu', 'tous'] as const).map(f => (
                <button key={f} onClick={() => setFiltre(f)} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: filtre === f ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                  color: filtre === f ? '#fff' : 'var(--fs-ink-500)',
                }}>
                  {f === 'en_attente' ? t('⚠ En attente', '⚠ Pending') : f === 'resolu' ? t('✓ Résolus', '✓ Resolved') : t('Tous', 'All')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: isNarrow ? 'grid' : 'flex', gridTemplateColumns: isNarrow ? '1fr 1fr' : undefined, gap: isNarrow ? 10 : 14, padding: isNarrow ? '14px 16px' : '14px 28px', flexShrink: 0 }}>
          {[
            { label: t('Écarts trouvés', 'Discrepancies found'),  val: fmtN(total),        color: 'var(--fs-danger-700)' },
            { label: t('Unités manquantes', 'Missing units'), val: fmtN(totalEcart), color: 'var(--fs-warning-700)' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 18px', minWidth: 120 }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Explication de la procédure */}
        <div style={{ margin: isNarrow ? '0 16px 12px' : '0 28px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#92400e', lineHeight: 1.55 }}>
            <strong>{t('Qu\'est-ce qu\'un écart ?', 'What is a discrepancy?')}</strong> {t('La caissière a vendu un produit', 'The cashier sold a product that is')}{' '}
            <strong>{t('bien présent en boutique', 'actually present in the store')}</strong>{' '}
            {t('mais dont le stock machine était insuffisant (réception non saisie ou inventaire pas à jour) — la vente a été forcée et le stock machine est passé en négatif.',
               'but whose stock in the system was insufficient (receipt not entered or inventory not up to date) — the sale was forced and the system stock went negative.')}
            <br/>
            <strong>{t('Procédure :', 'Procedure:')}</strong> {t('1️⃣ compter le stock réel en rayon · 2️⃣ régulariser la machine (saisir la réception oubliée ou corriger via l\'Inventaire) · 3️⃣ cliquer alors « Marquer résolu ».',
               '1️⃣ count the actual stock on the shelf · 2️⃣ adjust the system (enter the forgotten receipt or correct via the Inventory) · 3️⃣ then click "Mark resolved".')}
            <em> {t('Le bouton ne corrige pas le stock : il confirme que le cas a été traité.', 'The button does not fix the stock: it confirms the case has been handled.')}</em>
          </p>
        </div>

        {/* Table */}
        <div style={{ flex: '0 0 auto', overflowY: 'visible', overflowX: 'auto', padding: isNarrow ? '0 12px 16px' : '0 28px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>{t('Chargement…', 'Loading…')}</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflowX: 'auto', marginTop: 8 }}>
              <table className="fs-grid" style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    {[t('Date', 'Date'), t('Produit', 'Product'), t('Stock système', 'System stock'), t('Qté vendue', 'Qty sold'), t('Écart', 'Discrepancy'), t('Caissière', 'Cashier'), t('Statut', 'Status'), t('Action', 'Action')].map(h => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ecarts.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13 }}>
                      {filtre === 'en_attente' ? t('✓ Aucun écart en attente', '✓ No pending discrepancies') : t('Aucun écart enregistré', 'No discrepancies recorded')}
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
                          {e.statut === 'resolu' ? t('✓ Résolu', '✓ Resolved') : t('● En attente', '● Pending')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {e.statut === 'en_attente' && (
                          <button onClick={() => handleResoudre(e._id)} disabled={resolving === e._id}
                            style={{ padding: '5px 12px', border: '1px solid #D97706', borderRadius: 6, background: '#FFF7ED', color: '#92400E', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: resolving === e._id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                            {resolving === e._id ? '…' : t('✓ Marquer résolu', '✓ Mark resolved')}
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
