import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// Thanks to the global 'api' prefix (see main.ts), these routes are exposed at
// /api/hello and /api/health.
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
