import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('MONGO_URI:', process.env.MONGO_URI ? 'définie' : 'MANQUANTE');
  // bodyParser désactivé pour le reconfigurer avec une limite plus large :
  // la limite Express par défaut (100 Ko) rejetait le logo du magasin en
  // base64 (413) et pouvait faire échouer l'archivage des factures PDF.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.use('/api/health', (_req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send('ok');
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Family Store POS backend running on http://localhost:${port}/api`);
}
bootstrap();
