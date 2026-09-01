import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function verify() {
  const originalBytes = fs.readFileSync('test_fixture.pdf');
  const originalDoc = await PDFDocument.load(originalBytes);
  const originalPages = originalDoc.getPageCount();

  const compressedBytes = fs.readFileSync('downloads/test_fixture-compressed.pdf');
  const compressedDoc = await PDFDocument.load(compressedBytes);
  const compressedPages = compressedDoc.getPageCount();

  console.log(`Original pages: ${originalPages}`);
  console.log(`Compressed pages: ${compressedPages}`);

  if (originalPages === compressedPages) {
    console.log("SUCCESS: Page counts match.");
  } else {
    console.log("ERROR: Page counts differ.");
  }
}

verify().catch(console.error);
