/**
 * Module de cloisonnement multi-tenant — global.
 *
 * Assemble les trois pièces :
 *  1. ClsModule (nestjs-cls) : monte le middleware qui établit un contexte
 *     AsyncLocalStorage pour chaque requête HTTP ;
 *  2. TenantInterceptor : pose le tenant courant dans ce contexte ;
 *  3. (le plugin Mongoose est appliqué à la connexion dans app.module.ts —
 *     il lit le tenant depuis ce même contexte).
 */
import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      // Monte automatiquement le middleware CLS : chaque requête HTTP obtient
      // son propre contexte, isolé des autres, avant gardes et intercepteurs.
      middleware: { mount: true },
    }),
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: TenantInterceptor }],
})
export class TenancyModule {}
