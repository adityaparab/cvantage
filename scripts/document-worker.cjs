const { parentPort, workerData } = require('node:worker_threads');
const { spawn } = require('node:child_process');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const yauzl = require('yauzl');
const bytes = Buffer.from(workerData.bytes);
const MAX_TEXT = 1_000_000;
function inspectDocx(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      let total = 0, count = 0, hasDocument = false;
      zip.on('error', reject);
      zip.on('entry', (entry) => {
        total += entry.uncompressedSize; count++;
        if (total > 50_000_000 || count > 1000 || /vbaProject\.bin$/i.test(entry.fileName)) {
          zip.close(); reject(new Error('Unsupported archive')); return;
        }
        if (entry.fileName === 'word/document.xml') hasDocument = true;
        zip.readEntry();
      });
      zip.on('end', () => hasDocument ? resolve() : reject(new Error('Not a Word document')));
      zip.readEntry();
    });
  });
}
function pdfText(buffer) {
  return new Promise((resolve, reject) => {
    const child = spawn('prlimit', ['--as=268435456', '--cpu=15', '--', 'pdftotext', '-layout', '-', '-'], { stdio: ['pipe', 'pipe', 'ignore'] });
    process.once('exit', () => child.kill('SIGKILL'));
    let length = 0; const chunks = [];
    const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.stdout.on('data', (chunk) => { length += chunk.length; if (length > MAX_TEXT) child.kill('SIGKILL'); else chunks.push(chunk); });
    child.on('error', reject);
    child.stdin.on('error', () => {});
    child.on('close', (code) => { clearTimeout(timer); code === 0 && length <= MAX_TEXT ? resolve(Buffer.concat(chunks).toString('utf8')) : reject(new Error('PDF extraction failed')); });
    child.stdin.end(buffer);
  });
}
async function extract() {
  let text;
  if (workerData.extension === 'pdf') text = await pdfText(bytes);
  else if (workerData.extension === 'docx') {
    await inspectDocx(bytes);
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  } else {
    const document = await new WordExtractor().extract(bytes);
    text = document.getBody() + '\n' + document.getHeaders() + '\n' + document.getFootnotes();
  }
  if (typeof text !== 'string' || text.length > MAX_TEXT || !text.trim()) throw new Error('No readable text');
  parentPort.postMessage({ text: text.trim() });
}
extract().catch(() => parentPort.postMessage({ error: 'Unable to extract readable text. Use an unencrypted text-based PDF, DOCX, or DOC. Scanned documents require OCR and are not supported yet.' }));
