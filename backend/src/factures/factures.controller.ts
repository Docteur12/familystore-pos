import {
  Body, Controller, Delete, Get, Param, Post, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FacturesService, CreateFactureDto } from './factures.service';
import { AuthGuard }  from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

@Controller('factures')
@UseGuards(AuthGuard)
export class FacturesController {
  constructor(private facturesService: FacturesService) {}

  // POST /api/factures — tous les rôles authentifiés (caissier, patron, gestionnaire)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateFactureDto) {
    return this.facturesService.create(dto);
  }

  // GET /api/factures — patron only
  @Get()
  @UseGuards(RolesGuard)
  @Roles('patron')
  findAll(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?:   string,
    @Query('caissier') caissier?: string,
    @Query('page')     page?:     string,
    @Query('limit')    limit?:    string,
  ) {
    return this.facturesService.findAll({ dateFrom, dateTo, caissier, page: Number(page), limit: Number(limit) });
  }

  // GET /api/factures/:id — patron only
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('patron')
  findOne(@Param('id') id: string) {
    return this.facturesService.findOne(id);
  }

  // DELETE /api/factures/:id — patron only
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('patron')
  remove(@Param('id') id: string) {
    return this.facturesService.remove(id);
  }
}
