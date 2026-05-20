import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { EcartsService } from './ecarts.service';
import { AuthGuard }     from '../auth/auth.guard';
import { RolesGuard }    from '../auth/roles.guard';
import { Roles }         from '../auth/roles.decorator';

@Controller('ecarts')
@UseGuards(AuthGuard)
export class EcartsController {
  constructor(private ecartsService: EcartsService) {}

  // GET /api/ecarts — liste (gestionnaire + patron)
  @Get()
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire')
  findAll(
    @Query('statut') statut?: string,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.ecartsService.findAll({ statut, page: Number(page) || 0, limit: Number(limit) || 50 });
  }

  // GET /api/ecarts/count — badge sidebar
  @Get('count')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire')
  async count() {
    const count = await this.ecartsService.countEnAttente();
    return { count };
  }

  // GET /api/ecarts/stats — rapport
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('patron')
  stats() {
    return this.ecartsService.stats();
  }

  // PATCH /api/ecarts/:id/resoudre
  @Patch(':id/resoudre')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire')
  resoudre(@Param('id') id: string) {
    return this.ecartsService.marquerResolu(id);
  }
}
