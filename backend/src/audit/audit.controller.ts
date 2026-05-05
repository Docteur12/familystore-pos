import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
}
