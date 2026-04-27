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
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  // Création d'utilisateur réservée au patron
  @Post('register')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron')
  register(
    @Body()
    body: { name: string; email: string; password: string; role: 'caissier' | 'patron' | 'gestionnaire'; phone?: string },
  ) {
    return this.authService.register(body.name, body.email, body.password, body.role ?? 'caissier', body.phone);
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
  deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }

  // Modifier un compte (patron ou l'utilisateur lui-même uniquement)
  @Patch('users/:id')
  @UseGuards(AuthGuard)
  updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; phone?: string; password?: string; oldPassword?: string },
    @Req() req: Request,
  ) {
    const user = (req as any)['user'];
    if (user.role !== 'patron' && String(user.sub) !== id) {
      throw new ForbiddenException('Accès non autorisé');
    }
    return this.authService.updateUser(id, body);
  }

  // Mot de passe oublié — pas d'auth requise
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }
}
