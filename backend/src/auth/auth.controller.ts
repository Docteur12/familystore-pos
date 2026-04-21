import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
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
    body: { name: string; email: string; password: string; role: 'caissier' | 'patron' },
  ) {
    return this.authService.register(body.name, body.email, body.password, body.role ?? 'caissier');
  }

  // Liste des utilisateurs (patron only)
  @Get('users')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron')
  findAll() {
    return this.authService.findAll();
  }
}
