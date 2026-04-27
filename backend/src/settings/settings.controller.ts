import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  // GET /api/settings — tous les rôles authentifiés
  @Get()
  get() {
    return this.settingsService.get();
  }

  // PATCH /api/settings — patron uniquement
  @Patch()
  @UseGuards(RolesGuard)
  @Roles('patron')
  update(@Body() body: any) {
    return this.settingsService.update(body);
  }
}
