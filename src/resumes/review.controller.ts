import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import type { AuthRequest } from '../auth/session.guard';
import { SchemaRepository } from '../database/schema.repository';
import { EditingService } from './editing.service';
@Controller()
@UseGuards(SessionGuard)
export class ReviewController {
  constructor(
    private readonly editing: EditingService,
    private readonly schemas: SchemaRepository,
  ) {}
  @Get('parsing-jobs/:id/review') review(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.editing.review(req.session.ownerId, id);
  }
  @Post('parsing-jobs/:id/review') approve(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.editing.approve(req.session.ownerId, id, body);
  }
  @Get('resume-schemas/:version') async schema(
    @Param('version') version: string,
  ) {
    const schema = await this.schemas.get(Number(version));
    if (!schema) throw new NotFoundException('Schema not found');
    return schema;
  }
}
