import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('expenses')
@UseGuards(AuthGuard)
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  // POST /api/expenses — tous les rôles (caissier peut saisir une dépense)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateExpenseDto) {
    return this.expensesService.create(dto);
  }

  // GET /api/expenses/stats/month — patron only
  // Déclaré avant /:id pour éviter la capture par un éventuel param
  @Get('stats/month')
  @UseGuards(RolesGuard)
  @Roles('patron')
  statsMonth() {
    return this.expensesService.statsMonth();
  }

  // GET /api/expenses — patron only
  @Get()
  @UseGuards(RolesGuard)
  @Roles('patron')
  findAll() {
    return this.expensesService.findAll();
  }

  // DELETE /api/expenses/:id — patron only
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('patron')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
