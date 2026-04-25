import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import AdminSidebar from '../components/AdminSidebar';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtN  = (n: number) => n.toLocaleString('fr-FR');
const fmtM  = (n: number) => n >= 1_000_000
  ? (n / 1_000_000).toFixed(2).replace('.', ',') + 'M'
  : Math.round(n / 1_000) + 'K';
const fmtK  = (n: number) => Math.round(n / 1_000) + 'K';

// ── Mock monthly data ─────────────────────────────────────────────────────────

interface MonthData {
  label: string;
  ca: number;
  benefice: number;
  tickets: number;
  panier: number;
  prevCa: number;
  prevYearCa: number;
  objectif: number;
  days: number[];
  categories: { name: string; color: string; pct: number; amount: number }[];
  caissiers: { name: string; ventes: number; panier: number; ca: number; initials: string; color: string }[];
}

const MONTHS: MonthData[] = [
  {
    label: 'Avril 2026',
    ca: 14_820_000, benefice: 5_630_000, tickets: 1184, panier: 12_514,
    prevCa: 12_520_000, prevYearCa: 12_350_000, objectif: 14_500_000,
    days: (() => {
      const d = [];
      for (let i = 1; i <= 30; i++) {
        const isWE = i % 7 === 0 || i % 7 === 6;
        d.push(Math.round((isWE ? 680_000 : 430_000) + (Math.sin(i * 0.7) * 120_000)));
      }
      return d;
    })(),
    categories: [
      { name: 'Beauté',      color: '#F5C4B2', pct: 35.3, amount: 5_234_000 },
      { name: 'Épicerie',    color: '#EDD8A0', pct: 26.2, amount: 3_878_000 },
      { name: 'Hygiène',     color: '#B8D8EC', pct: 14.5, amount: 2_148_000 },
      { name: 'Boissons',    color: '#B4DCC4', pct: 13.0, amount: 1_924_000 },
      { name: 'Parfumerie',  color: '#D8C4E8', pct:  6.7, amount:   986_000 },
      { name: 'Autres',      color: '#DDD4C8', pct:  4.3, amount:   650_000 },
    ],
    caissiers: [
      { name: 'Aïcha N.',  ventes: 426, panier: 12_583, ca: 5_184_000, initials: 'AN', color: '#C2566B' },
      { name: 'Marie T.',  ventes: 279, panier: 13_456, ca: 3_712_000, initials: 'MT', color: '#7A9EC2' },
      { name: 'Jean D.',   ventes: 243, panier: 12_390, ca: 2_986_000, initials: 'JD', color: '#C2A07A' },
      { name: 'Fatou K.',  ventes: 236, panier: 12_449, ca: 2_938_000, initials: 'FK', color: '#9A7AC2' },
    ],
  },
  {
    label: 'Mars 2026',
    ca: 12_520_000, benefice: 4_810_000, tickets: 1002, panier: 12_495,
    prevCa: 11_100_000, prevYearCa: 10_800_000, objectif: 13_000_000,
    days: (() => {
      const d = [];
      for (let i = 1; i <= 31; i++) {
        const isWE = i % 7 === 0 || i % 7 === 6;
        d.push(Math.round((isWE ? 580_000 : 360_000) + (Math.cos(i * 0.6) * 80_000)));
      }
      return d;
    })(),
    categories: [
      { name: 'Beauté',      color: '#F5C4B2', pct: 33.0, amount: 4_131_600 },
      { name: 'Épicerie',    color: '#EDD8A0', pct: 27.5, amount: 3_443_000 },
      { name: 'Hygiène',     color: '#B8D8EC', pct: 16.2, amount: 2_028_240 },
      { name: 'Boissons',    color: '#B4DCC4', pct: 12.0, amount: 1_502_400 },
      { name: 'Parfumerie',  color: '#D8C4E8', pct:  7.0, amount:   876_400 },
      { name: 'Autres',      color: '#DDD4C8', pct:  4.3, amount:   538_360 },
    ],
    caissiers: [
      { name: 'Aïcha N.',  ventes: 342, panier: 12_100, ca: 4_138_200, initials: 'AN', color: '#C2566B' },
      { name: 'Marie T.',  ventes: 225, panier: 12_800, ca: 2_880_000, initials: 'MT', color: '#7A9EC2' },
      { name: 'Jean D.',   ventes: 210, panier: 11_800, ca: 2_478_000, initials: 'JD', color: '#C2A07A' },
      { name: 'Fatou K.',  ventes: 225, panier: 11_800, ca: 2_655_000, initials: 'FK', color: '#9A7AC2' },
    ],
  },
  {
    label: 'Février 2026',
    ca: 10_980_000, benefice: 4_050_000, tickets: 902, panier: 12_172,
    prevCa: 10_200_000, prevYearCa: 9_800_000, objectif: 11_500_000,
    days: (() => {
      const d = [];
      for (let i = 1; i <= 28; i++) {
        const isWE = i % 7 === 0 || i % 7 === 6;
        d.push(Math.round((isWE ? 530_000 : 340_000) + (Math.sin(i * 0.5) * 60_000)));
      }
      return d;
    })(),
    categories: [
      { name: 'Beauté',      color: '#F5C4B2', pct: 34.0, amount: 3_733_200 },
      { name: 'Épicerie',    color: '#EDD8A0', pct: 25.0, amount: 2_745_000 },
      { name: 'Hygiène',     color: '#B8D8EC', pct: 15.0, amount: 1_647_000 },
      { name: 'Boissons',    color: '#B4DCC4', pct: 14.0, amount: 1_537_200 },
      { name: 'Parfumerie',  color: '#D8C4E8', pct:  7.0, amount:   768_600 },
      { name: 'Autres',      color: '#DDD4C8', pct:  5.0, amount:   549_000 },
    ],
    caissiers: [
      { name: 'Aïcha N.',  ventes: 306, panier: 11_800, ca: 3_610_800, initials: 'AN', color: '#C2566B' },
      { name: 'Marie T.',  ventes: 198, panier: 12_200, ca: 2_415_600, initials: 'MT', color: '#7A9EC2' },
      { name: 'Jean D.',   ventes: 188, panier: 11_500, ca: 2_162_000, initials: 'JD', color: '#C2A07A' },
      { name: 'Fatou K.',  ventes: 210, panier: 11_200, ca: 2_352_000, initials: 'FK', color: '#9A7AC2' },
    ],
  },
  {
    label: 'Janvier 2026',
    ca: 11_340_000, benefice: 4_290_000, tickets: 960, panier: 11_812,
    prevCa: 10_800_000, prevYearCa: 10_100_000, objectif: 12_000_000,
    days: (() => {
      const d = [];
      for (let i = 1; i <= 31; i++) {
        const isWE = i % 7 === 0 || i % 7 === 6;
        d.push(Math.round((isWE ? 550_000 : 330_000) + (Math.cos(i * 0.8) * 70_000)));
      }
      return d;
    })(),
    categories: [
      { name: 'Beauté',      color: '#F5C4B2', pct: 30.0, amount: 3_402_000 },
      { name: 'Épicerie',    color: '#EDD8A0', pct: 28.0, amount: 3_175_200 },
      { name: 'Hygiène',     color: '#B8D8EC', pct: 17.0, amount: 1_927_800 },
      { name: 'Boissons',    color: '#B4DCC4', pct: 13.0, amount: 1_474_200 },
      { name: 'Parfumerie',  color: '#D8C4E8', pct:  8.0, amount:   907_200 },
      { name: 'Autres',      color: '#DDD4C8', pct:  4.0, amount:   453_600 },
    ],
    caissiers: [
      { name: 'Aïcha N.',  ventes: 325, panier: 11_900, ca: 3_867_500, initials: 'AN', color: '#C2566B' },
      { name: 'Marie T.',  ventes: 218, panier: 11_600, ca: 2_528_800, initials: 'MT', color: '#7A9EC2' },
      { name: 'Jean D.',   ventes: 200, panier: 11_400, ca: 2_280_000, initials: 'JD', color: '#C2A07A' },
      { name: 'Fatou K.',  ventes: 217, panier: 11_300, ca: 2_452_100, initials: 'FK', color: '#9A7AC2' },
    ],
  },
];

