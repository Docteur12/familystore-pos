import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request }         from 'express';
import { SettingsService } from './settings.service';
import { AuthGuard }       from '../auth/auth.guard';
import { RolesGuard }      from '../auth/roles.guard';
import { Roles }           from '../auth/roles.decorator';
import { AuditService }    from '../audit/audit.service';

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private auditService: AuditService,
  ) {}

  @Get()
  get() {
    return this.settingsService.get();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles('patron')
  async update(@Body() body: any, @Req() req: Request) {
    const actor  = (req as any)['user'];
    const result = await this.settingsService.update(body);
    const fields = Object.keys(body).join(', ');
    this.auditService.log({
      type: 'modification', module: 'paramètres',
      actorName: actor.name, actorRole: actor.role,
      detail: `Paramètres magasin mis à jour : ${fields}`,
      meta: { fields: Object.keys(body) },
    });
    return result;
  }
}
