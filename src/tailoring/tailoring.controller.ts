import { JobDescriptionService } from './job-description.service';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import type { AuthRequest } from '../auth/session.guard';
import { TailoringService } from './tailoring.service';
@Controller('resumes/:resumeId')
@UseGuards(SessionGuard)
export class TailoringController {
  constructor(
    private readonly service: TailoringService,
    private readonly jobs: JobDescriptionService,
  ) {}
  @Post('job-description') import(
    @Req() req: AuthRequest,
    @Param('resumeId') id: string,
    @Body() input: unknown,
  ) {
    return this.jobs.import(req.session.ownerId, id, input);
  }
  @Post('tailor') create(
    @Req() req: AuthRequest,
    @Param('resumeId') id: string,
    @Body() input: unknown,
  ) {
    return this.service.start(req.session.ownerId, id, input);
  }
  @Get('variants') list(
    @Req() req: AuthRequest,
    @Param('resumeId') id: string,
  ) {
    return this.service.list(req.session.ownerId, id);
  }
  @Get('variants/:id') get(
    @Req() req: AuthRequest,
    @Param('resumeId') resumeId: string,
    @Param('id') id: string,
  ) {
    return this.service.get(req.session.ownerId, resumeId, id);
  }
  @Patch('variants/:id') edit(
    @Req() req: AuthRequest,
    @Param('resumeId') resumeId: string,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.service.update(req.session.ownerId, resumeId, id, input);
  }
}
