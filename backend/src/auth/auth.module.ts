import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { User, UserSchema } from '../schemas/user.schema';
import { AuditLog, AuditLogSchema } from '../schemas/audit-log.schema';
import { getJwtSecret } from '../config/jwt-secret';
import { Settings, SettingsSchema } from '../settings/settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name,     schema: UserSchema     },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Settings.name, schema: SettingsSchema },
    ]),
    JwtModule.register({
      global: true,
      secret: getJwtSecret(),
      // 24 h par défaut (renouvellement glissant via POST /api/auth/refresh).
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthGuard, RolesGuard, AuthService],
})
export class AuthModule {}
