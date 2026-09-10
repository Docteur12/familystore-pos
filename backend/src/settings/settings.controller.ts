import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request }         from 'express';
import { SettingsService } from './settings.service';
import { AuthGuard }       from '../auth/auth.guard';
import { RolesGuard }      from '../auth/roles.guard';
import { Roles }           from '../auth/roles.decorator';
import { AuditService }    from '../audit/audit.service';
import { getTenantMode }   from '../tenancy/tenant-context';

/**
 * Identité publique du magasin — affichée AVANT connexion (page de login,
 * écran PIN) : nom, logo, couleurs, langue. Aucune donnée sensible.
 *
 * La réponse dépend du MODE (règle tranchée le 26/08/2026, voir CLAUDE.md) :
 *  - **single** — un domaine par client : le domaine EST l'identification, on
 *    rend l'identité complète et l'écran de connexion l'affiche ;
 *  - **multi** — origine partagée : on ne sait pas encore chez qui l'on entre,
 *    la réponse est NEUTRE (`{ mode: 'multi' }`) et l'écran reste Caméléon.
 *    Avant, la route répondait 500 (plugin fail-closed hors contexte tenant) ;
 *    répondre « neutre » est le comportement voulu, pas une panne.
 */
@Controller('settings/public')
export class SettingsPublicController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  async get() {
    if (getTenantMode() === 'multi') return { mode: 'multi' as const };
    const s: any = await this.settingsService.get();
    return {
      mode:              'single' as const,
      nomMagasin:        s.nomMagasin,
      logoUrl:           s.logoUrl,
      couleurPrincipale: s.couleurPrincipale,
      couleurSecondaire: s.couleurSecondaire,
      langue:            s.langue,
      slogan:            s.slogan,
      signatureTicket:   s.signatureTicket,
      ville:             s.ville,
    };
  }
}

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
