import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { AuthGuard }   from '../auth/auth.guard';
import { RolesGuard }  from '../auth/roles.guard';
import { Roles }       from '../auth/roles.decorator';

@Controller('audit')
@UseGuards(AuthGuard, RolesGuard)
@Roles('patron')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  findAll(
    @Query('type')   type?:   string,
    @Query('module') module?: string,
    @Query('search') search?: string,
    @Query('limit')  limit?:  string,
  ) {
    return this.service.findAll({ type, module, search, limit: limit ? Number(limit) : 200 });
  }

  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  // Actions admin sur la caisse (ex. suppression de vente) — visible par la caisse.
  // @Roles au niveau méthode pour autoriser au-delà du patron (override la classe).
  @Get('caisse')
  @Roles('caissier', 'gestionnaire', 'magazinier', 'patron')
  caisseActions(@Req() req: Request, @Query('limit') limit?: string) {
    const caisse = (req as any).user?.caisse?.nom; // filtre selon la caisse de l'utilisateur
    return this.service.findCaisseAdminActions(caisse, limit ? Number(limit) : 100);
  }
}
