import {
  Body,
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import type { AuthRequest } from '../auth/session.guard';
import { ExportsService } from './exports.service';
@Controller('resumes/:id/export')
@UseGuards(SessionGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  async download(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { buffer, format } = await this.exports.create(
      req.session.ownerId,
      id,
      body,
    );
    return new StreamableFile(buffer, {
      type:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      disposition: `attachment; filename="resume.${format}"`,
      length: buffer.length,
    });
  }
}
