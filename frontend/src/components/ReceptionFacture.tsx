import React, { useState } from 'react';
import { FactureFournisseur, recevoirFacture } from '../api/facturesFournisseurs';
import { displayName } from '../utils/text';
import { t, dateLocale } from '../i18n';

/**
 * Confirmation de l'ARRIVÉE d'une facture validée — le second temps du flux.
 *
 * Décision HERVAN (16/09/2026) : le patron achète à l'étranger et valide la
 * facture depuis son téléphone ; la marchandise, elle, arrive des jours plus
 * tard. Rien n'entre en stock à la validation. C'est le magasinier qui, colis
 * ouvert, confirme ce qui est réellement arrivé — quantité par quantité — et
 * c'est cette confirmation qui crée la réception (stock entrepôt, mouvements).
 *
 * Une quantité à 0 = ligne non livrée, elle n'entre pas. Une quantité
 * inférieure à la facture = livraison partielle, tracée dans la note.
 */
export default function ReceptionFacture({ facture, onDone, compact }: { facture: FactureFournisseur; onDone: (f: FactureFournisseur) => void; compact?: boolean }) {
  const [quantites, setQuantites] = useState<string[]>(() => facture.lignes.map(l => String(l.quantite ?? 0)));
  const [note, setNote] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');

  const total = quantites.reduce((s, q) => s + (Number(q) || 0), 0);
  const attendu = facture.lignes.reduce((s, l) => s + (l.quantite ?? 0), 0);

  const confirmer = async () => {
    setErreur('');
    if (total <= 0) { setErreur(t('Aucune quantité reçue : indiquez ce qui est arrivé.', 'No quantity received: enter what arrived.')); return; }
    setOccupe(true);
    try {
      const r = await recevoirFacture(facture._id, {
        lignes: facture.lignes.map((l, i) => ({ produitId: l.produitId, quantiteRecue: Math.max(0, Number(quantites[i]) || 0) })),
        note: note.trim() || undefined,
      });
      onDone(r.facture);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : t('Échec de la réception', 'Receipt failed'));
    } finally { setOccupe(false); }
  };

  const champ: React.CSSProperties = { border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: 'var(--fs-font-mono)', background: '#fff', width: 90, textAlign: 'right' };

  return (
    <div data-reception-facture style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12, padding: compact ? 12 : 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#166534', marginBottom: 4 }}>
        {t('Livraison attendue', 'Expected delivery')} — {facture.fournisseur || t('fournisseur non précisé', 'unspecified supplier')}
        {facture.numeroFacture ? ` · n° ${facture.numeroFacture}` : ''}
      </div>
      <div style={{ fontSize: 11, color: '#166534', marginBottom: 10 }}>
        {t('Validée le', 'Validated on')} {facture.valideeLe ? new Date(facture.valideeLe).toLocaleDateString(dateLocale()) : '—'} · {attendu} {t('article(s) attendu(s)', 'item(s) expected')}.{' '}
        {t('Comptez ce qui est arrivé, corrigez les quantités, puis confirmez : c’est cette confirmation qui fait entrer le stock en entrepôt.', 'Count what arrived, correct the quantities, then confirm: this confirmation is what puts the stock into the warehouse.')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {facture.lignes.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(l.produitNom || l.designation)}</div>
              <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{t('Facturé', 'Invoiced')} : {l.quantite}</div>
            </div>
            <label style={{ fontSize: 11, color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('Reçu', 'Received')}
              <input type="number" min={0} inputMode="numeric" value={quantites[i]} onChange={e => setQuantites(q => q.map((v, k) => k === i ? e.target.value : v))} style={champ}/>
            </label>
          </div>
        ))}
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('Note (colis abîmé, manquant, bon de livraison n°…)', 'Note (damaged parcel, missing, delivery note no.…)')}
        style={{ marginTop: 10, width: '100%', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'var(--fs-font-sans)', background: '#fff' }}/>
      {erreur && <div style={{ marginTop: 8, fontSize: 12, color: '#991B1B', fontWeight: 600 }}>{erreur}</div>}
      <button onClick={confirmer} disabled={occupe} style={{ marginTop: 10, width: '100%', padding: '13px 16px', border: 'none', borderRadius: 8, background: '#1D7A4E', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)', opacity: occupe ? 0.6 : 1 }}>
        {occupe ? t('Enregistrement…', 'Saving…') : t(`✓ Confirmer la réception (${total} article(s)) → stock entrepôt`, `✓ Confirm receipt (${total} item(s)) → warehouse stock`)}
      </button>
    </div>
  );
}
