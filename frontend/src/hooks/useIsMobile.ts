import { useEffect, useState } from 'react';

/**
 * Retourne true si la largeur de l'écran est inférieure à `breakpoint` (défaut 768px).
 * Met à jour automatiquement au redimensionnement.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);

  return isMobile;
}
