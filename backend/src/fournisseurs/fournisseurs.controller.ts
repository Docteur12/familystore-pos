import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards,
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
