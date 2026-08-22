import React, { useEffect, useState } from 'react';
import { getEtatLicence, EtatLicence } from '../api/licence';
import { niveauAlerte, doitAlerter } from '../utils/licence';
import { t, dateLocale } from '../i18n';

/**
 * Préavis d'échéance de licence — puis avis d'expiration.
 *
 * Le préavis compte autant que le blocage : personne ne doit découvrir
 * l'échéance le jour où ses saisies sont refusées. Le bandeau apparaît à
 * J-14 et se fait plus insistant à J-7, J-3 puis J-1.
 *
 * Expirée, il explique ce qui reste possible — consulter, exporter, terminer
 * la journée — plutôt que d'annoncer une coupure qui n'a pas lieu.
 */
export default function BandeauLicence() {
  const [etat, setEtat] = useState<EtatLicence | null>(null);

  useEffect(() => { getEtatLicence().then(setEtat).catch(() => {}); }, []);

  if (!etat?.connue) return null;

  const jours = etat.joursRestants ?? 999;
  const montant = `${(etat.montant ?? 0).toLocaleString(dateLocale()).replace(/[  ]/g, ' ')} ${etat.devise ?? 'XAF'}`;
  const echeance = etat.dateEcheance ? new Date(etat.dateEcheance).toLocaleDateString(dateLocale()) : '';

  // Les seuils vivent dans utils/licence.ts, testés : ce composant ne fait
  // plus qu'habiller une décision prise ailleurs.
  if (!doitAlerter(etat.joursRestants, etat.expiree)) return null;

  const niveau = niveauAlerte(etat.joursRestants, etat.expiree);
  const styles = {
    aucun:  { fond: 'transparent', bord: 'transparent', texte: 'inherit' }, // jamais rendu
    info:   { fond: '#EFF6FF', bord: '#3B82F6', texte: '#1E3A8A' },
    proche: { fond: '#FEF3C7', bord: '#F59E0B', texte: '#7C2D12' },
    urgent: { fond: '#FFEDD5', bord: '#EA580C', texte: '#7C2D12' },
    expire: { fond: '#FEE2E2', bord: '#DC2626', texte: '#7F1D1D' },
  }[niveau];

  const message = etat.expiree
    ? t(
        `Licence expirée le ${echeance}. Vous pouvez toujours consulter vos données et sortir vos états ; les nouvelles saisies sont suspendues jusqu'au renouvellement.`,
        `Licence expired on ${echeance}. You can still view your data and export your reports; new entries are paused until renewal.`,
      )
    : jours <= 1
      ? t(`Votre licence expire demain (${echeance}).`, `Your licence expires tomorrow (${echeance}).`)
      : t(
          `Votre licence expire dans ${jours} jours, le ${echeance}.`,
          `Your licence expires in ${jours} days, on ${echeance}.`,
        );

  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: 10, marginBottom: 12,
        background: styles.fond, border: `1.5px solid ${styles.bord}`, color: styles.texte,
        fontSize: 13, fontFamily: 'var(--fs-font-sans)',
      }}
    >
      <span style={{ flex: 1, minWidth: 240 }}>
        <strong>{message}</strong>{' '}
        {t(`Renouvellement : ${montant} par an.`, `Renewal: ${montant} per year.`)}{' '}
        {t('Contactez votre revendeur pour régler.', 'Contact your reseller to pay.')}
      </span>
    </div>
  );
}
