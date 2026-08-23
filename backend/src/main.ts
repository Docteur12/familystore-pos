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

  // Le frontend passe par le proxy Netlify (/api/* → Render) : sans cette
  // ligne, req.ip vaut l'adresse du proxy et TOUS les clients partagent le
  // même compteur de limitation de débit — 5 connexions par minute pour
  // l'ensemble des utilisateurs. On remonte donc l'IP réelle via
  // X-Forwarded-For.
  //
  // La valeur = nombre de proxys de confiance devant l'application
  // (Netlify + Render = 2). À vérifier après déploiement : si la limitation
  // se déclenche trop tôt, ajuster TRUST_PROXY_HOPS sans toucher au code.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 2);
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);

  // Corps BRUT conservé pour le seul webhook de paiement : une signature se
  // calcule sur les octets reçus, et JSON.parse suivi de JSON.stringify ne
  // les restitue pas à l'identique (ordre des clés, espaces, échappements).
  // Restreint à cette route pour ne pas garder une copie de chaque corps —
  // la limite est à 10 Mo.
  app.use(json({
    limit: '10mb',
    verify: (req: any, _res, buf: Buffer) => {
      if (typeof req.url === 'string' && req.url.startsWith('/api/paiements/webhook')) {
        req.rawBody = Buffer.from(buf);
      }
    },
  }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  // CORS restreint aux origines connues (phase 3 — sécurisation). Nécessaire :
  // le site Radiance appelle ce type de backend en direct (VITE_API_BASE),
  // sans proxy. Surcharge par CORS_ORIGINS (liste séparée par des virgules) ;
  // en développement, les ports Vite locaux sont acceptés d'office.
  const corsOrigins = (process.env.CORS_ORIGINS ??
    'https://familystore-pos.netlify.app,https://radiance-pos.netlify.app')
    .split(',').map(o => o.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => {
      // Sans en-tête Origin (curl, healthchecks, app Electron en file://) : autorisé.
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
      return cb(null, false);
    },
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Réponse minimale avec taille annoncée (Content-Length) et fin de connexion :
  // sans cela la réponse partait en « Transfer-Encoding: chunked », que le
  // robot keep-alive (cron-job.org) rejetait en « sortie trop grande ».
  app.use('/api/health', (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Length': '2',
      'Connection': 'close',
    });
    res.end('ok');
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`${process.env.APP_NAME ?? 'Family Store POS'} backend running on http://localhost:${port}/api`);
}
bootstrap();
