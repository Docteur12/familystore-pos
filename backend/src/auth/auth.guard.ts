import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { getJwtSecret } from '../config/jwt-secret';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }
    // Résolu HORS du try : une configuration manquante doit remonter telle
    // quelle, pas être masquée en « token invalide » par le catch ci-dessous.
    const secret = getJwtSecret();
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, { secret });
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
    // Version minimale du jeton : les jetons v1 (durée 30 j, PIN de caisse en
    // clair dans le payload) sont révoqués — l'utilisateur se reconnecte une
    // fois et repart avec un jeton v2 propre.
    if ((payload.v ?? 1) < 2) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
    request['user'] = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
