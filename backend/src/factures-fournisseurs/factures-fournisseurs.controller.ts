import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { CorpsValidation, FacturesFournisseursService } from './factures-fournisseurs.service';

/**
 * Factures fournisseurs — import, lecture automatique, contrôle, validation.
 * Réservé aux rôles qui font entrer de la marchandise : patron, gestionnaire,
 * magasinier. Toute validation ou rejet est journalisé avec l'auteur.
 */
@Controller('factures-fournisseurs')
@UseGuards(AuthGuard, RolesGuard)
@Roles('patron', 'gestionnaire', 'magazinier')
export class FacturesFournisseursController {
  constructor(private service: FacturesFournisseursService, private audit: AuditService) {}

  // POST /api/factures-fournisseurs — { fichierBase64, mimeType, nomFichier }
  @Post()
  async importer(@Body() corps: { fichierBase64: string; mimeType: string; nomFichier?: string }, @Req() req: Request) {
    const actor = (req as any)['user'];
    const facture = await this.service.importer(corps, actor.sub ?? actor.userId ?? actor.id);
    this.audit.log({
      type: 'creation', module: 'stock',
      actorName: actor.name, actorRole: actor.role,
      detail: `Facture fournisseur importée : ${facture.fournisseur || '(fournisseur non lu)'} ${facture.numeroFacture ? 'n° ' + facture.numeroFacture : ''} — ${facture.lignes.length} ligne(s), confiance ${facture.confiance}`,
      meta: { factureId: String(facture._id), lignes: facture.lignes.length, confiance: facture.confiance, extracteur: facture.extracteur },
    });
    return facture;
  }

  @Get()
  lister(@Query('statut') statut?: string) {
    return this.service.lister(statut);
  }

  @Get(':id')
  obtenir(@Param('id') id: string) {
    return this.service.obtenir(id);
  }

  // GET /api/factures-fournisseurs/:id/fichier — le justificatif archivé
  @Get(':id/fichier')
  async fichier(@Param('id') id: string, @Res() res: Response) {
    const f = await this.service.fichier(id);
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.nomFichier)}"`);
    res.setHeader('Content-Length', f.fichier.length);
    res.end(f.fichier);
  }

  @Post(':id/valider')
  async valider(@Param('id') id: string, @Body() corps: CorpsValidation, @Req() req: Request) {
    const actor = (req as any)['user'];
    const r = await this.service.valider(id, corps, actor.sub ?? actor.userId ?? actor.id);
    this.audit.log({
      type: 'creation', module: 'stock',
      actorName: actor.name, actorRole: actor.role,
      detail: `Facture fournisseur validée : ${r.facture.fournisseur}${r.facture.numeroFacture ? ' n° ' + r.facture.numeroFacture : ''} — ${r.articlesRecus} article(s) en entrepôt, ${r.produitsCrees} produit(s) créé(s)`,
      meta: { factureId: id, receptionId: String(r.receptionId), articlesRecus: r.articlesRecus, produitsCrees: r.produitsCrees },
    });
    return r;
  }

  @Post(':id/rejeter')
  async rejeter(@Param('id') id: string, @Body('motif') motif: string, @Req() req: Request) {
    const actor = (req as any)['user'];
    const facture = await this.service.rejeter(id, motif, actor.sub ?? actor.userId ?? actor.id);
    this.audit.log({
      type: 'suppression', module: 'stock',
      actorName: actor.name, actorRole: actor.role,
      detail: `Facture fournisseur rejetée : ${facture.fournisseur || facture.nomFichier} — ${facture.motifRejet}`,
      meta: { factureId: id },
    });
    return facture;
  }
}
