import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Serve the compiled React SPA (client/dist) for every non-API request.
    // Any unknown path (e.g. a deep link like /about) falls back to index.html
    // so the client-side router can take over — this is the SPA "404 redirect".
    // Requests under /api are excluded so they reach the controllers below
    // (and return a JSON 404 when no route matches, instead of index.html).
    ServeStaticModule.forRoot({
      // dist/app.module.js -> ../client/dist at runtime
      rootPath: join(__dirname, '..', 'client', 'dist'),
      exclude: ['/api/{*path}'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
