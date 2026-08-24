import { Injectable } from '@nestjs/common';
import { MARQUE_PRODUIT } from './config/marque';

@Injectable()
export class AppService {
  getHealth(): object {
    return { status: 'ok', app: process.env.APP_NAME ?? MARQUE_PRODUIT, timestamp: new Date().toISOString() };
  }
}
