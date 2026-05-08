import {
  Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, HttpCode, HttpStatus,
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

  // PATCH /api/sessions/:id/close — caissier ferme sa session
  @Patch(':id/close')
  close(@Param('id') id: string) {
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
  ) {
    return this.sessionsService.findAll({
      dateFrom, dateTo, cashier,
      page:  Number(page)  || 0,
      limit: Number(limit) || 50,
    });
  }
}
