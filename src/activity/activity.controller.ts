import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard, sessionCookie } from '../auth/session.guard';
import type { AuthRequest } from '../auth/session.guard';
import { AuthService } from '../auth/auth.service';
import { ActivityService } from './activity.service';

@Controller('workflows')
@UseGuards(SessionGuard)
export class ActivityController {
  constructor(
    private readonly activity: ActivityService,
    private readonly auth: AuthService,
  ) {}
  @Get() list(@Req() req: AuthRequest) {
    return this.activity.list(req.session.ownerId);
  }
  @Get(':id') get(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.activity.get(req.session.ownerId, id);
  }
  @Get(':id/events') async events(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const initial = await this.activity.get(req.session.ownerId, id);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    let previous = JSON.stringify(initial);
    res.write(`data: ${previous}\n\n`);
    let busy = false;
    let heartbeat = Date.now();
    const timer = setInterval(() => {
      void tick();
    }, 400);
    function stop() {
      clearInterval(timer);
      res.end();
    }
    res.on('close', () => clearInterval(timer));
    const tick = async () => {
      if (busy || res.destroyed) return;
      busy = true;
      try {
        // Revocation/expiry is enforced throughout the connection, including logout in another tab.
        await this.auth.session(sessionCookie(req));
        const value = await this.activity.get(req.session.ownerId, id);
        const serialized = JSON.stringify(value);
        if (serialized !== previous) {
          if (!res.write(`data: ${serialized}\n\n`)) {
            stop();
            return;
          }
          previous = serialized;
        } else if (Date.now() - heartbeat > 15_000) {
          res.write(': heartbeat\n\n');
          heartbeat = Date.now();
        }
        if (value.status === 'completed') stop();
      } catch {
        res.write('event: unavailable\ndata: {}\n\n');
        stop();
      } finally {
        busy = false;
      }
    };
  }
}
