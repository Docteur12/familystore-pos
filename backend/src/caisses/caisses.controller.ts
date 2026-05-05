import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { Request }        from 'express';
import { CaissesService } from './caisses.service';
import { AuthGuard }      from '../auth/auth.guard';
import { RolesGuard }     from '../auth/roles.guard';
import { Roles }          from '../auth/roles.decorator';
import { AuditService }   from '../audit/audit.service';

@Controller('caisses')
@UseGuards(AuthGuard)
export class CaissesController {
  constructor(
    private readonly service: CaissesService,
    private auditService: AuditService,
  ) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('patron')
  async create(@Body() body: { nom: string; code: string; pin: string; ville?: string }, @Req() req: Request) {
    const actor  = (req as any)['user'];
    const result = await this.service.create(body);
    this.auditService.log({
      type: 'creation', module: 'caisses',
      actorName: actor.name, actorRole: actor.role,
      detail: `Caisse créée : ${body.nom} (${body.code})`,
      meta: { caisseId: String(result._id), code: body.code },
    });
    return result;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('patron')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<{ nom: string; pin: string; ville: string }>,
    @Req() req: Request,
  ) {
    const actor  = (req as any)['user'];
    const result = await this.service.update(id, body);
    const fields = Object.keys(body).join(', ');
    this.auditService.log({
      type: 'modification', module: 'caisses',
      actorName: actor.name, actorRole: actor.role,
      detail: `Caisse modifiée : ${result.nom} (${result.code}) — ${fields}`,
      meta: { caisseId: id, fields: Object.keys(body) },
    });
    return result;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('patron')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const actor  = (req as any)['user'];
    const result = await this.service.remove(id);
    this.auditService.log({
      type: 'suppression', module: 'caisses',
      actorName: actor.name, actorRole: actor.role,
      detail: `Caisse supprimée (id: ${id})`,
      meta: { caisseId: id },
    });
    return result;
  }
}
