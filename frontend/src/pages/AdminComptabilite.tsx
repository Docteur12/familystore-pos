import React, { useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';

const fmtN = (n: number) => n.toLocaleString('fr-FR');
const TVA_RATE = 0.1925;

const MONTHS = ['Avril 2026','Mars 2026','Février 2026','Janvier 2026'];

const DATA = [
  { ca: 14_820_000, achats: 8_200_000, chargesFixe: 980_000, chargesVar: 320_000 },
  { ca: 12_520_000, achats: 6_900_000, chargesFixe: 980_000, chargesVar: 280_000 },
  { ca: 10_980_000, achats: 6_100_000, chargesFixe: 980_000, chargesVar: 250_000 },
  { ca: 11_340_000, achats: 6_300_000, chargesFixe: 980_000, chargesVar: 260_000 },
];

function Row({ label, value, bold, accent, sub, indent }: { label: string; value: number; bold?: boolean; accent?: 'pos' | 'neg'; sub?: string; indent?: boolean }) {
  const color = accent === 'pos' ? 'var(--fs-success-700)' : accent === 'neg' ? 'var(--fs-danger-700)' : 'var(--fs-ink-800)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--fs-line)' }}>
      <div style={{ paddingLeft: indent ? 16 : 0 }}>
        <div style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: bold ? 'var(--fs-ink-900)' : 'var(--fs-ink-700)' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: bold ? 16 : 13, fontWeight: bold ? 800 : 600, fontFamily: 'var(--fs-font-mono)', color }}>{fmtN(value)} XAF</div>
        {sub && value > 0 && <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 1 }}>{((value / (DATA[0].ca)) * 100).toFixed(1)}%</div>}
      </div>
    </div>
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

export default function AdminComptabilite() {
  const [monthIdx, setMonthIdx] = useState(0);
  const d = DATA[monthIdx];

  const tvaCollectee  = Math.round(d.ca * TVA_RATE / (1 + TVA_RATE));
  const tvaDeductible = Math.round(d.achats * TVA_RATE / (1 + TVA_RATE));
  const tvaDue        = tvaCollectee - tvaDeductible;
  const margesBrute   = d.ca - d.achats;
  const totalCharges  = d.chargesFixe + d.chargesVar;
  const beneficeNet   = margesBrute - totalCharges;
  const margePct      = ((beneficeNet / d.ca) * 100).toFixed(1);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Pilotage</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Comptabilité — {MONTHS[monthIdx]}</h1>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setMonthIdx(i)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: monthIdx === i ? 'var(--fs-wine-700)' : 'var(--fs-ivory)', color: monthIdx === i ? '#fff' : 'var(--fs-ink-500)' }}>
                  {m.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Compte de résultat */}
            <div>
              <Card title="Compte de résultat">
                <Row label="Chiffre d'affaires" value={d.ca} bold/>
                <Row label="Coût des marchandises vendues" value={-d.achats} accent="neg" indent sub="Prix d'achat des produits vendus"/>
                <Row label="Marge brute" value={margesBrute} bold accent="pos"/>
                <Row label="Charges fixes" value={-d.chargesFixe} accent="neg" indent sub="Loyer, salaires, abonnements"/>
                <Row label="Charges variables" value={-d.chargesVar} accent="neg" indent sub="Emballages, transports"/>
                <Row label="Total charges" value={-totalCharges} bold accent="neg"/>
                <div style={{ marginTop: 8, background: beneficeNet > 0 ? 'var(--fs-success-100)' : 'var(--fs-danger-100)', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: beneficeNet > 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' }}>Bénéfice net</div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: beneficeNet > 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' }}>{fmtN(beneficeNet)} XAF</div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', textAlign: 'right' }}>Marge nette : {margePct}%</div>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              {/* TVA */}
              <Card title="TVA (Taux 19,25%)">
                <Row label="TVA collectée" value={tvaCollectee} sub="Sur les ventes HT"/>
                <Row label="TVA déductible" value={-tvaDeductible} accent="neg" sub="Sur les achats HT"/>
                <div style={{ marginTop: 8, background: 'var(--fs-wine-50)', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-wine-700)' }}>TVA à reverser</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(tvaDue)} XAF</div>
                </div>
              </Card>

              {/* Synthèse */}
              <Card title="Synthèse financière">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'CA HT',       value: Math.round(d.ca / (1 + TVA_RATE)), color: 'var(--fs-ink-800)' },
                    { label: 'CA TTC',      value: d.ca,         color: 'var(--fs-ink-800)' },
                    { label: 'Marge brute', value: margesBrute,  color: 'var(--fs-success-700)' },
                    { label: 'Bénéfice net',value: beneficeNet,  color: beneficeNet > 0 ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'var(--fs-ivory)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: item.color }}>{fmtN(item.value)}</div>
                      <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>XAF</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
