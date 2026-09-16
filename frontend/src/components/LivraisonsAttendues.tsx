import React, { useEffect, useState } from 'react';
import { FactureFournisseur, getFactures } from '../api/facturesFournisseurs';
import { useSettings } from '../contexts/SettingsContext';
import ReceptionFacture from './ReceptionFacture';
import { t } from '../i18n';

/**
 * Les factures VALIDÉES par le patron dont la marchandise n'est pas encore
 * arrivée — affichées au magasinier, au-dessus de sa saisie manuelle de
 * réception. Il confirme l'arrivée colis par colis (voir ReceptionFacture).
 *
 * Ne s'affiche que si le module « factures-fournisseurs » est actif pour le
 * magasin, et seulement s'il y a quelque chose à recevoir.
 */
export default function LivraisonsAttendues({ onRecu }: { onRecu?: (f: FactureFournisseur) => void }) {
  const { hasModule } = useSettings();
  const actif = hasModule('factures-fournisseurs');
  const [attendues, setAttendues] = useState<FactureFournisseur[]>([]);

  const charger = async () => {
    try { setAttendues((await getFactures('validee')).filter(f => f.statut === 'validee')); }
    catch { /* hors module ou hors ligne : rien à afficher */ }
  };
  useEffect(() => { if (actif) charger(); }, [actif]);

  if (!actif || attendues.length === 0) return null;
  return (
    <div data-livraisons-attendues style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#166534', marginBottom: 8 }}>
        {t('Livraisons attendues', 'Expected deliveries')} ({attendues.length}) — {t('factures validées par la direction', 'invoices validated by management')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {attendues.map(f => (
          <ReceptionFacture key={f._id} facture={f} compact onDone={r => { setAttendues(a => a.filter(x => x._id !== f._id)); onRecu?.(r); }}/>
        ))}
      </div>
    </div>
  );
}
