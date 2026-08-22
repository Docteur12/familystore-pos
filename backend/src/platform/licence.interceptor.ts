import {
  CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ProvisionnementService, EtatLicence } from './provisionnement.service';

/**
 * Licence expirée → boutique en LECTURE SEULE, jamais coupée.
 *
 * Un commerçant qui a oublié de payer doit pouvoir consulter ses données,
 * sortir ses états, terminer sa journée. Seules les écritures NEUVES sont
 * refusées, avec un 402 portant le montant à payer.
 *
 * Un intercepteur, et non une garde : les gardes globales s'exécutent AVANT
 * l'AuthGuard de route, donc `req.user` — et avec lui la boutique — ne serait
 * pas encore résolu.
 *
 * Restent autorisés même après expiration :
 *  - **la synchronisation des ventes hors-ligne déjà en file.** Elles ont eu
 *    lieu quand la licence était valide ; les refuser détruirait des ventes
 *    réelles. Le serveur les reconnaît à leur `dateVente`, qui doit tomber
 *    dans la période couverte — on ne peut donc pas antidater une vente neuve
 *    pour contourner le blocage ;
 *  - **la lecture, les rapports et les exports** : ce sont SES données, il
 *    doit pouvoir les récupérer, licence payée ou non ;
 *  - **la connexion et la fermeture d'une session de caisse en cours** : on
 *    ne laisse personne coincé avec une caisse ouverte ;
 *  - **le back-office plateforme**, sans quoi la prolongation elle-même
 *    serait bloquée par le blocage qu'elle doit lever.
 *
 * Sans licence connue (instances d'avant le module plateforme), rien n'est
 * bloqué : pas de licence enregistrée = pas de blocage.
 */
@Injectable()
export class LicenceInterceptor implements NestInterceptor {
  constructor(private provisionnement: ProvisionnementService) {}

  private static readonly ECRITURES = ['POST', 'PUT', 'PATCH', 'DELETE'];

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const methode = String(req.method ?? '').toUpperCase();

    // Toute lecture passe, toujours.
    if (!LicenceInterceptor.ECRITURES.includes(methode)) return next.handle();

    const tenantId = req?.user?.tenantId;
    if (!tenantId) return next.handle();   // non authentifié : l'AuthGuard tranchera

    const etat = await this.provisionnement.etatLicence(String(tenantId));
    if (!etat || !etat.expiree) return next.handle();

    if (this.autoriseMalgreExpiration(req, etat)) return next.handle();

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        message:
          `Licence expirée depuis le ${etat.dateEcheance.toLocaleDateString('fr-FR')}. ` +
          `La boutique reste consultable, mais les nouvelles saisies sont suspendues. ` +
          `Renouvellement : ${etat.montant.toLocaleString('fr-FR').replace(/ | /g, ' ')} ${etat.devise} par an.`,
        licence: {
          expiree: true,
          montant: etat.montant,
          devise: etat.devise,
          dateEcheance: etat.dateEcheance,
        },
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  /** Liste explicite de ce qui reste permis, licence expirée. */
  private autoriseMalgreExpiration(req: any, etat: EtatLicence): boolean {
    const chemin: string = req.path ?? req.url ?? '';

    // Connexion, renouvellement de jeton, bascule de boutique.
    if (chemin.startsWith('/api/auth/')) return true;

    // Back-office : c'est par là que passe la prolongation.
    if (chemin.startsWith('/api/platform/')) return true;

    // Fermeture d'une session de caisse déjà ouverte.
    if (req.method === 'PATCH' && /^\/api\/sessions\/[^/]+\/close$/.test(chemin)) return true;

    // Archive de la facture d'une vente déjà acceptée.
    if (chemin === '/api/factures') return true;

    // Vente hors-ligne : acceptée si elle a eu lieu pendant la couverture.
    if (chemin === '/api/sales') {
      const brut = req.body?.dateVente;
      if (!brut) return false;                       // vente neuve : refusée
      const date = new Date(brut);
      return !isNaN(date.getTime()) && date <= etat.finCouverture;
    }

    return false;
  }
}
