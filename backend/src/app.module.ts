import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';
import { StockModule } from './stock/stock.module';
import { SettingsModule } from './settings/settings.module';
import { MagazinierModule } from './magazinier/magazinier.module';
import { CaissesModule } from './caisses/caisses.module';
import { AuditModule }    from './audit/audit.module';
import { FacturesModule }  from './factures/factures.module';
import { SessionsModule }  from './sessions/sessions.module';
import { AdminModule }     from './admin/admin.module';
import { EcartsModule }   from './ecarts/ecarts.module';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGO_URI,
      }),
    }),
    AuditModule,   // global — doit être avant les autres modules
    AuthModule,
    ProductsModule,
    SalesModule,
    ExpensesModule,
    ReportsModule,
    StockModule,
    SettingsModule,
    MagazinierModule,
    CaissesModule,
    FacturesModule,
    SessionsModule,
    AdminModule,
    EcartsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
