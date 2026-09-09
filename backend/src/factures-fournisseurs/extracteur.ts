// zod/v4 : le helper zodOutputFormat du SDK Anthropic est écrit pour l'API v4
// (la 3.25 installée expose les deux ; le sous-chemin évite une seconde dépendance).
import { z } from 'zod/v4';

/**
 * Extraction d'une facture fournisseur — le CONTRAT, indépendant du moteur.
 *
 * Le moteur réel lit une photo ou un PDF et en tire des données structurées.
 * Il est cher, lent, et exige une clé d'API : les tests et le développement
 * passent par un extracteur simulé. Comme pour les paiements, le simulé est
 * INTERDIT en production — une facture « lue » par un simulateur créerait du
 * stock fictif sans que personne ne le voie.
 */

export const LigneExtraiteSchema = z.object({
  designation:  z.string().describe('Libellé du produit tel qu’écrit sur la facture'),
  quantite:     z.number().describe('Quantité livrée/facturée'),
  prixUnitaire: z.number().nullable().describe('Prix unitaire HT ou TTC tel que lu, null si absent'),
  prixTotal:    z.number().nullable().describe('Montant de la ligne, null si absent'),
  reference:    z.string().nullable().describe('Référence ou code-barres du produit si imprimé, sinon null'),
});

export const ExtractionFactureSchema = z.object({
  fournisseur:   z.string().nullable().describe('Nom du fournisseur / émetteur de la facture'),
  numeroFacture: z.string().nullable().describe('Numéro de la facture'),
  dateFacture:   z.string().nullable().describe('Date de la facture au format AAAA-MM-JJ si lisible'),
  devise:        z.string().nullable().describe('Devise si indiquée (XAF, FCFA, EUR…)'),
  total:         z.number().nullable().describe('Total général de la facture'),
  lignes:        z.array(LigneExtraiteSchema).describe('Une entrée par ligne de produit'),
  confiance:     z.enum(['haute', 'moyenne', 'basse']).describe('Lisibilité globale du document'),
  remarques:     z.string().nullable().describe('Doutes, zones illisibles, incohérences de totaux'),
});

export type LigneExtraite = z.infer<typeof LigneExtraiteSchema>;
export type ExtractionFacture = z.infer<typeof ExtractionFactureSchema>;

export interface ExtracteurFacture {
  readonly nom: 'claude' | 'simule';
  extraire(fichier: Buffer, mimeType: string): Promise<ExtractionFacture>;
}

export const EXTRACTEUR_FACTURE = Symbol('EXTRACTEUR_FACTURE');

/** Types de fichiers acceptés à l'import. */
export const MIMES_ACCEPTES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;   // 8 Mo — la limite JSON du serveur est à 10 Mo

// ── Choix du moteur, et verrou ─────────────────────────────────────────────

export type NomExtracteur = 'claude' | 'simule';

export class ExtracteurSimuleInterditError extends Error {
  constructor() {
    super(
      'FACTURE_OCR_FOURNISSEUR=simule est INTERDIT en production : des factures ' +
      '« lues » par un simulateur créeraient du stock fictif. Retirez la variable ' +
      'ou mettez-la à « claude » (avec ANTHROPIC_API_KEY).',
    );
    this.name = 'ExtracteurSimuleInterditError';
  }
}

export function nomExtracteurDemande(env: NodeJS.ProcessEnv = process.env): NomExtracteur {
  return (env.FACTURE_OCR_FOURNISSEUR ?? '').trim().toLowerCase() === 'simule' ? 'simule' : 'claude';
}

/** Même prudence que pour les paiements : en cas de doute, on est en production. */
export function estProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'test') return false;
  if (env.NODE_ENV === 'production') return true;
  if (env.NODE_ENV === 'development') return false;
  return /mongodb(\+srv)?:\/\/[^/]*\/(familystore|radiance|hervan)(\?|$)/i.test(env.MONGO_URI ?? '');
}

export function choisirExtracteur(
  disponibles: { claude?: ExtracteurFacture; simule: ExtracteurFacture },
  env: NodeJS.ProcessEnv = process.env,
): ExtracteurFacture {
  if (nomExtracteurDemande(env) === 'simule') {
    if (estProduction(env)) throw new ExtracteurSimuleInterditError();
    return disponibles.simule;
  }
  if (!disponibles.claude) {
    throw new Error(
      'FACTURE_OCR_FOURNISSEUR=claude mais aucun extracteur Claude n’est enregistré. ' +
      'Pour développer sans clé d’API, poser FACTURE_OCR_FOURNISSEUR=simule (refusé en production).',
    );
  }
  return disponibles.claude;
}
