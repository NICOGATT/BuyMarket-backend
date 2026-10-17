import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const defaultCorsOrigins = [
  'http://localhost:5173',
  "https://buy-market-web.vercel.app", 
  "https://hdphxs14-5173.brs.devtunnels.ms",
  "https://xwjbvbw0-5173.brs.devtunnels.ms", 
  "https://buymarket.com.ar", 
  "https://www.buymarket.com.ar",
  "https://buy-market-djckbqd0p-nicodev1.vercel.app"
];

function getCorsOrigins() {
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set([...defaultCorsOrigins, ...(configuredOrigins ?? [])]),
  );
}

// Vercel generates a new URL per preview deploy (buy-market-<hash>-nicodev1.vercel.app).
const vercelPreviewOrigin = /^https:\/\/buy-market-[a-z0-9]+-nicodev1\.vercel\.app$/;

function isAllowedOrigin(origin: string | undefined) {
  // Requests without Origin (curl, server-to-server, webhooks) are not CORS requests.
  if (!origin) return true;
  return getCorsOrigins().includes(origin) || vercelPreviewOrigin.test(origin);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ngrok-skip-browser-warning',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // app.useGlobalInterceptors(
  //   new ClassSerializerInterceptor(app.get(Reflector)),
  // );

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
