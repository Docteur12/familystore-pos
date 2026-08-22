import { authHeaders } from './http';

export interface EtatLicence {
  connue: boolean;
  expiree?: boolean;
  dateEcheance?: string;
  joursRestants?: number;
  montant?: number;
  devise?: string;
}

/** État de licence de la boutique consultée. `connue: false` = rien à signaler. */
export async function getEtatLicence(): Promise<EtatLicence> {
  try {
    const res = await fetch('/api/licence/etat', { headers: authHeaders() });
    if (!res.ok) return { connue: false };
    return res.json();
  } catch {
    return { connue: false };   // hors connexion : ne pas alarmer à tort
  }
}
