import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return { status: 'ok', app: process.env.APP_NAME ?? 'Family Store POS', timestamp: new Date().toISOString() };
  }
}
