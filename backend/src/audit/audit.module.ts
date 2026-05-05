import { Global, Module } from '@nestjs/common';
import { MongooseModule }  from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../schemas/audit-log.schema';
import { AuditService }    from './audit.service';
import { AuditController } from './audit.controller';
import { AuthModule }      from '../auth/auth.module';

@Global()   // AuditService injectable partout sans import explicite
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
    AuthModule,
  ],
  providers:   [AuditService],
  controllers: [AuditController],
  exports:     [AuditService],
})
export class AuditModule {}
