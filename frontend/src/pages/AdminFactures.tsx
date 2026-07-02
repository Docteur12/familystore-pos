import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { getFactures, deleteFacture, FactureRecord } from '../api/factures';
import { PM_LABELS } from '../api/sales';
import { useIsMobile } from '../hooks/useIsMobile';

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

type FSortKey = 'numero' | 'date' | 'caissier' | 'pm' | 'articles' | 'montant';

const FACTURE_COLS: { key: FSortKey | null; label: string; align: 'left' | 'right' }[] = [
  { key: 'numero',   label: 'Ticket #', align: 'left' },
  { key: 'date',     label: 'Date',     align: 'left' },
  { key: 'caissier', label: 'Caissier', align: 'left' },
  { key: 'pm',       label: 'Mode',     align: 'left' },
  { key: 'articles', label: 'Articles', align: 'left' },
  { key: 'montant',  label: 'Montant',  align: 'right' },
  { key: null,       label: 'PDF',      align: 'right' },
];

const factureSortVal = (f: FactureRecord, key: FSortKey): string | number => {
  switch (key) {
    case 'numero':   return f.numero;
    case 'date':     return new Date(f.date || f.createdAt).getTime();
    case 'caissier': return f.caissier ?? '';
    case 'pm':       return PM_LABELS[f.paymentMethod] ?? f.paymentMethod;
    case 'articles': return f.items.reduce((s, it) => s + it.quantity, 0);
    case 'montant':  return f.montant;
  }
};

export default function AdminFactures() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);

  const [factures, setFactures] = useState<FactureRecord[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [sort,     setSort]     = useState<{ key: FSortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [deleteTarget, setDeleteTarget] = useState<FactureRecord | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const toggleSort = useCallback((key: FSortKey) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }, []);

  const handleDeleteFacture = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFacture(deleteTarget._id);
      setFactures(prev => prev.filter(f => f._id !== deleteTarget._id));
      setTotal(t => Math.max(0, t - 1));
      setDeleteTarget(null);
      addToast('Facture supprimée ✓', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setDeleting(false);
    }
  };

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

  const sortDir = sort.dir === 'asc' ? 1 : -1;
  const sortedFactures = [...factures].sort((a, b) => {
    const va = factureSortVal(a, sort.key);
    const vb = factureSortVal(b, sort.key);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
    return String(va).localeCompare(String(vb), 'fr') * sortDir;
  });

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Modal confirmation suppression facture */}
      {deleteTarget && (
        <div onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '26px 30px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-900)', marginBottom: 6 }}>Supprimer cette facture ?</div>
            <p style={{ fontSize: 13, color: 'var(--fs-ink-700)', lineHeight: 1.6, marginBottom: 18 }}>
              Facture <strong>#{deleteTarget.numero}</strong> · {fmtN(deleteTarget.montant)} XAF.<br/>
              L'archive PDF sera retirée de l'historique. Cela n'affecte pas le journal des ventes ni le stock.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '11px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)' }}>
                Annuler
              </button>
              <button onClick={handleDeleteFacture} disabled={deleting}
                style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#dc2626', color: '#fff', opacity: deleting ? 0.7 : 1, fontFamily: 'var(--fs-font-sans)' }}>
                {deleting ? 'Suppression…' : 'Oui, supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 12, flexWrap: 'wrap' }}>
            <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
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
        <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', padding: isNarrow ? '0 16px 28px' : '0 28px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', marginTop: 16, overflowX: 'auto' }}>
              <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse', minWidth: isNarrow ? 760 : undefined }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    {FACTURE_COLS.map(col => (
                      <th key={col.label}
                        onClick={col.key ? () => toggleSort(col.key as FSortKey) : undefined}
                        style={{ ...TH, textAlign: col.align, cursor: col.key ? 'pointer' : 'default', userSelect: 'none', color: col.key && sort.key === col.key ? 'var(--fs-wine-700)' : undefined }}>
                        {col.label}
                        {col.key && (
                          <span style={{ marginLeft: 4, opacity: sort.key === col.key ? 1 : 0.25 }}>
                            {sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '▲'}
                          </span>
                        )}
                      </th>
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
                  ) : sortedFactures.map((f, i) => (
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => downloadPDF(f)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--fs-wine-50)', color: 'var(--fs-wine-700)', border: '1px solid var(--fs-wine-200)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            <I d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={11} />
                            PDF
                          </button>
                          <button onClick={() => setDeleteTarget(f)} title="Supprimer cette facture"
                            style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 8px', background: '#fef2f2', color: 'var(--fs-danger-700)', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 6, cursor: 'pointer' }}>
                            <I d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" size={12} />
                          </button>
                        </div>
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