// ── Heatmap ───────────────────────────────────────────────────────────────────

const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const HOURS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];

function Heatmap() {
  const cells = useMemo(() => {
    const data: number[][] = [];
    for (let d = 0; d < 7; d++) {
      const row: number[] = [];
      for (let h = 0; h < 24; h++) {
        const open = h >= 8 && h <= 20;
        const peak = (h >= 11 && h <= 13) || (h >= 17 && h <= 19);
        const we   = d >= 5;
        const val  = open ? (peak ? 0.7 + Math.random() * 0.3 : we ? 0.4 + Math.random() * 0.4 : 0.2 + Math.random() * 0.4) : 0;
        row.push(val);
      }
      data.push(row);
    }
    return data;
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 4, paddingLeft: 32 }}>
        {[0,3,6,9,12,15,18,21].map(h => (
          <div key={h} style={{ flex: '0 0 auto', width: 21, fontSize: 9, color: 'var(--fs-ink-400)', textAlign: 'center' }}>{h}</div>
        ))}
      </div>
      {DAYS_FR.map((day, di) => (
        <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <div style={{ width: 28, fontSize: 10, color: 'var(--fs-ink-400)', flexShrink: 0 }}>{day}</div>
          {HOURS.map(h => {
            const v = cells[di][h];
            const alpha = v;
            return (
              <div key={h} style={{
                width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                background: v === 0 ? 'var(--fs-line)' : `rgba(122,29,46,${alpha.toFixed(2)})`,
              }} title={`${day} ${h}h: ${Math.round(v * 100)}%`}/>
            );
          })}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 30 }}>
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Faible</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
          <div key={v} style={{ width: 14, height: 14, borderRadius: 2, background: `rgba(122,29,46,${v})` }}/>
        ))}
        <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Élevé</span>
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function BarTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, padding: '6px 10px', fontSize: 11, boxShadow: 'var(--fs-shadow-md)' }}>
      <div style={{ fontWeight: 700, color: 'var(--fs-ink-500)', marginBottom: 2 }}>Jour {label}</div>
      <div style={{ fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(payload[0].value)} XAF</div>
    </div>
  );
}

