import { EditingService } from './editing.service';
import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  Body,
  Patch,
} from '@nestjs/common';
import { ResumeRepository } from '../database/resume.repository';
import { SessionGuard } from '../auth/session.guard';
import type { AuthRequest } from '../auth/session.guard';
@Controller('resumes')
@UseGuards(SessionGuard)
export class ResumesController {
  constructor(
    private readonly resumes: ResumeRepository,
    private readonly editing: EditingService,
  ) {}
  @Get() list(@Req() request: AuthRequest) {
    return this.resumes.list(request.session.ownerId);
  }
  @Get(':id') get(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.resumes.get(request.session.ownerId, id);
  }
  @Patch(':id') update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.editing.update(req.session.ownerId, id, body);
  }
  @Patch(':id/pii') updatePii(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.editing.updatePii(req.session.ownerId, id, body);
  }
  @Get(':id/pii') async pii(
    @Req() request: AuthRequest,
    @Param('id') id: string,
  ) {
    await this.resumes.get(request.session.ownerId, id);
    return this.resumes.getPii(request.session.ownerId, id);
  }
}
