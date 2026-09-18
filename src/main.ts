import { AppConfig } from './config/app-config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { startupFailureMessage } from './startup-error';

async function bootstrap() {
  let app: NestExpressApplication | undefined;
  try {
    // Keep raw dependency errors out of Nest's startup logger and handle them
    // here instead of letting the factory abort before our diagnostics run.
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      abortOnError: false,
      logger: false,
    });
    app.setGlobalPrefix('api');
    app.useBodyParser('json', { limit: '2mb' });
    app.enableShutdownHooks();
    const port = app.get(AppConfig).values.PORT;
    await app.listen(port);
    app.useLogger(new Logger());
    console.log(`Server running on http://localhost:${port}`);
  } catch (error) {
    console.error(
      `Application startup failed. ${startupFailureMessage(error)}`,
    );
    try {
      await app?.close();
    } catch {
      console.error('Application cleanup failed after the startup error.');
    }
    process.exitCode = 1;
  }
}
void bootstrap();
