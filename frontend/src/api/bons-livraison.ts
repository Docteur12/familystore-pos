import { authHeaders } from './http';
import { t } from '../i18n';

export interface BLLigne {
  productId:      string;
  productName:    string;
  unit:           string;
  qteAttendue:    number;
  qteRecue:       number;
  datePeremption: string;
  etatEmballage:  string;
}

export interface BonLivraisonRecord {
  _id:         string;
  numeroBL:    string;
  fournisseur: string;
  date:        string;
  lignes:      BLLigne[];
  totalEcarts: number;
  creePar:     { _id: string; name: string; role: string } | null;
  createdAt:   string;
}

export interface BonLivraisonInput {
  numeroBL?:   string;
  fournisseur: string;
  date?:       string;
  lignes: {
    productId:      string;
    qteAttendue?:   number;
    qteRecue:       number;
    datePeremption?: string;
    etatEmballage?:  string;
  }[];
}

export async function getBonsLivraison(): Promise<BonLivraisonRecord[]> {
  const res = await fetch('/api/bons-livraison', { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Erreur chargement bons de livraison', 'Failed to load delivery notes'));
  return res.json();
}

export async function createBonLivraison(data: BonLivraisonInput): Promise<BonLivraisonRecord> {
  const res = await fetch('/api/bons-livraison', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t('Erreur enregistrement BL', 'Failed to save delivery note'));
  return res.json();
}
