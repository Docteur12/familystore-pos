import { authHeaders } from './http';
import { t } from '../i18n';

/** Une ligne lue sur la facture, avec la proposition d'appariement. */
export interface LigneFacture {
  designation: string;
  quantite: number;
  prixUnitaire: number | null;
  prixTotal: number | null;
  reference: string | null;
  produitId: string | null;
  produitNom: string | null;
  appariement: 'existant' | 'nouveau';
}

export interface FactureFournisseur {
  _id: string;
  nomFichier: string;
  mimeType: string;
  taille: number;
  statut: 'a_verifier' | 'validee' | 'rejetee';
  fournisseur: string;
  numeroFacture: string;
  dateFacture: string;
  total: number | null;
  confiance: 'haute' | 'moyenne' | 'basse';
  remarques: string;
  lignes: LigneFacture[];
  extracteur: string;
  receptionId: string | null;
  motifRejet: string;
  createdAt: string;
  valideeLe: string | null;
}

/** Ce que l'écran de contrôle renvoie pour chaque ligne. */
export interface LigneValidee {
  designation: string;
  quantite: number;
  prixUnitaire?: number | null;
  produitId?: string | null;
  creer?: { name?: string; price?: number; category?: string; subCategory?: string; unit?: string } | null;
  ignorer?: boolean;
}

export interface ResultatValidation {
  facture: FactureFournisseur;
  receptionId: string | null;
  produitsCrees: number;
  articlesRecus: number;
}

const BASE = '/api/factures-fournisseurs';

async function lire<T>(res: Response, erreur: string): Promise<T> {
  if (res.ok) return res.json();
  const corps = await res.json().catch(() => ({}));
  throw new Error(corps.message || erreur);
}

/** Lit le fichier choisi (photo/PDF) et l'envoie à la lecture automatique. */
export async function importerFacture(fichier: File): Promise<FactureFournisseur> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error(t('Lecture du fichier impossible', 'Could not read the file')));
    fr.readAsDataURL(fichier);
  });
  const fichierBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const res = await fetch(BASE, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fichierBase64, mimeType: fichier.type || 'image/jpeg', nomFichier: fichier.name }),
  });
  return lire(res, t('Échec de la lecture de la facture', 'Invoice reading failed'));
}

export async function getFactures(statut?: string): Promise<FactureFournisseur[]> {
  const res = await fetch(`${BASE}${statut ? `?statut=${statut}` : ''}`, { headers: authHeaders() });
  return lire(res, t('Erreur chargement des factures', 'Error loading invoices'));
}

export async function validerFacture(id: string, corps: {
  fournisseur?: string; numeroFacture?: string; lignes: LigneValidee[]; mettreAJourPrixAchat?: boolean;
}): Promise<ResultatValidation> {
  const res = await fetch(`${BASE}/${id}/valider`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
  });
  return lire(res, t('Échec de la validation', 'Validation failed'));
}

export async function rejeterFacture(id: string, motif: string): Promise<FactureFournisseur> {
  const res = await fetch(`${BASE}/${id}/rejeter`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ motif }),
  });
  return lire(res, t('Échec du rejet', 'Rejection failed'));
}

/** Ouvre le justificatif archivé dans un nouvel onglet (la route exige le jeton). */
export async function ouvrirJustificatif(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/fichier`, { headers: authHeaders() });
  if (!res.ok) throw new Error(t('Justificatif indisponible', 'Attachment unavailable'));
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
