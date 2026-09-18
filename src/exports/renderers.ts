import PDFDocument from 'pdfkit';
import { openSync } from 'fontkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { BadRequestException } from '@nestjs/common';
import type { Block } from './presentation';
export async function renderPdf(
  blocks: Block[],
  fontPath: string,
): Promise<Buffer> {
  const font = openSync(fontPath);
  if (!('hasGlyphForCodePoint' in font))
    throw new BadRequestException(
      'Configure a single-font TTF/OTF file for PDF exports',
    );
  if (
    blocks.some((block) =>
      Array.from(block.text).some(
        (char) =>
          !/[\s\u200b-\u200d]/.test(char) &&
          !font.hasGlyphForCodePoint(char.codePointAt(0)!),
      ),
    )
  )
    throw new BadRequestException(
      'The PDF font does not support some characters. Download DOCX or configure a font covering this language.',
    );
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    font: fontPath,
    info: { Title: 'Resume', Author: '', Creator: 'CVantage' },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  try {
    for (const block of blocks) {
      const heading = block.kind === 'heading';
      const size =
        block.kind === 'title'
          ? 23
          : heading
            ? block.depth
              ? 11
              : 14
            : block.kind === 'contact'
              ? 9
              : 10;
      if (heading && doc.y > doc.page.height - 110) doc.addPage();
      doc
        .fontSize(size)
        .fillColor(block.kind === 'title' || heading ? '#245b48' : '#25332d');
      doc.text(block.text, 48 + Math.min(block.depth, 3) * 10, doc.y, {
        width: doc.page.width - 96 - Math.min(block.depth, 3) * 10,
        lineGap: 3,
        paragraphGap: 5,
      });
      doc.moveDown(heading ? 0.35 : 0.2);
    }
    doc.end();
  } catch (error) {
    doc.destroy();
    throw error;
  }
  return result;
}
export function renderDocx(blocks: Block[]): Promise<Buffer> {
  const document = new Document({
    creator: 'CVantage',
    title: 'Resume',
    styles: {
      default: {
        document: {
          run: { font: 'DejaVu Sans', size: 21 },
          paragraph: { spacing: { after: 100 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children: blocks.map(
          (block) =>
            new Paragraph({
              heading:
                block.kind === 'title'
                  ? HeadingLevel.TITLE
                  : block.kind === 'heading'
                    ? block.depth
                      ? HeadingLevel.HEADING_2
                      : HeadingLevel.HEADING_1
                    : undefined,
              keepNext: block.kind === 'heading' || block.kind === 'title',
              indent: { left: Math.min(block.depth, 3) * 160 },
              children: [
                new TextRun({
                  text: block.text,
                  color:
                    block.kind === 'title' || block.kind === 'heading'
                      ? '245B48'
                      : '25332D',
                  size:
                    block.kind === 'title'
                      ? 44
                      : block.kind === 'heading'
                        ? block.depth
                          ? 23
                          : 28
                        : block.kind === 'contact'
                          ? 18
                          : 21,
                }),
              ],
            }),
        ),
      },
    ],
  });
  return Packer.toBuffer(document);
}
