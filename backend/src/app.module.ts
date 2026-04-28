import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';
import { StockModule } from './stock/stock.module';
import { SettingsModule } from './settings/settings.module';
import { MagazinierModule } from './magazinier/magazinier.module';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGO_URI,
      }),
    }),
    AuthModule,
    ProductsModule,
    SalesModule,
    ExpensesModule,
    ReportsModule,
    StockModule,
    SettingsModule,
    MagazinierModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
