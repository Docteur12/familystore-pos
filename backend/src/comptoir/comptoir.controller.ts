import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard }    from '../auth/auth.guard';
import { RolesGuard }   from '../auth/roles.guard';
import { Roles }        from '../auth/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { ComptoirService } from './comptoir.service';
import { CasseDto, DefinirConditionnementDto, ReceptionCasiersDto, RetourVidesDto } from './dto/comptoir.dto';
import { ROLES_COMPTOIR, ROLES_RAPPORT, ROLES_RESERVE } from './motifs';

/**
 * Routes du profil Snack-bar — préfixe `/api/snack`.
 *
 * L'encaissement du comptoir passe par `POST /api/sales` (route existante,
 * noyau intouchable) : ici ne vivent que ce qui est propre au snack — les
 * conditionnements (casier, consigne), la réserve et les retours de vide.
 *
 * Chaque route porte ses rôles ; `test/comptoir/comptoir.e2e.spec.ts` prouve le 403
 * et le témoin 200 de chaque groupe.
 */
@Controller('comptoir')
@UseGuards(AuthGuard, RolesGuard)
export class ComptoirController {
  constructor(
    private readonly service: ComptoirService,
    private readonly audit:   AuditService,
  ) {}

  private acteur(req: Request) {
    const u = (req as any).user ?? {};
    return { name: u.name as string | undefined, email: u.email as string | undefined, role: u.role as string | undefined };
  }

  // ── Conditionnements (casier, consigne) ───────────────────────────────────

  @Get('conditionnements')
  @Roles(...ROLES_COMPTOIR, ...ROLES_RESERVE)
  conditionnements() {
    return this.service.listerConditionnements();
  }

  @Put('conditionnements/:productId')
  @Roles(...ROLES_RESERVE)
  async definirConditionnement(
    @Param('productId') productId: string,
    @Body() dto: DefinirConditionnementDto,
    @Req() req: Request,
  ) {
    const cond = await this.service.definirConditionnement(productId, dto);
    const a = this.acteur(req);
    void this.audit.log({
      type: 'conditionnement', module: 'snack',
      actorName: a.name ?? '', actorRole: a.role ?? '',
      detail: `Conditionnement : ${dto.bouteillesParCasier} bouteilles/casier, consigne ${dto.consigne} F`,
      meta: { productId, ...dto },
    });
    return cond;
  }

  // ── Réserve ───────────────────────────────────────────────────────────────

  @Get('reserve')
  @Roles(...ROLES_RESERVE)
  reserve() {
    return this.service.etatReserve();
  }

  @Get('reserve/receptions')
  @Roles(...ROLES_RESERVE)
  receptions(@Query('limit') limit?: string) {
    const n = Number(limit);
    return this.service.listerReceptions(Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 100);
  }

  @Post('reserve/receptions')
  @Roles(...ROLES_RESERVE)
  @HttpCode(HttpStatus.CREATED)
  async receptionner(@Body() dto: ReceptionCasiersDto, @Req() req: Request) {
    const a = this.acteur(req);
    const res = await this.service.receptionnerCasiers(dto, a);
    if (!res.rejeu) {
      void this.audit.log({
        type: 'reception_casier', module: 'snack',
        actorName: a.name ?? '', actorRole: a.role ?? '',
        detail: `Réception ${dto.casiers} casier(s) — ${res.reception.nomProduit} (+${res.reception.bouteilles} bouteilles`
              + `${res.reception.videsRendus ? `, ${res.reception.videsRendus} vides rendus` : ''})`,
        meta: { productId: dto.productId, casiers: dto.casiers, bouteilles: res.reception.bouteilles, videsRendus: res.reception.videsRendus },
      });
    }
    return res;
  }

  @Post('reserve/casse')
  @Roles(...ROLES_RESERVE)
  @HttpCode(HttpStatus.CREATED)
  async casse(@Body() dto: CasseDto, @Req() req: Request) {
    const a = this.acteur(req);
    const res = await this.service.declarerCasse(dto, a);
    if (!res.rejeu) {
      void this.audit.log({
        type: 'casse', module: 'snack',
        actorName: a.name ?? '', actorRole: a.role ?? '',
        detail: `Casse : ${dto.bouteilles} bouteille(s)${dto.note ? ` — ${dto.note}` : ''}`,
        meta: { productId: dto.productId, bouteilles: dto.bouteilles },
      });
    }
    return res;
  }

  // ── Consignes ─────────────────────────────────────────────────────────────

  @Post('consignes/retours')
  @Roles(...ROLES_COMPTOIR)
  @HttpCode(HttpStatus.CREATED)
  async retourVides(@Body() dto: RetourVidesDto, @Req() req: Request) {
    const a = this.acteur(req);
    const res = await this.service.retournerVides(dto, a);
    if (!res.rejeu) {
      void this.audit.log({
        type: 'retour_vide', module: 'snack',
        actorName: a.name ?? '', actorRole: a.role ?? '',
        detail: `Retour de vide : ${dto.quantite} × ${res.mouvement.nomProduit} — ${res.montant.toLocaleString('fr-FR')} F rendus`,
        meta: { productId: dto.productId, quantite: dto.quantite, montant: res.montant },
      });
    }
    return res;
  }

  @Get('consignes/jour')
  @Roles(...ROLES_RAPPORT)
  consignesDuJour(@Query('date') date?: string) {
    return this.service.consignesDuJour(date);
  }
}
