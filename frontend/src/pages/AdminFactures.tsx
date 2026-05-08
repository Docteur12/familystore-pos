import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { getFactures, FactureRecord } from '../api/factures';
import { PM_LABELS } from '../api/sales';

const PAGE_SIZE = 50;
const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')}  ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function downloadPDF(f: FactureRecord) {
  const bin = atob(f.pdfBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `facture-${f.numero}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function I({ d, size = 13 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const TH: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em',
  borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: 'var(--fs-ivory)', zIndex: 1,
};

export default function AdminFactures() {
  const { toasts, addToast, removeToast } = useToast();

  const [factures, setFactures] = useState<FactureRecord[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const res = await getFactures({
        dateFrom: dateFrom || undefined,
        dateTo:   dateTo   || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setFactures(res.data);
      setTotal(res.total);
      setPage(p);
    } catch {
      addToast('Erreur chargement des factures', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, addToast]);

  useEffect(() => { load(0); }, [load]);

  const totalMontant = factures.reduce((s, f) => s + f.montant, 0);
  const pages        = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Pilotage</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Historique des factures</h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12 }} />
              <span style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12 }} />
              <button onClick={() => load(0)}
                style={{ padding: '7px 14px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Filtrer
              </button>
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Barre stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 28px', background: 'var(--fs-wine-50)', borderBottom: '1px solid var(--fs-line)', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{total}</span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>CA affiché </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(totalMontant)} XAF</span>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fs-ink-400)' }}>
            Page {page + 1} / {pages}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    {['Ticket #', 'Date', 'Caissier', 'Mode', 'Articles', 'Montant', 'PDF'].map((h, i) => (
                      <th key={h} style={{ ...TH, textAlign: i >= 5 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factures.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13 }}>
                        Aucune facture enregistrée sur cette période.
                      </td>
                    </tr>
                  ) : factures.map((f, i) => (
                    <tr key={f._id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', fontWeight: 800, color: 'var(--fs-wine-700)' }}>
                        #{f.numero}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-600)', whiteSpace: 'nowrap' }}>
                        {fmtDate(f.date || f.createdAt)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-600)' }}>
                        {f.caissier}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--fs-ink-500)' }}>
                        {PM_LABELS[f.paymentMethod] ?? f.paymentMethod}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--fs-ink-500)' }}>
                        {f.items.reduce((s, it) => s + it.quantity, 0)} art.
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', whiteSpace: 'nowrap' }}>
                        {fmtN(f.montant)} XAF
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button onClick={() => downloadPDF(f)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--fs-wine-50)', color: 'var(--fs-wine-700)', border: '1px solid var(--fs-wine-200)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          <I d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={11} />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button onClick={() => load(page - 1)} disabled={page === 0}
                style={{ padding: '7px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, color: 'var(--fs-ink-600)' }}>
                ← Précédent
              </button>
              <span style={{ fontSize: 12, color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-mono)' }}>
                {page + 1} / {pages}
              </span>
              <button onClick={() => load(page + 1)} disabled={page >= pages - 1}
                style={{ padding: '7px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: page >= pages - 1 ? 'not-allowed' : 'pointer', opacity: page >= pages - 1 ? 0.4 : 1, color: 'var(--fs-ink-600)' }}>
                Suivant →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
