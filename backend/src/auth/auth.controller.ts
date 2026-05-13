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

@Controller('auth')
export class AuthController {
  constructor(
    private authService:  AuthService,
    private auditService: AuditService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    const result = await this.authService.login(body.email, body.password);
    this.auditService.log({
      type: 'connexion', module: 'auth',
      actorName: result.user.name,
      actorRole: result.user.role,
      detail: `Connexion de ${result.user.name}`,
    });
    return result;
  }

  // Création d'utilisateur réservée au patron
  @Post('register')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron')
  async register(
    @Body()
    body: { name: string; email: string; password: string; role: 'caissier' | 'patron' | 'gestionnaire'; phone?: string; caisseId?: string; assignedLocation?: string },
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
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }
}
