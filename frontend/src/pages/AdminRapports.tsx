import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import {
  getAnalyseMonth, downloadReport, getByProduct,
  AnalyseMonth, CaissierData, ProductStat,
} from '../api/rapports';
import { getStatsPeriod, getComparisons, PeriodDay, Comparisons } from '../api/dashboard';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');
const fmtM = (n: number) => n >= 1_000_000
  ? (n / 1_000_000).toFixed(2).replace('.', ',') + 'M'
  : Math.round(n / 1_000) + 'K';
const fmtK = (n: number) => Math.round(n / 1_000) + 'K';

function buildMonths(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      short: d.toLocaleDateString('fr-FR', { month: 'short' }),
      label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  });
}
const MONTHS = buildMonths(6);

// ── Couleurs catégories ───────────────────────────────────────────────────────

const CAT_COLOR_MAP: Record<string, string> = {
  beauté:      '#F5C4B2', épicerie:    '#EDD8A0',
  hygiène:     '#B8D8EC', boissons:    '#B4DCC4',
  parfumerie:  '#D8C4E8', cosmétiques: '#F7C6D1',
  alimentaire: '#C6E4C6', nettoyage:   '#FFDFA8',
  santé:       '#C8D8F0', autres:      '#DDD4C8',
};
const CAT_PALETTE = Object.values(CAT_COLOR_MAP);

function catColor(name: string, idx: number): string {
  const key = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  return CAT_COLOR_MAP[key] ?? CAT_PALETTE[idx % CAT_PALETTE.length];
}

// ── Couleurs & initiales caissiers ────────────────────────────────────────────

const CAISSIER_COLORS = ['#C2566B','#7A9EC2','#C2A07A','#9A7AC2','#7AC29A','#C2C27A'];
const MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'];

function initials(nom: string) {
  return nom.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function pctVs(a: number, b: number) {
  if (b === 0) return null;
  return ((a - b) / b * 100).toFixed(1);
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

const DAYS_FR  = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const HOURS    = Array.from({ length: 24 }, (_, i) => i);

function Heatmap({ data }: { data: number[][] }) {
  const hasData = data.some(row => row.some(v => v > 0));
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 4, paddingLeft: 32 }}>
        {[0,4,8,12,16,20].map(h => (
          <div key={h} style={{ flex: '0 0 auto', width: hasData ? 16 : 14, fontSize: 9, color: 'var(--fs-ink-400)', textAlign: 'center', marginRight: 2 }}>{h}h</div>
        ))}
      </div>
      {DAYS_FR.map((day, di) => (
        <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <div style={{ width: 28, fontSize: 10, color: 'var(--fs-ink-400)', flexShrink: 0 }}>{day}</div>
          {HOURS.map(h => {
            const v = data[di]?.[h] ?? 0;
            return (
              <div key={h} style={{
                width: 13, height: 13, borderRadius: 2, flexShrink: 0,
                background: v === 0
                  ? 'var(--fs-line)'
                  : `rgba(122,29,46,${Math.max(v, 0.1).toFixed(2)})`,
              }} title={`${day} ${h}h : ${Math.round(v * 100)}%`}/>
            );
          })}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, paddingLeft: 30 }}>
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Faible</span>
        {[0.15,0.35,0.55,0.75,0.95].map(v => (
          <div key={v} style={{ width: 13, height: 13, borderRadius: 2, background: `rgba(122,29,46,${v})` }}/>
        ))}
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Élevé</span>
      </div>
      {!hasData && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 10 }}>
          Aucune donnée disponible
        </div>
      )}
    </div>
  );
}

// ── Tooltip bar chart ─────────────────────────────────────────────────────────

function BarTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, padding: '6px 10px', fontSize: 11, boxShadow: 'var(--fs-shadow-md)' }}>
      <div style={{ fontWeight: 700, color: 'var(--fs-ink-500)', marginBottom: 2 }}>Jour {label}</div>
      <div style={{ fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(payload[0].value)} XAF</div>
      {payload[0].payload?.nbVentes > 0 && (
        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 2 }}>{payload[0].payload.nbVentes} vente{payload[0].payload.nbVentes > 1 ? 's' : ''}</div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  const box = (h: number, w?: string) => (
    <div style={{ height: h, width: w ?? '100%', background: 'var(--fs-line)', borderRadius: 6, marginBottom: 8 }} />
  );
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
        <div style={{ flex: 2, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20 }}>{box(40)}{box(14,'60%')}{box(12,'40%')}</div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20 }}>{box(30)}{box(14,'50%')}</div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20 }}>{box(30)}{box(14,'50%')}</div>
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, height: 260 }}>{box(16,'40%')}{box(180)}</div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fs-ink-400)' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune vente enregistrée</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Les données de {label} apparaîtront ici dès la première vente.</div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AdminRapports() {
  const { toasts, addToast, removeToast } = useToast();

  const [monthIdx,   setMonthIdx]   = useState(0);
  const [data,       setData]       = useState<AnalyseMonth | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [exporting,  setExporting]  = useState<'pdf' | 'excel' | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<PeriodDay[]>([]);
  const [comparisons,  setComparisons]  = useState<Comparisons | null>(null);
  const [byProduct,    setByProduct]    = useState<ProductStat[]>([]);
  const [prodDateFrom, setProdDateFrom] = useState('');
  const [prodDateTo,   setProdDateTo]   = useState('');
  const [prodLoading,  setProdLoading]  = useState(false);

  const { year, month, label } = MONTHS[monthIdx];

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      setData(await getAnalyseMonth(year, month));
    } catch {
      addToast('Erreur chargement du rapport', 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month, addToast]);

  useEffect(() => { load(); }, [load]);

  // Chargement unique des stats globales (comparaisons + 12 mois)
  useEffect(() => {
    getStatsPeriod(365).then(setMonthlyStats).catch(() => {});
    getComparisons().then(setComparisons).catch(() => {});
    getByProduct().then(setByProduct).catch(() => {});
  }, []);

  const loadByProduct = async () => {
    setProdLoading(true);
    try { setByProduct(await getByProduct({ dateFrom: prodDateFrom || undefined, dateTo: prodDateTo || undefined })); }
    catch { addToast('Erreur chargement journal produits', 'error'); }
    finally { setProdLoading(false); }
  };

  async function handleExport(type: 'pdf' | 'excel') {
    setExporting(type);
    try {
      await downloadReport(type, year, month);
    } catch {
      addToast(`Erreur export ${type.toUpperCase()}`, 'error');
    } finally {
      setExporting(null);
    }
  }

  // ── Données dérivées ──────────────────────────────────────────────────────

  const d = data;
  const capLabel    = label.charAt(0).toUpperCase() + label.slice(1);
  const margeNette  = d && d.ca > 0 ? ((d.beneficeNet / d.ca) * 100).toFixed(1) : '0.0';
  const evoPct      = d ? pctVs(d.ca, d.prevCA) : null;
  const avgDaily    = d && d.parJour.length > 0
    ? Math.round(d.ca / d.parJour.filter(j => j.ca > 0).length || 1)
    : 0;
  const picJour     = d ? d.parJour.reduce((best, j) => j.ca > best.ca ? j : best, { jour: 0, ca: 0, nbVentes: 0 }) : null;

  const chartData = d?.parJour.map(j => ({
    day:      j.jour,
    value:    j.ca,
    nbVentes: j.nbVentes,
    isWE:     [0, 6].includes(new Date(year, month - 1, j.jour).getDay()),
  })) ?? [];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Rapports & Analyses — Mensuel</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
                Rapport mensuel — {capLabel}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Sélecteur mois */}
              <div style={{ display: 'flex', gap: 4 }}>
                {MONTHS.map((m, i) => (
                  <button key={`${m.year}-${m.month}`} onClick={() => setMonthIdx(i)} style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: monthIdx === i ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color:      monthIdx === i ? '#fff'               : 'var(--fs-ink-500)',
                    textTransform: 'capitalize',
                  }}>{m.short}</button>
                ))}
              </div>
              {/* Exports */}
              <button onClick={() => handleExport('excel')} disabled={exporting !== null || !d || d.nbVentes === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: '#1D7A4E', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (exporting !== null || !d || d.nbVentes === 0) ? 0.5 : 1 }}>
                ⬇ {exporting === 'excel' ? '…' : 'Excel'}
              </button>
              <button onClick={() => handleExport('pdf')} disabled={exporting !== null || !d || d.nbVentes === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--fs-wine-700)', background: 'none', color: 'var(--fs-wine-700)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (exporting !== null || !d || d.nbVentes === 0) ? 0.5 : 1 }}>
                ⬇ {exporting === 'pdf' ? '…' : 'PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px 28px' }}>

          {loading ? (
            <Skeleton />
          ) : !d || d.nbVentes === 0 ? (
            <EmptyState label={label} />
          ) : (
            <>
              {/* KPI cards */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
                {/* CA — grande carte bordeaux */}
                <div style={{ flex: 2, background: 'var(--fs-wine-800)', borderRadius: 12, padding: '20px 24px', color: '#fff', minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,235,217,0.5)', marginBottom: 10 }}>
                    Chiffre d'affaires — {capLabel}
                  </div>
                  <div style={{ fontSize: 38, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 12 }}>
                    {fmtM(d.ca)} <span style={{ fontSize: 18 }}>XAF</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {evoPct !== null && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: parseFloat(evoPct) >= 0 ? 'var(--fs-gold-300)' : '#F5A0A0' }}>
                        {parseFloat(evoPct) >= 0 ? '+' : ''}{evoPct}% vs mois préc.
                      </div>
                    )}
                    {d.prevCA === 0 && (
                      <div style={{ fontSize: 12, color: 'rgba(245,235,217,0.4)' }}>Premier mois enregistré</div>
                    )}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(245,235,217,0.4)' }}>
                    {d.nbVentes} ticket{d.nbVentes > 1 ? 's' : ''} · panier moy. {fmtN(d.panierMoyen)} XAF
                  </div>
                </div>

                {/* Bénéfice net */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 10 }}>Bénéfice net</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: d.beneficeNet >= 0 ? 'var(--fs-ink-900)' : 'var(--fs-danger-700)', lineHeight: 1, marginBottom: 6 }}>
                    {fmtM(d.beneficeNet)} <span style={{ fontSize: 13 }}>XAF</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
                    Marge nette : <b style={{ color: d.beneficeNet >= 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' }}>{margeNette} %</b>
                  </div>
                  {d.depenses > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 4 }}>
                      Dépenses : {fmtM(d.depenses)} XAF
                    </div>
                  )}
                </div>

                {/* Tickets & panier */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 10 }}>Tickets · Panier moyen</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1, marginBottom: 6 }}>
                    {fmtN(d.nbVentes)} <span style={{ fontSize: 13, fontWeight: 600 }}>tickets</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
                    Panier : <b style={{ color: 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(d.panierMoyen)} XAF</b>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 4 }}>
                    Moy. quotidienne : {fmtK(avgDaily)} XAF
                  </div>
                </div>
              </div>

              {/* Bar chart ventes journalières */}
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Ventes journalières · {d.parJour.length} jours</div>
                    {picJour && picJour.ca > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>
                        Pic le {picJour.jour} — {fmtK(picJour.ca)} XAF ({picJour.nbVentes} ventes)
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Moyenne journée active</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{fmtK(avgDaily)} XAF</div>
                  </div>
                </div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={9}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 10)}/>
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={36}/>
                      <Tooltip content={<BarTip/>}/>
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {chartData.map((cd, i) => (
                          <Cell key={i} fill={cd.value === 0 ? '#E5E7EB' : cd.isWE ? '#D1A660' : '#7A1D2E'}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fs-ink-500)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: '#7A1D2E' }}/> Jours semaine
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fs-ink-500)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: '#D1A660' }}/> Week-ends
                  </div>
                </div>
              </div>

              {/* Section basse : 3 colonnes */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                {/* Catégories produits */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Par catégorie</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Répartition du CA mensuel</div>
                  {d.parCategorie.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', textAlign: 'center', padding: '24px 0' }}>Catégories non renseignées</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {d.parCategorie.slice(0, 7).map((cat, idx) => (
                        <div key={cat.categorie}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: catColor(cat.categorie, idx) }}/>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{cat.categorie}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{fmtN(cat.ca)}</span>
                              <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginLeft: 6 }}>{cat.pct}%</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: 'var(--fs-line)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${cat.pct}%`, background: catColor(cat.categorie, idx), borderRadius: 3 }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Classement caissiers */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Classement caissiers</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Performances individuelles · CA généré</div>
                  {d.parCaissier.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', textAlign: 'center', padding: '24px 0' }}>
                      Aucune donnée caissier disponible
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {d.parCaissier.map((c: CaissierData, i: number) => (
                        <div key={c.nom} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{MEDALS[i] ?? `${i + 1}.`}</span>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: CAISSIER_COLORS[i % CAISSIER_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {initials(c.nom)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{c.nom}</div>
                            <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>
                              {c.nbVentes} vente{c.nbVentes > 1 ? 's' : ''} · panier {fmtN(c.panierMoyen)}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', flexShrink: 0 }}>
                            {fmtN(c.ca)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Heatmap affluence horaire */}
                <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Affluence horaire</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Intensité des ventes par jour et heure</div>
                  <div style={{ overflowX: 'auto' }}>
                    <Heatmap data={d.heatmap}/>
                  </div>
                </div>
              </div>

              {/* Top produits */}
              {d.topProduits.length > 0 && (
                <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Top produits</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Les 10 meilleurs produits par CA généré</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {d.topProduits.map((p, i) => (
                      <div key={p.nom} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--fs-ivory)', borderRadius: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--fs-wine-50)', color: 'var(--fs-wine-700)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
                          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{p.quantite} unité{p.quantite > 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', flexShrink: 0 }}>
                          {fmtN(p.ca)} XAF
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Statistiques tickets par mois */}
              {monthlyStats.length > 0 && (
                <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Statistiques tickets · 12 derniers mois</div>
                  <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>MIN / MAX / MOYENNE par ticket, par période</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--fs-ivory)' }}>
                          {['Période', 'Nb tickets', 'CA total', 'MIN', 'MAX', 'Moyenne'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Période' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...monthlyStats].reverse().map((row, i) => (
                          <tr key={row.date} style={{ borderBottom: '1px solid var(--fs-line)', background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--fs-ink-800)' }}>{row.label}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{row.nbVentes}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)' }}>{fmtN(row.totalCA)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: '#7AB87A' }}>{row.nbVentes > 0 ? fmtN(row.minTicket) : '—'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: '#D1A660' }}>{row.nbVentes > 0 ? fmtN(row.maxTicket) : '—'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{row.nbVentes > 0 ? fmtN(row.avgTicket) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Comparaisons (hors filtre mois) ── */}
          {comparisons && (
            <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Comparaisons de périodes</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 16 }}>Semaine · Mois · Année — vs période précédente</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { label: 'Semaine en cours', curr: comparisons.week,  prev: comparisons.prevWeek,  icon: '📅' },
                  { label: 'Mois en cours',    curr: comparisons.month, prev: comparisons.prevMonth, icon: '🗓️' },
                  { label: 'Année en cours',   curr: comparisons.year,  prev: comparisons.prevYear,  icon: '📆' },
                ] as const).map(({ label, curr, prev, icon }) => {
                  const metrics = [
                    { name: 'CA', curr: curr.ca, prev: prev.ca, fmt: (v: number) => `${fmtN(v)} XAF` },
                    { name: 'Tickets', curr: curr.nb, prev: prev.nb, fmt: (v: number) => String(v) },
                    { name: 'MIN',  curr: curr.min, prev: prev.min, fmt: (v: number) => `${fmtN(v)} XAF` },
                    { name: 'MAX',  curr: curr.max, prev: prev.max, fmt: (v: number) => `${fmtN(v)} XAF` },
                    { name: 'Moy.', curr: curr.avg, prev: prev.avg, fmt: (v: number) => `${fmtN(v)} XAF` },
                  ];
                  return (
                    <div key={label} style={{ border: '1px solid var(--fs-line)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: 'var(--fs-ivory)', padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-800)' }}>{icon} {label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                        {metrics.map((m, mi) => {
                          const pct = prev.ca > 0 || m.name !== 'CA' ? (m.prev > 0 ? ((m.curr - m.prev) / m.prev * 100) : null) : null;
                          const up  = pct !== null && pct >= 0;
                          return (
                            <div key={m.name} style={{ flex: '1 1 90px', padding: '10px 14px', borderLeft: mi > 0 ? '1px solid var(--fs-line)' : 'none', borderTop: '1px solid var(--fs-line)' }}>
                              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fs-ink-400)', marginBottom: 4 }}>{m.name}</div>
                              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{m.fmt(m.curr)}</div>
                              {pct !== null ? (
                                <div style={{ fontSize: 11, fontWeight: 700, color: up ? '#16A34A' : '#DC2626', marginTop: 2 }}>
                                  {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                                </div>
                              ) : (
                                <div style={{ fontSize: 10, color: 'var(--fs-ink-300)', marginTop: 2 }}>Pas de référence</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Journal par produit ── */}
          <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Journal des ventes par produit</div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{byProduct.length} produit{byProduct.length !== 1 ? 's' : ''} · toutes périodes si aucun filtre</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <input type="date" value={prodDateFrom} onChange={e => setProdDateFrom(e.target.value)}
                  style={{ padding: '6px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12 }} />
                <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>→</span>
                <input type="date" value={prodDateTo} onChange={e => setProdDateTo(e.target.value)}
                  style={{ padding: '6px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12 }} />
                <button onClick={loadByProduct} disabled={prodLoading}
                  style={{ padding: '6px 14px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: prodLoading ? 0.6 : 1 }}>
                  {prodLoading ? '…' : 'Filtrer'}
                </button>
              </div>
            </div>
            {byProduct.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fs-ink-400)', fontSize: 12 }}>Aucune donnée disponible</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--fs-ivory)' }}>
                      {['Produit', 'Qté vendue', 'CA généré', 'Nb transactions', 'Prix moy. vente'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Produit' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byProduct.map((p, i) => (
                      <tr key={p.name} style={{ borderBottom: '1px solid var(--fs-line)', background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--fs-ink-800)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{p.qtySold}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)' }}>{fmtN(p.caGenere)} XAF</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)' }}>{p.nbTransactions}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{fmtN(p.prixMoyenVente)} XAF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
