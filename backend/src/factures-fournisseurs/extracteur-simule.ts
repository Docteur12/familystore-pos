import { Injectable } from '@nestjs/common';
import { ExtracteurFacture, ExtractionFacture, ExtractionFactureSchema } from './extracteur';

/**
 * Extracteur SIMULÉ — développement et tests, refusé en production.
 *
 * Deux comportements :
 *  - si le « fichier » est un JSON conforme au schéma d'extraction, il est
 *    rendu tel quel : les tests décrivent ainsi la facture qu'ils veulent
 *    voir lue, cas limites compris (ligne sans prix, total incohérent…) ;
 *  - sinon, une facture de démonstration fixe, pour cliquer dans l'interface.
 */
@Injectable()
export class ExtracteurSimule implements ExtracteurFacture {
  readonly nom = 'simule' as const;

  async extraire(fichier: Buffer): Promise<ExtractionFacture> {
    const texte = fichier.toString('utf8').trim();
    if (texte.startsWith('{')) {
      const r = ExtractionFactureSchema.safeParse(JSON.parse(texte));
      if (r.success) return r.data;
    }
    return {
      fournisseur: 'Fournisseur Démo SARL',
      numeroFacture: 'FD-2026-0042',
      dateFacture: '2026-09-01',
      devise: 'XAF',
      total: 61000,
      lignes: [
        { designation: 'Savon Dove Original 90g', quantite: 24, prixUnitaire: 400, prixTotal: 9600, reference: '8720181240751' },
        { designation: 'Robe Enfant Coton Bleu 4 ans', quantite: 10, prixUnitaire: 5140, prixTotal: 51400, reference: null },
      ],
      confiance: 'haute',
      remarques: null,
    };
  }
}
