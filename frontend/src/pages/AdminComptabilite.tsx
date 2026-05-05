import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { getComptaMonth, ComptaMonth } from '../api/comptabilite';
import { authHeaders } from '../api/http';

// ── Constantes ────────────────────────────────────────────────────────────────

const TVA_RATE = 0.1925;

const PM_LABELS: Record<string, string> = {
  cash:         'Espèces',
  mtn_momo:     'MTN MoMo',
  orange_money:  'Orange Money',
  card:          'Carte bancaire',
  credit:        'Crédit',
  mobile_money:  'Mobile Money',
};

const fmtN = (n: number) =>
  Math.round(n).toLocaleString('fr-FR');

// ── Génère les 6 derniers mois ────────────────────────────────────────────────

function buildMonths(count = 6): Array<{ year: number; month: number; label: string }> {
  const result = [];
  const now    = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    });
  }
  return result;
}

const MONTHS = buildMonths(6);

// ── Composants ─────────────────────────────────────────────────────────────

function I({ d, size = 13 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '20px', boxShadow: 'var(--fs-shadow-sm)', marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, marginTop: 0 }}>{title}</p>
      {children}
    </div>
  );
}

interface RowProps {
  label:   string;
  value:   number;
  bold?:   boolean;
  accent?: 'pos' | 'neg';
  sub?:    string;
  indent?: boolean;
  pct?:    number;
}
function Row({ label, value, bold, accent, sub, indent, pct }: RowProps) {
  const color = accent === 'pos'
    ? 'var(--fs-success-700)'
    : accent === 'neg'
      ? 'var(--fs-danger-700)'
      : 'var(--fs-ink-800)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--fs-line)' }}>
      <div style={{ paddingLeft: indent ? 16 : 0 }}>
        <div style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: bold ? 'var(--fs-ink-900)' : 'var(--fs-ink-700)' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: bold ? 16 : 13, fontWeight: bold ? 800 : 600, fontFamily: 'var(--fs-font-mono)', color }}>{fmtN(Math.abs(value))} XAF</div>
        {pct !== undefined && <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 1 }}>{pct.toFixed(1)}%</div>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {[0, 1].map(i => (
        <div key={i} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, height: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ height: 12, width: 120, background: 'var(--fs-line)', borderRadius: 4 }}/>
          {[...Array(6)].map((_, j) => (
            <div key={j} style={{ height: 10, background: 'var(--fs-ivory)', borderRadius: 4, width: `${70 + Math.random() * 30}%` }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Téléchargement PDF/Excel ──────────────────────────────────────────────────

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminComptabilite() {
  const { toasts, addToast, removeToast } = useToast();

  const [monthIdx, setMonthIdx] = useState(0);
  const [data,     setData]     = useState<ComptaMonth | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const { year, month } = MONTHS[monthIdx];

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const d = await getComptaMonth(year, month);
      setData(d);
    } catch {
      addToast('Erreur chargement des données comptables', 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month, addToast]);

  useEffect(() => { load(); }, [load]);

  // ── Valeurs dérivées ────────────────────────────────────────────────────────

  const d = data;
  const tvaCollectee  = d ? Math.round(d.ca         * TVA_RATE / (1 + TVA_RATE)) : 0;
  const tvaDeductible = d ? Math.round(d.coutAchats * TVA_RATE / (1 + TVA_RATE)) : 0;
  const tvaDue        = tvaCollectee - tvaDeductible;
  const margePct      = d && d.ca > 0 ? (d.beneficeNet / d.ca) * 100 : 0;
  const caHT          = d ? Math.round(d.ca / (1 + TVA_RATE)) : 0;

  // ── Exports ─────────────────────────────────────────────────────────────────

  async function handleExport(type: 'pdf' | 'excel') {
    setExporting(type);
    try {
      const base    = type === 'pdf'
        ? `/api/reports/monthly/pdf?year=${year}&month=${month}`
        : `/api/reports/monthly/excel?year=${year}&month=${month}`;
      const res     = await fetch(base, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const blob    = await res.blob();
      const url     = URL.createObjectURL(blob);
      const slug    = `${year}-${String(month).padStart(2, '0')}`;
      const ext     = type === 'pdf' ? 'pdf' : 'xlsx';
      downloadFile(url, `rapport-comptable-${slug}.${ext}`);
      URL.revokeObjectURL(url);
    } catch {
      addToast(`Erreur export ${type.toUpperCase()}`, 'error');
    } finally {
      setExporting(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const selLabel = MONTHS[monthIdx].label;
  const capLabel = selLabel.charAt(0).toUpperCase() + selLabel.slice(1);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Pilotage</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
                Comptabilité — {capLabel}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Sélecteur mois */}
              <div style={{ display: 'flex', gap: 4 }}>
                {MONTHS.map((m, i) => (
                  <button key={`${m.year}-${m.month}`} onClick={() => setMonthIdx(i)} style={{
                    padding: '7px 13px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: monthIdx === i ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color:      monthIdx === i ? '#fff'               : 'var(--fs-ink-500)',
                    textTransform: 'capitalize',
                  }}>
                    {m.label.split(' ')[0]}
                  </button>
                ))}
              </div>
              {/* Exports */}
              <button onClick={() => handleExport('excel')} disabled={exporting !== null || !d}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: '#1D7A4E', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (exporting !== null || !d) ? 0.6 : 1 }}>
                <I d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h2M8 17h2M12 13h4M12 17h4"/>
                {exporting === 'excel' ? '…' : 'Excel'}
              </button>
              <button onClick={() => handleExport('pdf')} disabled={exporting !== null || !d}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (exporting !== null || !d) ? 0.6 : 1 }}>
                <I d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                {exporting === 'pdf' ? '…' : 'PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* KPI bar */}
        {d && (
          <div style={{ display: 'flex', gap: 10, padding: '12px 28px', flexShrink: 0, flexWrap: 'wrap', background: '#fff', borderBottom: '1px solid var(--fs-line)' }}>
            {[
              { label: 'CA TTC',       value: d.ca,          color: 'var(--fs-ink-800)' },
              { label: 'Marge brute',  value: d.margesBrute, color: 'var(--fs-success-700)' },
              { label: 'Dépenses',     value: d.depenses,    color: 'var(--fs-danger-700)' },
              { label: 'Bénéfice net', value: d.beneficeNet, color: d.beneficeNet >= 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' },
              { label: 'Nb ventes',    value: d.nbVentes,    color: 'var(--fs-ink-600)', noXaf: true },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '8px 16px', minWidth: 120 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: k.color }}>
                  {(k as any).noXaf ? k.value.toLocaleString('fr-FR') : fmtN(k.value)}
                </div>
                {!(k as any).noXaf && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)' }}>XAF</div>}
              </div>
            ))}
          </div>
        )}

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {loading ? (
            <Skeleton />
          ) : !d ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fs-ink-400)', fontSize: 14 }}>
              Aucune donnée disponible pour cette période.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Colonne gauche */}
              <div>
                {/* Compte de résultat */}
                <Card title="Compte de résultat">
                  <Row label="Chiffre d'affaires TTC" value={d.ca} bold />
                  <Row label="Coût des marchandises vendues" value={d.coutAchats} accent="neg" indent
                    sub="Somme des prix d'achat × quantités vendues"
                    pct={d.ca > 0 ? (d.coutAchats / d.ca) * 100 : 0} />
                  <Row label="Marge brute" value={d.margesBrute} bold accent="pos"
                    pct={d.ca > 0 ? (d.margesBrute / d.ca) * 100 : 0} />
                  {d.depenses > 0 && (
                    <Row label="Total dépenses" value={d.depenses} accent="neg" indent
                      sub="Charges enregistrées sur la période"
                      pct={d.ca > 0 ? (d.depenses / d.ca) * 100 : 0} />
                  )}
                  <div style={{ marginTop: 8, background: d.beneficeNet >= 0 ? 'var(--fs-success-100)' : 'var(--fs-danger-100)', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: d.beneficeNet >= 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' }}>Bénéfice net</div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: d.beneficeNet >= 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' }}>
                        {fmtN(d.beneficeNet)} XAF
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', textAlign: 'right' }}>Marge nette : {margePct.toFixed(1)}%</div>
                    </div>
                  </div>
                </Card>

                {/* Dépenses par catégorie */}
                {d.depensesParCategorie.length > 0 && (
                  <Card title="Répartition des dépenses">
                    {d.depensesParCategorie.map(cat => (
                      <div key={cat.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--fs-line)' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{cat.category}</div>
                          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{cat.count} opération{cat.count > 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-danger-700)' }}>{fmtN(cat.total)} XAF</div>
                          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>
                            {d.depenses > 0 ? ((cat.total / d.depenses) * 100).toFixed(0) : 0}%
                          </div>
                        </div>
                      </div>
                    ))}
                    {d.depensesParCategorie.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', textAlign: 'center', padding: '16px 0' }}>Aucune dépense enregistrée</div>
                    )}
                  </Card>
                )}
              </div>

              {/* Colonne droite */}
              <div>
                {/* TVA */}
                <Card title="TVA (Taux 19,25% — Cameroun)">
                  <Row label="TVA collectée" value={tvaCollectee} sub="Sur les ventes HT" />
                  <Row label="TVA déductible" value={tvaDeductible} accent="neg" sub="Sur les coûts d'achat HT" />
                  <div style={{ marginTop: 8, background: 'var(--fs-wine-50)', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-wine-700)' }}>TVA à reverser</div>
                    <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(tvaDue)} XAF</div>
                  </div>
                </Card>

                {/* Synthèse financière */}
                <Card title="Synthèse financière">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    {[
                      { label: 'CA HT',        value: caHT,          color: 'var(--fs-ink-800)' },
                      { label: 'CA TTC',        value: d.ca,          color: 'var(--fs-ink-800)' },
                      { label: 'Marge brute',   value: d.margesBrute, color: 'var(--fs-success-700)' },
                      { label: 'Bénéfice net',  value: d.beneficeNet, color: d.beneficeNet >= 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'var(--fs-ivory)', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: item.color }}>{fmtN(item.value)}</div>
                        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>XAF</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Ventes par mode de paiement */}
                {d.ventesParPaiement.length > 0 && (
                  <Card title="Ventes par mode de paiement">
                    {d.ventesParPaiement.map(vp => (
                      <div key={vp.mode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--fs-line)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-700)' }}>
                          {PM_LABELS[vp.mode] ?? vp.mode}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>
                            {fmtN(vp.total)} XAF
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>
                            {d.ca > 0 ? ((vp.total / d.ca) * 100).toFixed(0) : 0}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </Card>
                )}

                {/* État vide */}
                {d.nbVentes === 0 && (
                  <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '32px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fs-ink-500)' }}>Aucune vente enregistrée pour {selLabel}</div>
                    <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', marginTop: 4 }}>Les données apparaîtront ici dès la première vente.</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
