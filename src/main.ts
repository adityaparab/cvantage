import { AppConfig } from './config/app-config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // All backend routes live under /api so they never collide with the
  // client-side routes of the React SPA served from ./client/dist.
  app.setGlobalPrefix('api');
  app.useBodyParser('json', { limit: '2mb' });

  app.enableShutdownHooks();
  const port = app.get(AppConfig).values.PORT;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
void bootstrap().catch(() => {
  console.error(
    'Application startup failed. Check configuration and service availability.',
  );
  process.exitCode = 1;
});
