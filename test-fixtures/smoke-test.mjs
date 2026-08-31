// Quick Node smoke-test of pdf-lib inspection logic.
// Mirrors the logic in src/lib/pdfInspector.ts to verify
// behavior for all test fixtures before loading in Chrome.
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';

async function inspectBytes(label, bytes) {
  if (bytes.length === 0) {
    console.log(`⚠️  ${label}: empty file (caught before pdf-lib)`);
    return;
  }
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    console.log(`✅ ${label}: ok=true, pages=${doc.getPageCount()}, bytes=${bytes.length}`);
  } catch (err) {
    const msg = err.message ?? '';
    const name = err.name ?? '';
    const isEncrypted =
      name === 'EncryptedPDFError' ||
      msg.toLowerCase().includes('encrypt') ||
      msg.toLowerCase().includes('password');
    if (isEncrypted) {
      console.log(`🔒 ${label}: ok=false, reason=encrypted`);
    } else {
      console.log(`❌ ${label}: ok=false, reason=malformed — ${name}: ${msg.slice(0, 100)}`);
    }
  }
}

const fixtures = [
  ['normal-text.pdf', readFileSync('test-fixtures/normal-text.pdf')],
  ['three-page.pdf',  readFileSync('test-fixtures/three-page.pdf')],
  ['malformed.pdf',   readFileSync('test-fixtures/malformed.pdf')],
  ['empty.pdf',       readFileSync('test-fixtures/empty.pdf')],
  ['encrypted.pdf',   readFileSync('test-fixtures/encrypted.pdf')],
  ['not-a-pdf.pdf',   readFileSync('test-fixtures/not-a-pdf.pdf')],
];

for (const [label, bytes] of fixtures) {
  await inspectBytes(label, bytes);
}
