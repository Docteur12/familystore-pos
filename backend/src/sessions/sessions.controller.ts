import {
  Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Request }        from 'express';
import { SessionsService, OpenSessionDto } from './sessions.service';
import { AuthGuard }      from '../auth/auth.guard';
import { RolesGuard }     from '../auth/roles.guard';
import { Roles }          from '../auth/roles.decorator';

@Controller('sessions')
@UseGuards(AuthGuard)
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  // POST /api/sessions — caissier ouvre une session
  @Post()
  @HttpCode(HttpStatus.CREATED)
  open(@Req() req: Request) {
    const actor = (req as any)['user'];
    const dto: OpenSessionDto = {
      cashierName:  actor.name        ?? '',
      cashierEmail: actor.email       ?? '',
      caisseName:   actor.caisse?.nom ?? '',
      caisseCode:   actor.caisse?.code ?? '',
    };
    return this.sessionsService.open(dto);
  }

  // GET /api/sessions/active — session en cours du caissier connecté
  @Get('active')
  async getActive(@Req() req: Request) {
    const actor = (req as any)['user'];
    const session = await this.sessionsService.findActive(actor.email);
    if (!session) throw new NotFoundException('Aucune session active');
    return session;
  }

  // PATCH /api/sessions/:id/close — ferme une session (propriétaire ou patron)
  @Patch(':id/close')
  async close(@Param('id') id: string, @Req() req: Request) {
    const actor = (req as any)['user'];
    if (actor.role !== 'patron') {
      const session = await this.sessionsService.findById(id);
      if (!session || (session as any).cashierEmail !== actor.email) {
        throw new ForbiddenException('Vous ne pouvez fermer que votre propre session');
      }
    }
    return this.sessionsService.close(id);
  }

  // GET /api/sessions — historique (patron seulement)
  @Get()
  @UseGuards(RolesGuard)
  @Roles('patron')
  findAll(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?:   string,
    @Query('cashier')  cashier?:  string,
    @Query('page')     page?:     string,
    @Query('limit')    limit?:    string,
    @Query('active')   active?:   string,
  ) {
    return this.sessionsService.findAll({
      dateFrom, dateTo, cashier,
      page:       Number(page)  || 0,
      limit:      Number(limit) || 50,
      activeOnly: active === 'true',
    });
  }
}
