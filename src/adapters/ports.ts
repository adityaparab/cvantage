import type { ResumeData } from '../contracts/resume-schema';

export abstract class DocumentExtractor {
  abstract extract(
    bytes: Buffer,
    extension: 'pdf' | 'docx' | 'doc',
  ): Promise<string>;
}
export abstract class ModelGateway {
  abstract generate(
    role: 'worker' | 'judge',
    instructions: string,
    data: unknown,
  ): Promise<unknown>;
}
export abstract class ResumeRenderer {
  abstract render(
    data: ResumeData,
    pii: Record<string, string>,
    format: 'pdf' | 'docx',
  ): Promise<Buffer>;
}