// ── Medal ──────────────────────────────────────────────────────────────────────

const MEDALS = ['🥇','🥈','🥉','4️⃣'];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminRapports() {
  const [monthIdx, setMonthIdx] = useState(0);
  const m = MONTHS[monthIdx];

  const pctVsPrev    = ((m.ca - m.prevCa) / m.prevCa * 100).toFixed(1);
  const pctVsYear    = ((m.ca - m.prevYearCa) / m.prevYearCa * 100).toFixed(1);
  const pctObjectif  = ((m.ca / m.objectif) * 100).toFixed(0);
  const margeNette   = ((m.benefice / m.ca) * 100).toFixed(1);
  const avgDaily     = Math.round(m.ca / m.days.length / 1000);

  const chartData = m.days.map((v, i) => ({
    day: i + 1,
    value: v,
    isWE: (i + 1) % 7 === 0 || (i + 1) % 7 === 6,
  }));

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Rapports & Analyses — Mensuel</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
                Rapport mensuel — {m.label}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {MONTHS.map((mo, i) => (
                  <button key={mo.label} onClick={() => setMonthIdx(i)} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: monthIdx === i ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color: monthIdx === i ? '#fff' : 'var(--fs-ink-500)',
                  }}>{mo.label.split(' ')[0]}</button>
                ))}
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, background: 'none', color: 'var(--fs-wine-700)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ⬇ PDF
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ⬇ Excel
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px 28px' }}>
          {/* Top metric cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
            {/* CA du mois — big bordeaux card */}
            <div style={{ flex: 2, background: 'var(--fs-wine-800)', borderRadius: 12, padding: '20px 24px', color: '#fff', minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,235,217,0.5)', marginBottom: 10 }}>Chiffre d'affaires — {m.label}</div>
              <div style={{ fontSize: 38, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 12 }}>
                {fmtM(m.ca)} <span style={{ fontSize: 18 }}>XAF</span>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: parseFloat(pctVsPrev) >= 0 ? 'var(--fs-gold-300)' : '#F5A0A0' }}>
                  {parseFloat(pctVsPrev) >= 0 ? '+' : ''}{pctVsPrev} % vs {MONTHS[1]?.label?.split(' ')[0] ?? 'mois préc.'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: parseFloat(pctVsYear) >= 0 ? 'var(--fs-gold-300)' : '#F5A0A0' }}>
                  +{pctVsYear} % vs {m.label.split(' ')[1]}
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(245,235,217,0.5)' }}>
                Objectif : {fmtM(m.objectif)} XAF — {pctObjectif} %
              </div>
            </div>

            {/* Bénéfice */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 10 }}>Bénéfice net</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1, marginBottom: 6 }}>{fmtM(m.benefice)} <span style={{ fontSize: 13 }}>XAF</span></div>
              <div style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>Marge nette : <b style={{ color: 'var(--fs-success-700)' }}>{margeNette} %</b></div>
            </div>

            {/* Tickets */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fs-ink-400)', marginBottom: 10 }}>Tickets · Panier moyen</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', lineHeight: 1, marginBottom: 6 }}>{fmtN(m.tickets)} <span style={{ fontSize: 13, fontWeight: 600 }}>tickets</span></div>
              <div style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>Panier : <b style={{ color: 'var(--fs-ink-800)', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(m.panier)} XAF</b></div>
            </div>
          </div>

          {/* Bar chart */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--fs-shadow-sm)', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Ventes journalières · {m.days.length} jours</div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Pic le {m.days.indexOf(Math.max(...m.days)) + 1} · {Math.round(Math.max(...m.days) / 1000)}K XAF</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Moyenne quotidienne</div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-800)' }}>{avgDaily}K XAF</div>
              </div>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} interval={3}/>
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={36}/>
                  <Tooltip content={<BarTip/>}/>
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.isWE ? '#D1A660' : '#7A1D2E'}/>)}
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

          {/* Bottom 3 sections */}
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Catégories */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Par catégorie</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Répartition du CA mensuel</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {m.categories.map(cat => (
                  <div key={cat.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.color }}/>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{cat.name}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{fmtN(cat.amount)}</span>
                        <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginLeft: 6 }}>{cat.pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'var(--fs-line)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${cat.pct}%`, background: cat.color, borderRadius: 3 }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Classement caissiers */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Classement caissiers</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Performances individuelles · CA généré</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {m.caissiers.map((c, i) => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{MEDALS[i]}</span>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {c.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{c.ventes} ventes · panier {fmtN(c.panier)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)', flexShrink: 0 }}>
                      {fmtN(c.ca)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap */}
            <div style={{ flex: 1, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--fs-shadow-sm)', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', marginBottom: 3 }}>Affluence horaire</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 14 }}>Pic d'affluence : 11h–13h et 17h–19h</div>
              <div style={{ overflowX: 'auto' }}>
                <Heatmap/>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
