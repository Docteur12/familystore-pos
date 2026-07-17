import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PartenairesService } from './partenaires.service';
import { AuthGuard }  from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

@Controller('partenaires')
@UseGuards(AuthGuard, RolesGuard)
@Roles('magazinier', 'patron', 'commercial')
export class PartenairesController {
  constructor(private readonly service: PartenairesService) {}

  // ── Partenaires ────────────────────────────────────────────────────────────
  @Get()
  list() {
    return this.service.getPartenaires();
  }

  @Post()
  create(@Body() dto: { name: string; phone?: string; lieu?: string; ville?: string; quartier?: string; responsable?: string; email?: string; note?: string; type?: string; ancienneDette?: number }) {
    return this.service.createPartenaire(dto);
  }

  // ── Routes littérales (avant :id pour éviter le conflit de route) ──────────
  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  // ── Tableau de bord ventilé par agence ─────────────────────────────────────
  @Get('stats-agences')
  statsAgences() {
    return this.service.getStatsAgences();
  }

  // ── Historique global (livraisons + versements + retours) ──────────────────
  @Get('historique')
  historique() {
    return this.service.getOperations();
  }

  // ── Agences (sous-entités d'un partenaire) ─────────────────────────────────
  @Get('agences')
  agences(@Query('partenaireId') partenaireId?: string) {
    return this.service.getAgences(partenaireId);
  }

  @Post('agences')
  createAgence(@Body() body: { partenaireId: string; nom: string; ville?: string; quartier?: string; telephone?: string; responsable?: string; independante?: boolean }) {
    return this.service.createAgence(body);
  }

  @Patch('agences/:aid')
  updateAgence(@Param('aid') aid: string, @Body() dto: Partial<{ nom: string; ville: string; quartier: string; telephone: string; responsable: string; independante: boolean; archivee: boolean }>) {
    return this.service.updateAgence(aid, dto);
  }

  @Delete('agences/:aid')
  deleteAgence(@Param('aid') aid: string) {
    return this.service.deleteAgence(aid);
  }

  @Get('livraisons')
  livraisons(@Query('partenaireId') partenaireId?: string) {
    return this.service.getLivraisons(partenaireId);
  }

  // ── Commandes (demande du grossiste) ───────────────────────────────────────
  @Get('commandes')
  commandes(@Query('statut') statut?: string) {
    return this.service.getCommandes(statut);
  }

  @Post('commandes')
  createCommande(
    @Body() body: { partenaireId: string; agenceId?: string | null; modePaiement?: string; delai?: number; note?: string; lignes: { productId: string; quantite: number; prixUnitaire: number }[] },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.createCommande(body, actor?.sub);
  }

  // Préparation / livraison par le magasinier (quantités réellement servies)
  @Post('commandes/:cid/preparer')
  preparerCommande(
    @Param('cid') cid: string,
    @Body() body: { lignes: { productId: string; quantite: number; prixUnitaire?: number }[]; montantPaye?: number; date?: string; numeroBL?: string },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.preparerCommande(cid, body, actor?.sub);
  }

  @Patch('commandes/:cid')
  updateCommande(@Param('cid') cid: string, @Body() dto: Partial<{ statut: string; note: string; delai: number; modePaiement: string; agenceId: string | null; lignes: { productId: string; quantite: number; prixUnitaire: number }[] }>) {
    return this.service.updateCommande(cid, dto);
  }

  @Delete('commandes/:cid')
  deleteCommande(@Param('cid') cid: string) {
    return this.service.deleteCommande(cid);
  }

  @Post('commandes/:cid/livrer')
  livrerCommande(@Param('cid') cid: string, @Body() body: { montantPaye?: number }, @Req() req: Request) {
    const actor = (req as any).user;
    return this.service.genererLivraison(cid, actor?.sub, Number(body?.montantPaye) || 0);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<{ name: string; phone: string; lieu: string; ville: string; quartier: string; responsable: string; email: string; note: string; type: string; archivee: boolean; ancienneDette: number }>) {
    return this.service.updatePartenaire(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.deletePartenaire(id);
  }

  @Get(':id/dernier-prix')
  dernierPrix(@Param('id') id: string) {
    return this.service.getDernierPrix(id);
  }

  @Post(':id/livraisons')
  createLivraison(
    @Param('id') id: string,
    @Body() body: { numeroBL?: string; date?: string; montantPaye?: number; modePaiement?: string; agenceId?: string | null; commandeId?: string | null; lignes: { productId: string; quantite: number; prixUnitaire: number }[] },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.createLivraison(id, body, actor?.sub);
  }

  // Relevé ventilé par agence (dette par agence / commune / globale)
  @Get(':id/compte-agences')
  compteAgences(@Param('id') id: string) {
    return this.service.getCompteAgences(id);
  }

  @Post(':id/retours')
  createRetour(
    @Param('id') id: string,
    @Body() body: { note?: string; lignes: { productId: string; quantite: number; prixUnitaire: number }[] },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.createRetour(id, body, actor?.sub);
  }

  // ── Paiements & relevé ─────────────────────────────────────────────────────
  @Get(':id/compte')
  compte(@Param('id') id: string) {
    return this.service.getCompte(id);
  }

  @Post(':id/paiements')
  createPaiement(
    @Param('id') id: string,
    @Body() body: { montant: number; note?: string; date?: string; agenceId?: string | null },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.createPaiement(id, body, actor?.sub);
  }
}
