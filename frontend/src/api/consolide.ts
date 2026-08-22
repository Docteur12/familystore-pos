import { authHeaders } from './http';
import { t } from '../i18n';

/** Une boutique du périmètre du propriétaire. */
export interface BoutiqueProprietaire {
  boutiqueId: string;
  nom: string;
}

export interface LigneConsolidee extends BoutiqueProprietaire {
  ca: number;
  ventes: number;
  panierMoyen: number;
}

export interface RapportConsolide {
  debut: string;
  fin: string;
  boutiques: LigneConsolidee[];
  total: { ca: number; ventes: number; panierMoyen: number };
}

/**
 * Boutiques du propriétaire. Le périmètre est borné côté serveur par la liste
 * signée dans le jeton : rien de ce qu'envoie le client ne peut l'élargir.
 */
export async function getBoutiquesProprietaire(): Promise<BoutiqueProprietaire[]> {
  const res = await fetch('/api/consolide/boutiques', { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function getRapportConsolide(debut?: string, fin?: string): Promise<RapportConsolide> {
  const params = new URLSearchParams();
  if (debut) params.set('debut', debut);
  if (fin)   params.set('fin', fin);
  const res = await fetch(`/api/consolide/rapport?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement du rapport consolidé', 'Error loading the consolidated report'));
  return res.json();
}

/** Bascule vers une autre boutique — le serveur n'accepte que la liste signée. */
export async function basculerBoutique(tenantId: string): Promise<string> {
  const res = await fetch('/api/auth/basculer', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tenantId }),
  });
  if (!res.ok) throw new Error(t('Bascule impossible vers cette boutique', 'Cannot switch to this store'));
  return (await res.json()).access_token as string;
}
