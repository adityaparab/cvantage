import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ResumeRepository } from '../database/resume.repository';
import { SessionGuard } from '../auth/session.guard';
import type { AuthRequest } from '../auth/session.guard';
@Controller('resumes')
@UseGuards(SessionGuard)
export class ResumesController {
  constructor(private readonly resumes: ResumeRepository) {}
  @Get() list(@Req() request: AuthRequest) {
    return this.resumes.list(request.session.ownerId);
  }
  @Get(':id') get(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.resumes.get(request.session.ownerId, id);
  }
  @Get(':id/pii') async pii(
    @Req() request: AuthRequest,
    @Param('id') id: string,
  ) {
    await this.resumes.get(request.session.ownerId, id);
    return this.resumes.getPii(request.session.ownerId, id);
  }
}
