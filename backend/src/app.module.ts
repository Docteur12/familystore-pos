import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Connection } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './config/app-throttler.guard';
import { TenancyModule } from './tenancy/tenancy.module';
import { tenantPlugin } from './tenancy/tenant.plugin';
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
import { FournisseursModule } from './fournisseurs/fournisseurs.module';
import { BonsLivraisonModule } from './bons-livraison/bons-livraison.module';
import { PartenairesModule } from './partenaires/partenaires.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGO_URI,
        // Applique le plugin de cloisonnement à la connexion : TOUS les modèles
        // compilés ensuite (les 24 schémas métier) héritent du filtrage par
        // tenant. Un seul point d'application, aucun module à modifier. Les
        // schémas plateforme s'en excluent via { skipTenant: true }.
        connectionFactory: (connection: Connection) => {
          connection.plugin(tenantPlugin);
          return connection;
        },
      }),
    }),
    TenancyModule,   // global — contexte CLS + interceptor tenant
    // Limite par défaut : 100 requêtes/minute par IP et par route.
    // Les routes de connexion et de synchronisation hors-ligne la
    // surchargent — voir src/config/throttle.ts.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
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
    FournisseursModule,
    BonsLivraisonModule,
    PartenairesModule,
    CategoriesModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
