import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Sale, SaleSchema } from '../schemas/sale.schema';
import { Expense, ExpenseSchema } from '../schemas/expense.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name,    schema: SaleSchema },
      { name: Expense.name, schema: ExpenseSchema },
    ]),
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
