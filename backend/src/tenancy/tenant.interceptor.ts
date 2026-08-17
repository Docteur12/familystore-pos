/**
 * Intercepteur qui pose le tenant courant dans le contexte CLS, pour chaque
 * requête HTTP.
 *
 * Ordre d'exécution NestJS : middleware CLS (monte le contexte) → gardes
 * (AuthGuard décode le JWT → req.user) → INTERCEPTEURS (ici) → handler. Le
 * tenant est donc résolu une fois le JWT décodé, et posé avant que le service
 * ne touche la base.
 *
 *  - mode single : tenant = DEFAULT_TENANT_ID, systématiquement. L'instance
 *    fonctionne comme avant le multi-tenant.
 *  - mode multi  : tenant = req.user.tenantId (issu du JWT). Sur une route
 *    publique sans JWT (login…), aucun tenant n'est posé → toute requête sur
 *    un modèle cloisonné lèvera (fail-closed). La résolution du tenant à la
 *    connexion en mode multi relève d'une phase ultérieure (onboarding).
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DEFAULT_TENANT_ID, getTenantMode, setTenantId } from './tenant-context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Ne concerne que le transport HTTP (pas les contextes RPC/WS).
    if (context.getType() === 'http') {
      if (getTenantMode() === 'single') {
        setTenantId(DEFAULT_TENANT_ID);
      } else {
        const req = context.switchToHttp().getRequest();
        const tenantId = req?.user?.tenantId;
        if (tenantId) setTenantId(tenantId);
        // Sinon : contexte laissé vide → fail-closed sur tout modèle cloisonné.
      }
    }
    return next.handle();
  }
}
