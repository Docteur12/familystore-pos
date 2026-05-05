import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { getSales, Sale, PM_LABELS } from '../api/sales';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');

function fmtDatetime(iso: string) {
  const d = new Date(iso);
  return {
    date:  d.toLocaleDateString('fr-FR'),
    heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'À l\'instant';
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
}

// ── SVG Icon ──────────────────────────────────────────────────────────────────

function I({ d, size = 13 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ── Icône mode paiement ───────────────────────────────────────────────────────

const PM_ICONS: Record<string, string> = {
  cash:          'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  mtn_momo:      'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  orange_money:  'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  mobile_money:  'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  card:          'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  credit:        'M9 14l6-6M9.5 8.5a.5.5 0 10-.001 1 .5.5 0 000-1zM14.5 13.5a.5.5 0 10-.001 1 .5.5 0 000-1zM3 10h18M7 15h1',
};

const PM_COLORS: Record<string, { bg: string; color: string }> = {
  cash:         { bg: '#E8F0E5', color: '#3F6B3A' },
  mtn_momo:     { bg: '#FFF3CD', color: '#7A5A00' },
  orange_money:  { bg: '#FFE8D4', color: '#7A3700' },
  mobile_money:  { bg: '#EEF3FA', color: '#3A5E8F' },
  card:          { bg: '#EDE7F6', color: '#5E35B1' },
  credit:        { bg: '#FAE5DF', color: '#8B2C1A' },
};

// ── Périodes ──────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'all';

function periodRange(p: Period): { dateFrom?: string; dateTo?: string } {
  const now   = new Date();
  const start = new Date(now);

  if (p === 'today') {
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  if (p === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // lundi
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return { dateFrom: start.toISOString() };
  }
  if (p === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { dateFrom: start.toISOString() };
  }
  return {}; // all
}

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week',  label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'all',   label: 'Tout' },
];

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(sales: Sale[]) {
  const header = 'Date;Heure;Ticket #;Mode de paiement;Nb articles;Montant payé;Monnaie rendue;Total XAF';
  const rows = sales.map(s => {
    const { date, heure } = fmtDatetime(s.createdAt);
    const nbArt = s.items.reduce((n, it) => n + it.quantity, 0);
    return [
      date, heure,
      s._id.slice(-6).toUpperCase(),
      PM_LABELS[s.paymentMethod] ?? s.paymentMethod,
      nbArt,
      s.amountPaid,
      s.change,
      s.total,
    ].join(';');
  });
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `journal-ventes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Ligne détail ticket (expandable) ─────────────────────────────────────────

function TicketDetail({ sale }: { sale: Sale }) {
  const benefice = sale.items.reduce((s, it) => {
    const cost = typeof it.product === 'object' ? (it.product.costPrice ?? 0) : 0;
    return s + (it.unitPrice - cost) * it.quantity;
  }, 0);

  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--fs-ivory)', padding: '0 0 2px' }}>
        <div style={{ margin: '0 48px 10px', border: '1px solid var(--fs-line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--fs-wine-50)' }}>
                {['Article', 'Qté', 'Prix unit.', 'Sous-total'].map((h, i) => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: i >= 1 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid var(--fs-line)', background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                  <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--fs-ink-800)' }}>{it.name}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)' }}>×{it.quantity}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)' }}>{fmtN(it.unitPrice)} XAF</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{fmtN(it.unitPrice * it.quantity)} XAF</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, padding: '8px 12px', background: 'var(--fs-wine-50)', borderTop: '1px solid var(--fs-line)' }}>
            {benefice > 0 && (
              <span style={{ fontSize: 11, color: 'var(--fs-success-700)', fontWeight: 600 }}>
                Marge : {fmtN(benefice)} XAF
              </span>
            )}
            {sale.change > 0 && (
              <span style={{ fontSize: 11, color: 'var(--fs-ink-500)' }}>
                Monnaie rendue : <strong>{fmtN(sale.change)} XAF</strong>
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>
              Total : {fmtN(sale.total)} XAF
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminJournal() {
  const { toasts, addToast, removeToast } = useToast();

  const [sales,      setSales]      = useState<Sale[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState<Period>('today');
  const [search,     setSearch]     = useState('');
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [lastRefresh,setLastRefresh]= useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const range = periodRange(period);
      const data  = await getSales(range);
      setSales(data);
      setLastRefresh(new Date());
    } catch {
      if (!silent) addToast('Erreur chargement des ventes', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [period, addToast]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  // ── Filtrage local (recherche) ────────────────────────────────────────────

  const q = search.toLowerCase();
  const filtered = sales.filter(s => {
    if (!q) return true;
    const ticketId  = s._id.slice(-6).toLowerCase();
    const pm        = (PM_LABELS[s.paymentMethod] ?? s.paymentMethod).toLowerCase();
    const articles  = s.items.map(it => it.name.toLowerCase()).join(' ');
    return ticketId.includes(q) || pm.includes(q) || articles.includes(q);
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalCA  = filtered.reduce((s, x) => s + x.total, 0);
  const nbArt    = filtered.reduce((s, x) => s + x.items.reduce((n, it) => n + it.quantity, 0), 0);

  const byPm: Record<string, number> = {};
  for (const s of filtered) {
    byPm[s.paymentMethod] = (byPm[s.paymentMethod] ?? 0) + s.total;
  }

  // ── Toggle ligne détail ────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Journal des ventes</h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fs-ink-400)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 2px #bbf7d0' }} />
                {relTime(lastRefresh.toISOString())}
              </div>

              {/* Filtres période */}
              <div style={{ display: 'flex', gap: 4 }}>
                {PERIODS.map(p => (
                  <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: period === p.key ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color:      period === p.key ? '#fff'               : 'var(--fs-ink-500)',
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Recherche */}
              <div style={{ position: 'relative' }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Ticket, article, paiement…"
                  style={{ padding: '7px 12px 7px 32px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', width: 210, fontFamily: 'var(--fs-font-sans)' }} />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-400)' }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
                  </svg>
                </span>
              </div>

              {/* Export CSV */}
              <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.5 : 1 }}>
                <I d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /> CSV
              </button>

              {/* Refresh manuel */}
              <button onClick={() => load()} title="Rafraîchir"
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center' }}>
                <I d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </button>
            </div>
          </div>
        </div>

        {/* Barre stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 28px', background: 'var(--fs-wine-50)', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tickets </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{filtered.length}</span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Articles </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{fmtN(nbArt)}</span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>CA total </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(totalCA)} XAF</span>
          </div>
          {/* Breakdown par mode paiement */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 8 }}>
            {Object.entries(byPm).sort((a, b) => b[1] - a[1]).map(([pm, amt]) => {
              const cfg = PM_COLORS[pm] ?? { bg: '#f5f5f5', color: '#555' };
              return (
                <span key={pm} style={{ display: 'flex', alignItems: 'center', gap: 4, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}>
                  <I d={PM_ICONS[pm] ?? PM_ICONS.cash} size={11} />
                  {PM_LABELS[pm] ?? pm} · {fmtN(amt)} XAF
                </span>
              );
            })}
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
                    <th style={TH}/>
                    {['Ticket #', 'Date · Heure', 'Articles', 'Mode paiement', 'Montant payé', 'Total'].map((h, i) => (
                      <th key={h} style={{ ...TH, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13 }}>
                        {sales.length === 0
                          ? 'Aucune vente enregistrée sur cette période.'
                          : 'Aucune vente correspond à la recherche.'}
                      </td>
                    </tr>
                  ) : filtered.map((s, i) => {
                    const { date, heure } = fmtDatetime(s.createdAt);
                    const isExp  = expanded.has(s._id);
                    const nbArtS = s.items.reduce((n, it) => n + it.quantity, 0);
                    const pmCfg  = PM_COLORS[s.paymentMethod] ?? { bg: '#f5f5f5', color: '#555' };
                    const artSummary = s.items.length === 1
                      ? `${s.items[0].quantity}× ${s.items[0].name}`
                      : `${nbArtS} article${nbArtS > 1 ? 's' : ''} (${s.items.length} réf.)`;

                    return (
                      <React.Fragment key={s._id}>
                        <tr
                          onClick={() => toggleExpand(s._id)}
                          style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: isExp ? 'none' : '1px solid var(--fs-line)', cursor: 'pointer' }}
                        >
                          {/* Chevron */}
                          <td style={{ padding: '10px 8px 10px 14px', color: 'var(--fs-ink-300)', width: 24 }}>
                            <I d={isExp ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} size={12} />
                          </td>
                          {/* Ticket # */}
                          <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', fontWeight: 800, color: 'var(--fs-wine-700)', whiteSpace: 'nowrap' }}>
                            #{s._id.slice(-6).toUpperCase()}
                          </td>
                          {/* Date heure */}
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{date}</div>
                            <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 1 }}>{heure}</div>
                          </td>
                          {/* Articles */}
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-600)', maxWidth: 260 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artSummary}</span>
                          </td>
                          {/* Mode paiement */}
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: pmCfg.bg, color: pmCfg.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                              <I d={PM_ICONS[s.paymentMethod] ?? PM_ICONS.cash} size={11} />
                              {PM_LABELS[s.paymentMethod] ?? s.paymentMethod}
                            </span>
                          </td>
                          {/* Montant payé */}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)', whiteSpace: 'nowrap' }}>
                            {fmtN(s.amountPaid)} XAF
                          </td>
                          {/* Total */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', whiteSpace: 'nowrap' }}>
                            {fmtN(s.total)} XAF
                          </td>
                        </tr>
                        {isExp && <TicketDetail sale={s} />}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--fs-ink-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  borderBottom: '1px solid var(--fs-line)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--fs-ivory)',
  zIndex: 1,
};
