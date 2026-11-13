import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Validates and normalizes the body using the DTOs; rejects undeclared fields.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Frontend origin (by default, the web app dev server).
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:6020') });

  const port = config.get<number>('PORT', 8081);
  await app.listen(port);
  Logger.log(`onboarding listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
