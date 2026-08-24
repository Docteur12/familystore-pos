import React from 'react';
import { nomEnseigne, COULEUR_MARQUE } from '../config/marque';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Logo du magasin, réutilisable dans tous les espaces (caisse, stock,
 * magasinier, partenaires).
 *
 * REPLI : le nom de l'enseigne en toutes lettres, PAS l'image d'un autre
 * commerçant. Il retombait sur `logo-fs.jpg` — une boutique neuve, tant que
 * son patron n'avait pas téléversé son logo, arborait donc l'enseigne
 * Family Store dans son propre menu, sur tous les écrans. Un cadre au nom du
 * magasin dit la vérité : « pas encore de logo ».
 */
export default function StoreLogo({ width = 132, showLabel, label }: {
  width?: number;
  showLabel?: boolean;
  label?: string;
}) {
  const { settings } = useSettings();
  const nom = nomEnseigne(settings.nomMagasin);
  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{ background: '#fdf9f0', borderRadius: 10, border: '1px solid var(--fs-gold-400)', padding: '6px 8px', overflow: 'hidden', width }}>
        {settings.logoUrl ? (
          <img src={settings.logoUrl} alt={nom} style={{ width: '100%', display: 'block', borderRadius: 6 }}/>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: Math.round(width * 0.42), padding: '6px 4px',
            fontFamily: 'var(--fs-font-display)', fontWeight: 700,
            fontSize: Math.max(12, Math.round(width * 0.13)), lineHeight: 1.15,
            color: COULEUR_MARQUE, textAlign: 'center', wordBreak: 'break-word',
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
