import { authHeaders } from './http';

export interface FacturePayload {
  numero:        string;
  caissier:      string;
  montant:       number;
  paymentMethod: string;
  items:         { name: string; quantity: number; unitPrice: number }[];
  pdfBase64:     string;
  date?:         string;
}

export interface FactureRecord extends FacturePayload {
  _id:       string;
  createdAt: string;
}

export async function saveFacture(payload: FacturePayload): Promise<void> {
  try {
    await fetch('/api/factures', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  } catch { /* silently ignore — ne doit pas bloquer l'impression */ }
}

export async function getFactures(params: {
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
} = {}): Promise<{ data: FactureRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo)   qs.set('dateTo',   params.dateTo);
  if (params.page !== undefined) qs.set('page',  String(params.page));
  if (params.limit)    qs.set('limit', String(params.limit));

  const res = await fetch(`/api/factures?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erreur chargement factures');
  return res.json();
}

export async function getFacture(id: string): Promise<FactureRecord> {
  const res = await fetch(`/api/factures/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Facture introuvable');
  return res.json();
}

export async function deleteFacture(id: string): Promise<void> {
  const res = await fetch(`/api/factures/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (res.status === 403) throw new Error('Suppression réservée à l\'administrateur');
  if (!res.ok) throw new Error('Erreur suppression de la facture');
}
