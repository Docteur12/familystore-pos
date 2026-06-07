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
@Roles('magazinier', 'patron')
export class PartenairesController {
  constructor(private readonly service: PartenairesService) {}

  // ── Partenaires ────────────────────────────────────────────────────────────
  @Get()
  list() {
    return this.service.getPartenaires();
  }

  @Post()
  create(@Body() dto: { name: string; phone?: string; lieu?: string; note?: string }) {
    return this.service.createPartenaire(dto);
  }

  // ── Routes littérales (avant :id pour éviter le conflit de route) ──────────
  @Get('stats')
  stats() {
    return this.service.getStats();
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
    @Body() body: { partenaireId: string; modePaiement?: string; delai?: number; note?: string; lignes: { productId: string; quantite: number; prixUnitaire: number }[] },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.createCommande(body, actor?.sub);
  }

  @Patch('commandes/:cid')
  updateCommande(@Param('cid') cid: string, @Body() dto: Partial<{ statut: string; note: string; delai: number }>) {
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
  update(@Param('id') id: string, @Body() dto: Partial<{ name: string; phone: string; lieu: string; note: string }>) {
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
    @Body() body: { numeroBL?: string; date?: string; montantPaye?: number; modePaiement?: string; lignes: { productId: string; quantite: number; prixUnitaire: number }[] },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.createLivraison(id, body, actor?.sub);
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
    @Body() body: { montant: number; note?: string; date?: string },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.createPaiement(id, body, actor?.sub);
  }
}
