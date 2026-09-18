import { execFile } from 'node:child_process';
import { extractRawText } from 'mammoth';
import { BASE_RESUME_SCHEMA } from '../contracts/resume-schema';
import { presentResume } from './presentation';
import { renderDocx, renderPdf } from './renderers';
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const schema = {
  ...BASE_RESUME_SCHEMA,
  properties: {
    ...BASE_RESUME_SCHEMA.properties,
    education: { type: 'string' as const },
    available: { type: 'boolean' as const },
    score: { type: 'number' as const },
  },
};
const data = {
  basics: {},
  professionalSummary: 'Inżynier oprogramowania — Łódź. Ελληνικά. Привет.',
  workExperience: Array.from({ length: 18 }, (_, i) => ({
    employer: `Example Labs ${i + 1}`,
    role: 'Software Engineer',
    startDate: '2020',
    endDate: '2024',
    highlights: ['Built reliable internal tools using TypeScript and MongoDB.'],
  })),
  skills: [{ category: 'Languages', items: ['TypeScript'] }],
  education: 'Computer Science, Example University',
  available: false,
  score: 0,
};
const pii = {
  name: 'Synthetic Applicant',
  email: 'applicant@example.test',
  contactNumber: '+1 555 123 4567',
  location: 'Warsaw, Poland',
};
it('PDF embeds Unicode, contact details and additional fields across pages', async () => {
  const buffer = await renderPdf(presentResume(schema, data, pii), font);
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  const text = await new Promise<string>((resolve, reject) => {
    const child = execFile(
      'pdftotext',
      ['-', '-'],
      { timeout: 5000 },
      (error, stdout) =>
        error
          ? reject(new Error('PDF text extraction failed'))
          : resolve(stdout),
    );
    child.stdin!.end(buffer);
  });
  for (const value of [
    'Synthetic Applicant',
    'applicant@example.test',
    'Inżynier',
    'Ελληνικά',
    'Привет',
    'Example Labs 18',
    'Example University',
    'Available: No',
    'Score: 0',
  ])
    expect(text).toContain(value);
  expect(text.split('\f').length).toBeGreaterThan(2);
});
it('DOCX contains the same Unicode, contact details and discovered sections', async () => {
  const buffer = await renderDocx(presentResume(schema, data, pii));
  expect(buffer.subarray(0, 2).toString()).toBe('PK');
  const text = (await extractRawText({ buffer })).value;
  expect(text).toContain('Inżynier');
  expect(text).toContain('Example Labs 18');
  expect(text).toContain('applicant@example.test');
  expect(text).toContain('Example University');
  expect(text).toContain('Available: No');
});
it('missing fonts and unsupported glyphs fail without producing a misleading PDF', async () => {
  await expect(
    renderPdf([{ text: 'Test', kind: 'body', depth: 0 }], '/missing/font.ttf'),
  ).rejects.toThrow();
  await expect(
    renderPdf([{ text: '漢字', kind: 'body', depth: 0 }], font),
  ).rejects.toThrow('font does not support');
});
