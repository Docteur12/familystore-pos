import { authHeaders } from './http';

export interface DepenseCategorie {
  category: string;
  total:    number;
  count:    number;
}

export interface VentePaiement {
  mode:  string;
  total: number;
}

export interface ComptaMonth {
  year:                 number;
  month:                number;
  label:                string;
  nbVentes:             number;
  ca:                   number;
  coutAchats:           number;
  depenses:             number;
  depensesParCategorie: DepenseCategorie[];
  ventesParPaiement:    VentePaiement[];
  margesBrute:          number;
  beneficeNet:          number;
}

export async function getComptaMonth(year: number, month: number): Promise<ComptaMonth> {
  const res = await fetch(`/api/reports/compta?year=${year}&month=${month}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Erreur chargement comptabilité');
  return res.json();
}
