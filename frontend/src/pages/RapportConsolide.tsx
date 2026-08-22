import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { getRapportConsolide, RapportConsolide as Rapport } from '../api/consolide';
import { getTokenPayload } from '../api/dashboard';
import { localISODate } from '../utils/dates';
import { t, dateLocale } from '../i18n';

/**
 * Rapport consolidé — plusieurs boutiques cumulées.
 *
 * Volontairement DIFFÉRENT d'un rapport de boutique : fond sombre, mention
 * « cumulé » répétée, et la liste nominative des boutiques incluses affichée
 * au-dessus des chiffres. Un patron qui lit « 1 200 000 » doit savoir sans
 * hésiter s'il regarde Bonamoussadi ou ses trois boutiques ensemble.
 *
 * Lecture seule : cette page n'expose aucune action d'écriture.
 */
export default function RapportConsolide() {
  const payload = getTokenPayload();
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [debut, setDebut] = useState(() => {
    const d = new Date(); d.setDate(1);
    return localISODate(d);
  });
  const [fin, setFin] = useState(() => localISODate(new Date()));

  const charger = useCallback(() => {
    setErreur(null);
    getRapportConsolide(debut, fin).then(setRapport).catch(e => setErreur(e.message));
  }, [debut, fin]);

  useEffect(() => { charger(); }, [charger]);

  const fmt = (n: number) => Math.round(n).toLocaleString(dateLocale()).replace(/[  ]/g, ' ');
  const nbBoutiques = payload?.boutiques?.length ?? 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--fs-ivory)' }}>
      <AdminSidebar />
      <div style={{ flex: 1, padding: '20px 24px', minWidth: 0 }}>

        {/* En-tête sombre : signature visuelle du consolidé */}
        <div style={{
          background: 'var(--fs-wine-900)', color: '#fff', borderRadius: 14,
          padding: '20px 24px', marginBottom: 18,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--fs-gold-400)', marginBottom: 6,
          }}>
            {t('Vue cumulée — plusieurs boutiques', 'Consolidated view — several stores')}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: 'var(--fs-font-display)' }}>
            {t('Rapport consolidé', 'Consolidated report')}
          </h1>

          {/* Les boutiques incluses, nommées */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(rapport?.boutiques ?? []).map(b => (
              <span key={b.boutiqueId} style={{
                padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              }}>
                {b.nom}
              </span>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {t(
              `Les montants ci-dessous additionnent ${rapport?.boutiques.length ?? nbBoutiques} boutique(s).`,
              `The amounts below add up ${rapport?.boutiques.length ?? nbBoutiques} store(s).`,
            )}
          </p>
        </div>

        {/* Période */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
            {t('Du', 'From')}<br/>
            <input type="date" value={debut} onChange={e => setDebut(e.target.value)}
              style={{ padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13 }}/>
          </label>
          <label style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
            {t('Au', 'To')}<br/>
            <input type="date" value={fin} onChange={e => setFin(e.target.value)}
              style={{ padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13 }}/>
          </label>
        </div>

        {erreur && (
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', fontSize: 13 }}>
            {erreur}
          </div>
        )}

        {rapport && (
          <>
            {/* Total cumulé — libellé sans ambiguïté */}
            <div style={{
              background: '#fff', border: '2px solid var(--fs-wine-700)', borderRadius: 12,
              padding: '18px 22px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fs-wine-700)' }}>
                {t('Total cumulé — toutes boutiques ci-dessus', 'Grand total — all stores listed above')}
              </div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 10 }}>
                <Chiffre libelle={t('Chiffre d’affaires', 'Revenue')} valeur={`${fmt(rapport.total.ca)} XAF`} fort/>
                <Chiffre libelle={t('Ventes', 'Sales')} valeur={fmt(rapport.total.ventes)}/>
                <Chiffre libelle={t('Panier moyen', 'Average basket')} valeur={`${fmt(rapport.total.panierMoyen)} XAF`}/>
              </div>
            </div>

            {/* Détail par boutique */}
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--fs-line)', fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-600)' }}>
                {t('Détail par boutique', 'Breakdown by store')}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 18px' }}>{t('Boutique', 'Store')}</th>
                    <th style={{ padding: '10px 18px', textAlign: 'right' }}>{t('Chiffre d’affaires', 'Revenue')}</th>
                    <th style={{ padding: '10px 18px', textAlign: 'right' }}>{t('Ventes', 'Sales')}</th>
                    <th style={{ padding: '10px 18px', textAlign: 'right' }}>{t('Panier moyen', 'Average basket')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.boutiques.map(b => (
                    <tr key={b.boutiqueId} style={{ borderTop: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px 18px', fontWeight: 600 }}>{b.nom}</td>
                      <td style={{ padding: '10px 18px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmt(b.ca)}</td>
                      <td style={{ padding: '10px 18px', textAlign: 'right' }}>{fmt(b.ventes)}</td>
                      <td style={{ padding: '10px 18px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmt(b.panierMoyen)}</td>
                    </tr>
                  ))}
                  {rapport.boutiques.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 18, color: 'var(--fs-ink-400)' }}>
                      {t('Aucune boutique dans votre périmètre.', 'No store in your scope.')}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Chiffre({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{libelle}</div>
      <div style={{
        fontSize: fort ? 26 : 18, fontWeight: 800,
        color: fort ? 'var(--fs-wine-700)' : 'var(--fs-ink-900)',
        fontFamily: 'var(--fs-font-mono)',
      }}>
        {valeur}
      </div>
    </div>
  );
}
