import type { ResumeData } from '../contracts/resume-schema';

export abstract class DocumentExtractor {
  abstract extract(
    bytes: Buffer,
    extension: 'pdf' | 'docx' | 'doc',
  ): Promise<string>;
}
export type ModelEvent =
  { type: 'delta'; text: string } | { type: 'retry'; attempt: number };
export type ModelObserver = (event: ModelEvent) => Promise<void>;
export abstract class ModelGateway {
  abstract generate(
    role: 'worker' | 'judge',
    instructions: string,
    data: unknown,
    observe?: ModelObserver,
  ): Promise<unknown>;
}
export abstract class ResumeRenderer {
  abstract render(
    data: ResumeData,
    pii: Record<string, string>,
    format: 'pdf' | 'docx',
  ): Promise<Buffer>;
}
