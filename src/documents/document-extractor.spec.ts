import {
  documentExtension,
  LocalDocumentExtractor,
} from './document-extractor';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
it.each(['pdf', 'docx', 'doc'] as const)(
  'extracts real %s text in isolation',
  async (extension) => {
    const bytes = await readFile(
      join(
        process.cwd(),
        'test/fixtures',
        `cvantage-synthetic-resume.${extension}`,
      ),
    );
    expect(documentExtension(`resume.${extension}`, bytes)).toBe(extension);
    const result = await new LocalDocumentExtractor().extract(bytes, extension);
    expect(result).toContain('Synthetic Applicant');
    expect(result).toContain('TypeScript');
  },
);
it('rejects misleading extensions and oversize uploads', () => {
  expect(() =>
    documentExtension('resume.docx', Buffer.from('%PDF-fake')),
  ).toThrow();
  expect(() =>
    documentExtension('resume.pdf', Buffer.alloc(20_000_001)),
  ).toThrow();
  const exact = Buffer.alloc(20_000_000);
  exact.write('%PDF-');
  expect(documentExtension('resume.pdf', exact)).toBe('pdf');
});
it('rejects unreadable documents and cancellation', async () => {
  const extractor = new LocalDocumentExtractor();
  await expect(
    extractor.extract(Buffer.from('%PDF-corrupt'), 'pdf'),
  ).rejects.toThrow();
  await expect(
    extractor.extract(Buffer.from('%PDF-corrupt'), 'pdf', AbortSignal.abort()),
  ).rejects.toThrow('cancelled');
});
