import { authHeaders } from './http';

export interface EtatLicence {
  connue: boolean;
  expiree?: boolean;
  dateEcheance?: string;
  joursRestants?: number;
  montant?: number;
  devise?: string;
  /** Numéro du revendeur à appeler pour renouveler (mode manuel). */
  contact?: string;
  /** Un paiement en ligne est-il proposé ? Faux en mode manuel : on n'affiche alors aucun bouton « payer ». */
  paiementEnLigne?: boolean;
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
