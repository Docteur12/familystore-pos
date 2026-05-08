import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { forceCloseSession, getSessions, SessionRecord } from '../api/sessions';

const PAGE_SIZE = 50;
const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');

function duration(debut: string, fin: string | null): string {
  if (!fin) return 'En cours';
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
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

export default function AdminSessions() {
  const { toasts, addToast, removeToast } = useToast();

  const [sessions,    setSessions]    = useState<SessionRecord[]>([]);
  const [total,       setTotal]       = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [page,        setPage]        = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [closing,     setClosing]     = useState<string | null>(null);
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [cashier,     setCashier]     = useState('');
  const [activeOnly,  setActiveOnly]  = useState(false);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const [res, activeRes] = await Promise.all([
        getSessions({
          dateFrom:   dateFrom   || undefined,
          dateTo:     dateTo     || undefined,
          cashier:    cashier    || undefined,
          page:       p,
          limit:      PAGE_SIZE,
          activeOnly: activeOnly || undefined,
        }),
        getSessions({ activeOnly: true, limit: 1 }),
      ]);
      setSessions(res.data);
      setTotal(res.total);
      setActiveTotal(activeRes.total);
      setPage(p);
    } catch {
      addToast('Erreur chargement des sessions', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, cashier, activeOnly, addToast]);

  const handleForceClose = async (id: string) => {
    setClosing(id);
    try {
      await forceCloseSession(id);
      addToast('Session fermée', 'success');
      load(page);
    } catch {
      addToast('Erreur lors de la fermeture', 'error');
    } finally {
      setClosing(null);
    }
  };

  useEffect(() => { load(0); }, [load]);

  const pages           = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalEncaisse   = sessions.reduce((s, x) => s + x.totalEncaisse, 0);
  const totalVentes     = sessions.reduce((s, x) => s + x.nbVentes, 0);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Personnel</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Sessions de travail</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input placeholder="Caissière…" value={cashier} onChange={e => setCashier(e.target.value)}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, width: 140 }} />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12 }} />
              <span style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12 }} />
              <button
                onClick={() => setActiveOnly(a => !a)}
                style={{ padding: '7px 12px', border: `1.5px solid ${activeOnly ? '#EA580C' : 'var(--fs-line-2)'}`, borderRadius: 8, background: activeOnly ? '#FFF7ED' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: activeOnly ? '#EA580C' : 'var(--fs-ink-500)' }}>
                ● Actives
              </button>
              <button onClick={() => load(0)}
                style={{ padding: '7px 14px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Filtrer
              </button>
              <button onClick={() => { setDateFrom(''); setDateTo(''); setCashier(''); setActiveOnly(false); }}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Barre stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 28px', background: 'var(--fs-wine-50)', borderBottom: '1px solid var(--fs-line)', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sessions </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{total}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: activeTotal > 0 ? '#EA580C' : 'var(--fs-ink-300)', display: 'inline-block' }}/>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Actives </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: activeTotal > 0 ? '#EA580C' : 'var(--fs-ink-900)' }}>{activeTotal}</span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ventes </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{totalVentes}</span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>CA affiché </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(totalEncaisse)} XAF</span>
          </div>
          {pages > 1 && (
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fs-ink-400)' }}>Page {page + 1} / {pages}</div>
          )}
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
                    {['Caissière', 'Caisse', 'Date', 'Début', 'Fin', 'Durée', 'Ventes', 'CA', 'Statut', ''].map(h => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 48, textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13 }}>
                        Aucune session enregistrée.
                      </td>
                    </tr>
                  ) : sessions.map((s, i) => (
                    <tr key={s._id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {s.cashierName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-800)' }}>{s.cashierName}</div>
                            {s.cashierEmail && <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{s.cashierEmail}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-600)' }}>
                        {s.caisseName || '—'}
                        {s.caisseCode && <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{s.caisseCode}</div>}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-600)', whiteSpace: 'nowrap' }}>
                        {fmtDate(s.dateDebut)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)', whiteSpace: 'nowrap' }}>
                        {fmtTime(s.dateDebut)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)', whiteSpace: 'nowrap' }}>
                        {s.dateFin ? fmtTime(s.dateFin) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)', whiteSpace: 'nowrap' }}>
                        {duration(s.dateDebut, s.dateFin)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', textAlign: 'right' }}>
                        {s.closed ? s.nbVentes : (s.liveCount ?? '—')}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {fmtN(s.totalEncaisse)} XAF
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 10,
                          background: s.closed ? '#F0FDF4' : '#FFF7ED',
                          color:      s.closed ? '#16A34A' : '#EA580C',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {s.closed ? '✓ Fermée' : '● Active'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {!s.closed && (
                          <button
                            onClick={() => handleForceClose(s._id)}
                            disabled={closing === s._id}
                            title="Forcer la fermeture"
                            style={{ padding: '4px 10px', border: '1px solid #EA580C', borderRadius: 6, background: closing === s._id ? '#FFF7ED' : '#fff', color: '#EA580C', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: closing === s._id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                            {closing === s._id ? '…' : 'Fermer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button onClick={() => load(page - 1)} disabled={page === 0}
                style={{ padding: '7px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, color: 'var(--fs-ink-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <I d="M15 18l-6-6 6-6" size={12} /> Précédent
              </button>
              <span style={{ fontSize: 12, color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-mono)' }}>{page + 1} / {pages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= pages - 1}
                style={{ padding: '7px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: page >= pages - 1 ? 'not-allowed' : 'pointer', opacity: page >= pages - 1 ? 0.4 : 1, color: 'var(--fs-ink-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Suivant <I d="M9 18l6-6-6-6" size={12} />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
