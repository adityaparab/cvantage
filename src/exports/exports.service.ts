import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ResumeRepository } from '../database/resume.repository';
import { SchemaRepository } from '../database/schema.repository';
import { TailoringService } from '../tailoring/tailoring.service';
import { AppConfig } from '../config/app-config';
import { exportSchema } from '../contracts/workflow';
import { validateResumeData } from '../contracts/resume-schema';
import { presentResume } from './presentation';
import { renderDocx, renderPdf } from './renderers';
@Injectable()
export class ExportsService {
  private active = 0;
  constructor(
    private readonly resumes: ResumeRepository,
    private readonly schemas: SchemaRepository,
    private readonly tailoring: TailoringService,
    private readonly config: AppConfig,
  ) {}
  async create(ownerId: string, resumeId: string, input: unknown) {
    const body = exportSchema.safeParse(input);
    if (!body.success) throw new BadRequestException('Choose PDF or DOCX');
    if (this.active >= 2)
      throw new HttpException('Exports are busy; try again shortly', 429);
    this.active++;
    try {
      const resume = await this.resumes.get(ownerId, resumeId);
      const variant = body.data.variantId
        ? await this.tailoring.get(ownerId, resumeId, body.data.variantId)
        : null;
      if (variant && variant.status !== 'reviewed')
        throw new BadRequestException(
          'Approve this tailored version before exporting',
        );
      const selected = variant ?? resume;
      const [schema, pii] = await Promise.all([
        this.schemas.get(selected.schemaVersion),
        this.resumes.getPii(ownerId, resumeId),
      ]);
      if (
        !schema ||
        !pii ||
        !validateResumeData(schema.definition, selected.data)
      )
        throw new BadRequestException(
          'This resume needs correction before export',
        );
      const blocks = presentResume(schema.definition, selected.data, pii);
      if (
        blocks.some((block) =>
          Array.from(block.text).some(
            (char) =>
              char.charCodeAt(0) < 32 &&
              ![9, 10, 13].includes(char.charCodeAt(0)),
          ),
        )
      )
        throw new BadRequestException(
          'Remove unsupported control characters before export',
        );
      if (JSON.stringify(blocks).length > 300_000)
        throw new BadRequestException(
          'This resume is too long to export; shorten the content and try again',
        );
      let buffer: Buffer;
      try {
        buffer =
          body.data.format === 'pdf'
            ? await renderPdf(blocks, this.config.values.EXPORT_FONT_PATH)
            : await renderDocx(blocks);
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new ServiceUnavailableException(
          'Document rendering failed; check the server font configuration or try DOCX',
        );
      }
      return { buffer, format: body.data.format };
    } finally {
      this.active--;
    }
  }
}
