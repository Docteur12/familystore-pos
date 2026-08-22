import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService }  from './auth.service';
import { AuthGuard }    from './auth.guard';
import { RolesGuard }   from './roles.guard';
import { Roles }        from './roles.decorator';
import { AuditService } from '../audit/audit.service';
import { ThrottleLogin, ThrottleMotDePasseOublie } from '../config/throttle';
import { runWithTenant } from '../tenancy/tenant-context';

@Controller('auth')
export class AuthController {
  constructor(
    private authService:  AuthService,
    private auditService: AuditService,
  ) {}

  @Post('login')
  @ThrottleLogin()
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    const result = await this.authService.login(body.email, body.password);
    // Multi-magasin : le mot de passe est validé mais la boutique reste à
    // choisir — la connexion n'est pas encore établie, rien à journaliser.
    if ('choixBoutique' in result) return result;

    this.auditService.log({
      type: 'connexion', module: 'auth',
      actorName: result.user.name,
      actorRole: result.user.role,
      detail: `Connexion de ${result.user.name}`,
    });
    return result;
  }

  // Second temps de la connexion multi-magasin : l'utilisateur a déjà prouvé
  // son mot de passe, il désigne sa boutique parmi celles où ce couple est
  // valide (le jeton de sélection borne la liste — voir AuthService).
  @Post('login/boutique')
  @ThrottleLogin()
  @HttpCode(HttpStatus.OK)
  async loginBoutique(@Body() body: { selectionToken: string; tenantId: string }) {
    const result = await this.authService.loginBoutique(body.selectionToken, body.tenantId);
    this.auditService.log({
      type: 'connexion', module: 'auth',
      actorName: result.user.name,
      actorRole: result.user.role,
      detail: `Connexion de ${result.user.name} (boutique choisie)`,
    });
    return result;
  }

  // Renouvellement glissant du jeton : appelé par le frontend quand le jeton
  // (encore valide — l'AuthGuard l'exige) approche de sa fin de vie.
  @Post('refresh')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: Request) {
    const u = (req as any)['user'];
    return this.authService.refresh(u.sub, u.boutiques);
  }

  /**
   * Bascule de boutique — le propriétaire passe d'un magasin à l'autre sans
   * ressaisir son mot de passe. La liste des boutiques autorisées est signée
   * dans le jeton courant : le serveur n'accepte que celles-là.
   */
  @Post('basculer')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async basculer(@Body() body: { tenantId: string }, @Req() req: Request) {
    const acteur = (req as any)['user'];
    const depuis = String(acteur?.tenantId ?? '');
    const vers   = String(body.tenantId);
    const result = await this.authService.basculerBoutique(acteur, vers);

    // Un compte propriétaire est une clé maîtresse : chaque passage d'une
    // boutique à l'autre est tracé DES DEUX CÔTÉS — départ dans la boutique
    // quittée, arrivée dans celle rejointe. Sans la trace d'arrivée, le
    // support ne saurait pas d'où vient l'auteur d'une saisie.
    const trace = {
      type: 'connexion' as const, module: 'auth',
      actorName: result.user.name, actorRole: result.user.role,
      meta: { depuisBoutique: depuis, versBoutique: vers, email: result.user.email },
    };
    this.auditService.log({ ...trace, detail: `${result.user.name} quitte cette boutique pour ${vers}` });
    await runWithTenant(vers, async () =>
      this.auditService.log({ ...trace, detail: `${result.user.name} arrive depuis la boutique ${depuis || '—'}` }),
    );

    return result;
  }

  // Création d'utilisateur réservée au patron
  @Post('register')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron')
  async register(
    @Body()
    body: { name: string; email: string; password: string; role: 'caissier' | 'patron' | 'gestionnaire' | 'magazinier' | 'commercial'; phone?: string; caisseId?: string; assignedLocation?: string },
    @Req() req: Request,
  ) {
    const actor = (req as any)['user'];
    const result = await this.authService.register(body.name, body.email, body.password, body.role ?? 'caissier', body.phone, body.caisseId, body.assignedLocation);
    this.auditService.log({
      type: 'creation', module: 'utilisateurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Compte créé : ${body.name} (${body.role ?? 'caissier'})`,
      meta: { email: body.email, role: body.role },
    });
    return result;
  }

  // Activité utilisateurs — enrichie avec données AuditLog (patron only)
  @Get('users/activity')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron')
  getUserActivity() {
    return this.authService.getUserActivity();
  }

  // Liste des utilisateurs (patron only)
  @Get('users')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron')
  findAll() {
    return this.authService.findAll();
  }

  // Supprimer un compte (patron uniquement)
  @Delete('users/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron')
  async deleteUser(@Param('id') id: string, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.authService.deleteUser(id);
    this.auditService.log({
      type: 'suppression', module: 'utilisateurs',
      actorName: actor.name, actorRole: actor.role,
      detail: `Compte supprimé (id: ${id})`,
      meta: { userId: id },
    });
    return result;
  }

  // Modifier un compte (patron ou l'utilisateur lui-même uniquement)
  @Patch('users/:id')
  @UseGuards(AuthGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; phone?: string; password?: string; oldPassword?: string; caisseId?: string | null },
    @Req() req: Request,
  ) {
    const user = (req as any)['user'];
    if (user.role !== 'patron' && String(user.sub) !== id) {
      throw new ForbiddenException('Accès non autorisé');
    }
    const result = await this.authService.updateUser(id, body);
    this.auditService.log({
      type: 'modification', module: 'utilisateurs',
      actorName: user.name, actorRole: user.role,
      detail: `Compte modifié (id: ${id})${body.name ? ` → ${body.name}` : ''}`,
      meta: { userId: id, fields: Object.keys(body).filter(k => k !== 'password' && k !== 'oldPassword') },
    });
    return result;
  }

  // Mot de passe oublié — pas d'auth requise
  @Post('forgot-password')
  @ThrottleMotDePasseOublie()
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }
}
