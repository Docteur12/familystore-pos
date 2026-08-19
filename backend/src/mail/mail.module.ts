import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailService } from './mail.service';
import { Settings, SettingsSchema } from '../settings/settings.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Settings.name, schema: SettingsSchema }])],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
