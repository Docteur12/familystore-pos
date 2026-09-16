import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { logoAffiche } from '../config/logo-marque';

/**
 * Logo du magasin, réutilisable dans tous les espaces (caisse, stock,
 * magasinier, partenaires) et à la connexion. Affiche le logo personnalisé
 * (Paramètres → Logo du magasin), sinon le logo de marque du build, sinon le
 * NOM du magasin en toutes lettres — jamais l'image d'un autre commerçant
 * (incident HERVAN du 16/09/2026, voir config/logo-marque.ts).
 */
export default function StoreLogo({ width = 132, showLabel, label }: {
  width?: number;
  showLabel?: boolean;
  label?: string;
}) {
  const { settings } = useSettings();
  const src = logoAffiche(settings.logoUrl);
  const nom = (settings.nomMagasin || '').trim();
  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{ background: '#fdf9f0', borderRadius: 10, border: '1px solid var(--fs-gold-400)', padding: '6px 8px', overflow: 'hidden', width }}>
        {src ? (
          <img src={src} alt={nom} style={{ width: '100%', display: 'block', borderRadius: 6 }}/>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: Math.round(width * 0.42), padding: '6px 4px',
            fontFamily: 'var(--fs-font-display)', fontWeight: 700,
            fontSize: Math.max(12, Math.round(width * 0.13)), lineHeight: 1.15,
            color: 'var(--fs-wine-700)', textAlign: 'center', wordBreak: 'break-word',
          }}>
            {nom}
          </div>
        )}
      </div>
      {showLabel && (
        <div style={{ fontSize: 9, color: 'var(--fs-gold-400)', letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginTop: 6 }}>
          {label}
        </div>
      )}
    </div>
  );
}
