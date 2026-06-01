import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { User, UserSchema } from '../schemas/user.schema';
import { AuditLog, AuditLogSchema } from '../schemas/audit-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name,     schema: UserSchema     },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'fallback_secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthGuard, RolesGuard, AuthService],
})
export class AuthModule {}
