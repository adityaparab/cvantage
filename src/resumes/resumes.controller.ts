import { EditingService } from './editing.service';
import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  Body,
  Patch,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
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
  @Delete(':id') delete(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    const body = z
      .object({ revision: z.number().int().min(0) })
      .strict()
      .safeParse(input);
    if (!body.success)
      throw new BadRequestException('Provide the current resume revision');
    return this.resumes.delete(req.session.ownerId, id, body.data.revision);
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
