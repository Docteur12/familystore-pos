import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Injectable, Logger } from '@nestjs/common';
import { ExtracteurFacture, ExtractionFacture, ExtractionFactureSchema } from './extracteur';

/**
 * Lecture d'une facture par Claude (API Anthropic) — le moteur réel.
 *
 * Pourquoi un modèle de langage et pas un OCR classique : une facture de
 * fournisseur camerounais est souvent une photo prise au téléphone, froissée,
 * manuscrite en partie, avec des colonnes qui ne s'alignent pas. Un OCR
 * rendrait du texte en vrac ; ici on obtient directement la STRUCTURE
 * (fournisseur, numéro, lignes, quantités, prix) avec une auto-évaluation de
 * la lisibilité — l'écran de contrôle s'appuie dessus.
 *
 * Le document part en base64 dans la requête : PDF → bloc `document`,
 * photo → bloc `image`. La sortie est contrainte par le schéma zod
 * (`output_config.format`) : ce qui revient est déjà validé.
 *
 * Réglages par variables d'environnement du service :
 *   ANTHROPIC_API_KEY   — obligatoire ;
 *   FACTURE_OCR_MODEL   — défaut claude-opus-5.
 */
@Injectable()
export class ExtracteurClaude implements ExtracteurFacture {
  readonly nom = 'claude' as const;
  private readonly logger = new Logger(ExtracteurClaude.name);
  private readonly modele = (process.env.FACTURE_OCR_MODEL ?? 'claude-opus-5').trim();
  // Client créé au premier usage : la clé (ANTHROPIC_API_KEY) n'est exigée
  // qu'au moment de lire une facture, pas au démarrage du module.
  private _client?: Anthropic;
  private get client(): Anthropic { return (this._client ??= new Anthropic()); }

  private static readonly CONSIGNE = [
    'Tu lis des factures et bons de livraison de FOURNISSEURS pour une boutique de détail au Cameroun.',
    'Extrais fidèlement ce qui est écrit : ne devine pas un prix ou une quantité absents (mets null),',
    'ne corrige pas les totaux, signale les zones illisibles dans « remarques ».',
    'Une ligne = un produit facturé. Garde le libellé tel qu’imprimé (marque, format, contenance).',
    'Les montants sont en francs CFA sauf mention contraire ; écris les nombres sans séparateurs.',
    '« confiance » : haute si tout est net, moyenne si quelques doutes, basse si une partie est illisible.',
  ].join(' ');

  async extraire(fichier: Buffer, mimeType: string): Promise<ExtractionFacture> {
    // Message clair plutôt qu'une erreur brute du SDK : sur un magasin où le
    // module n'est pas branché (pas de clé), l'utilisateur doit comprendre.
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      throw new Error('Lecture automatique non activée pour ce magasin (clé API absente sur le serveur).');
    }
    const data = fichier.toString('base64');
    const piece: Anthropic.ContentBlockParam = mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data } };

    const debut = Date.now();
    // Le schéma est passé au helper sans inférence de type (`as any`) : sous
    // ts-jest, l'instanciation générique zod v4 × SDK explose (« excessively
    // deep »). La forme reste IMPOSÉE côté API par output_config.format, et la
    // réponse est re-validée ici par le même schéma — c'est cette validation
    // qui type le résultat, pas l'inférence du helper.
    const reponse = await this.client.messages.parse({
      model: this.modele,
      max_tokens: 16000,
      system: ExtracteurClaude.CONSIGNE,
      messages: [{
        role: 'user',
        content: [piece, { type: 'text', text: 'Extrais les données de cette facture fournisseur.' }],
      }],
      output_config: { format: zodOutputFormat(ExtractionFactureSchema as any) },
    });

    if (reponse.stop_reason === 'refusal') {
      throw new Error('Lecture refusée par le modèle — document non exploitable ou contenu inattendu.');
    }
    const validation = ExtractionFactureSchema.safeParse(reponse.parsed_output);
    if (!validation.success) {
      throw new Error('Lecture incomplète : la réponse ne respecte pas le format attendu. Réessayez avec une photo plus nette.');
    }
    const extraction: ExtractionFacture = validation.data;
    this.logger.log(`[OCR] ${mimeType} ${Math.round(fichier.length / 1024)} Ko → ${extraction.lignes.length} ligne(s), confiance ${extraction.confiance}, ${Date.now() - debut} ms, ${reponse.usage.input_tokens}+${reponse.usage.output_tokens} jetons`);
    return extraction;
  }
}
