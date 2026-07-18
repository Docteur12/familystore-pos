import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request }             from 'express';
import { FournisseursService } from './fournisseurs.service';
import { AuthGuard }           from '../auth/auth.guard';
import { RolesGuard }          from '../auth/roles.guard';
import { Roles }               from '../auth/roles.decorator';
import { AuditService }        from '../audit/audit.service';

type FournisseurBody = {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  adresse?: string;
  conditionsPaiement?: string;
  remise?: string;
  note?: number;
  categories?: string[];
};

@Controller('fournisseurs')
@UseGuards(AuthGuard)
export class FournisseursController {
  constructor(
    private readonly service: FournisseursService,
    private auditService: AuditService,
  ) {}

  @Get()
  findAll() { return this.service.findAll(); }

  // ── Évaluation : vendu / à verser / versé / dette par fournisseur ──────────
  @Get('evaluation')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  evaluation(@Query('periode') periode?: string) {
    return this.service.getEvaluation(periode || 'mois');
  }

  // ── Série temporelle des ventes (par fournisseur OU par produit) ───────────
  @Get('serie-ventes')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  serieVentes(
    @Query('fournisseur') fournisseur?: string,
    @Query('productId') productId?: string,
    @Query('granularite') granularite?: string,
  ) {
    return this.service.getSerieVentes({ fournisseur, productId, granularite });
  }

  // ── Évolution de la valeur du stock (boutique + entrepôt) ──────────────────
  @Get('stock-evolution')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron', 'magazinier')
  stockEvolution(@Query('jours') jours?: string) {
    return this.service.getStockEvolution(Math.min(730, Math.max(7, parseInt(jours ?? '') || 90)));
  }

  // ── Versements aux fournisseurs ────────────────────────────────────────────
  @Get('versements')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  versements(@Query('fournisseur') fournisseur?: string) {
    return this.service.getVersements(fournisseur);
  }

  @Post('versements')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  async createVersement(@Body() body: { fournisseur: string; montant: number; note?: string; date?: string }, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.service.createVersement(body, actor?.sub);
    this.auditService.log({
      type: 'creation', module: 'fournisseurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Versement fournisseur : ${body.montant} XAF à ${body.fournisseur}`,
      meta: { versementId: String(result._id) },
    });
    return result;
  }

  @Delete('versements/:vid')
  @UseGuards(RolesGuard)
  @Roles('patron')
  async deleteVersement(@Param('vid') vid: string, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.service.deleteVersement(vid);
    this.auditService.log({
      type: 'suppression', module: 'fournisseurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Versement fournisseur supprimé (id: ${vid})`,
      meta: { versementId: vid },
    });
    return result;
  }

  // ── Retours aux fournisseurs ───────────────────────────────────────────────
  @Get('retours')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron', 'magazinier')
  retours(@Query('fournisseur') fournisseur?: string) {
    return this.service.getRetours(fournisseur);
  }

  @Post('retours')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron', 'magazinier')
  async createRetour(
    @Body() body: { fournisseur: string; note?: string; lignes: { productId: string; quantite: number; origine?: string }[] },
    @Req() req: Request,
  ) {
    const actor = (req as any)['user'];
    const result = await this.service.createRetour(body, actor?.sub);
    this.auditService.log({
      type: 'creation', module: 'fournisseurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Retour fournisseur ${body.fournisseur} : ${result.lignes.length} produit(s), valeur ${result.total} XAF`,
      meta: { retourId: String(result._id) },
    });
    return result;
  }

  @Delete('retours/:rid')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  async deleteRetour(@Param('rid') rid: string, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.service.deleteRetour(rid);
    this.auditService.log({
      type: 'suppression', module: 'fournisseurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Retour fournisseur annulé (id: ${rid}) — stock restitué`,
      meta: { retourId: rid },
    });
    return result;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  async create(@Body() body: FournisseurBody, @Req() req: Request) {
    const actor  = (req as any)['user'];
    const result = await this.service.create(body);
    this.auditService.log({
      type: 'creation', module: 'fournisseurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Fournisseur créé : ${body.name}`,
      meta: { fournisseurId: String(result._id) },
    });
    return result;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  async update(@Param('id') id: string, @Body() body: Partial<FournisseurBody>, @Req() req: Request) {
    const actor  = (req as any)['user'];
    const result = await this.service.update(id, body);
    this.auditService.log({
      type: 'modification', module: 'fournisseurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Fournisseur modifié : ${result.name}`,
      meta: { fournisseurId: id, fields: Object.keys(body) },
    });
    return result;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const actor  = (req as any)['user'];
    const result = await this.service.remove(id);
    this.auditService.log({
      type: 'suppression', module: 'fournisseurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Fournisseur supprimé (id: ${id})`,
      meta: { fournisseurId: id },
    });
    return result;
  }
}
