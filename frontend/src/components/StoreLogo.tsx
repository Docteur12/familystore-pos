import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import logoFs from '../assets/logo-fs.jpg';

/**
 * Logo du magasin, réutilisable dans tous les espaces (caisse, stock,
 * magasinier, partenaires) et à la connexion. Affiche le logo personnalisé
 * (Paramètres → Logo du magasin) et retombe sur le logo Family Store par défaut.
 */
export default function StoreLogo({ width = 132, showLabel, label }: {
  width?: number;
  showLabel?: boolean;
  label?: string;
}) {
  const { settings } = useSettings();
  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{ background: '#fdf9f0', borderRadius: 10, border: '1px solid var(--fs-gold-400)', padding: '6px 8px', overflow: 'hidden', width }}>
        <img src={settings.logoUrl || logoFs} alt={settings.nomMagasin || 'Family Store'} style={{ width: '100%', display: 'block', borderRadius: 6 }}/>
      </div>
      {showLabel && (
        <div style={{ fontSize: 9, color: 'var(--fs-gold-400)', letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginTop: 6 }}>
          {label}
        </div>
      )}
    </div>
  );
}
