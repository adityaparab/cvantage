import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import type { AuthRequest } from './session.guard';
import { AppConfig } from '../config/app-config';
const credentials = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(12).max(128),
  })
  .strict();
@Controller('auth')
export class AuthController {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}
  private validate(request: Request, body: unknown) {
    if (
      request.headers['x-requested-with'] !== 'CVantage' ||
      !request.is('application/json') ||
      request.headers['sec-fetch-site'] === 'cross-site'
    )
      throw new ForbiddenException('Invalid request origin');
    const now = Date.now();
    for (const [key, entry] of this.attempts)
      if (entry.until < now) this.attempts.delete(key);
    const key = request.ip ?? 'unknown';
    if (!this.attempts.has(key) && this.attempts.size >= 10000)
      throw new HttpException('Try again later', 429);
    const limit = this.attempts.get(key) ?? {
      count: 0,
      until: now + 15 * 60000,
    };
    limit.count++;
    this.attempts.set(key, limit);
    if (limit.count > 20)
      throw new HttpException('Too many attempts; try again later', 429);
    const parsed = credentials.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Use a valid email and a password of 12–128 characters',
      );
    return parsed.data;
  }
  private respond(
    response: Response,
    result: Awaited<ReturnType<AuthService['login']>>,
  ) {
    response.cookie('cvantage_session', result.token, {
      httpOnly: true,
      secure: this.config.values.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
      maxAge: 7 * 86400000,
    });
    response.setHeader('Cache-Control', 'no-store');
    return {
      id: result.session.ownerId,
      email: result.session.email,
      csrfToken: result.session.csrfToken,
    };
  }
  @Post('register') async register(
    @Req() request: Request,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const value = this.validate(request, body);
    return this.respond(
      response,
      await this.auth.register(value.email, value.password),
    );
  }
  @Post('login') async login(
    @Req() request: Request,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const value = this.validate(request, body);
    return this.respond(
      response,
      await this.auth.login(value.email, value.password),
    );
  }
  @Get('me') @UseGuards(SessionGuard) me(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return {
      id: request.session.ownerId,
      email: request.session.email,
      csrfToken: request.session.csrfToken,
    };
  }
  @Post('logout') @UseGuards(SessionGuard) async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.session._id);
    response.clearCookie('cvantage_session', {
      path: '/api',
      sameSite: 'strict',
      secure: this.config.values.NODE_ENV === 'production',
      httpOnly: true,
    });
    return { ok: true };
  }
}
