import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Sale, SaleSchema } from '../schemas/sale.schema';
import { Expense, ExpenseSchema } from '../schemas/expense.schema';
import { AuditLog, AuditLogSchema } from '../schemas/audit-log.schema';
import { Settings, SettingsSchema } from '../settings/settings.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name,     schema: SaleSchema     },
      { name: Expense.name,  schema: ExpenseSchema  },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Settings.name, schema: SettingsSchema },
      { name: User.name,     schema: UserSchema     },
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
