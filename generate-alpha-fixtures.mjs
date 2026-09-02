import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'test-fixtures');

async function writePdf(name, bytes) {
  const outPath = path.join(FIXTURES_DIR, name);
  fs.writeFileSync(outPath, bytes);
  console.log(`✓ Generated ${name}`);
}

function loadSampleJpeg() {
  const candidates = [
    path.join(__dirname, 'jpeg', 'testimg.jpg'),
    path.join(FIXTURES_DIR, 'sample.jpg'),
    path.join(__dirname, 'img1.jpg')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  return null;
}

// Generate a large dummy JPEG in memory (not real image data, just to hit size thresholds if needed, but PDFLib might complain if it's not a real JPEG).
// It's better to use an existing JPG.
const img1Path = path.join(__dirname, 'img1.jpg');
const img2Path = path.join(__dirname, 'img2.jpg');
const img1Bytes = fs.existsSync(img1Path) ? fs.readFileSync(img1Path) : loadSampleJpeg();
const img2Bytes = fs.existsSync(img2Path) ? fs.readFileSync(img2Path) : loadSampleJpeg();

async function createAlphaScanned() {
  if (!img1Bytes) return;
  const doc = await PDFDocument.create();
  const img = await doc.embedJpg(img1Bytes);
  for(let i=0; i<3; i++) {
      const page = doc.addPage([595, 842]);
      page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  }
  await writePdf('alpha-scanned.pdf', await doc.save());
}

async function createAlphaPhotoHeavy() {
  if (!img1Bytes || !img2Bytes) return;
  const doc = await PDFDocument.create();
  const imgA = await doc.embedJpg(img1Bytes);
  const imgB = await doc.embedJpg(img2Bytes);
  for(let i=0; i<4; i++) {
      const page = doc.addPage([595, 842]);
      page.drawImage(i % 2 === 0 ? imgA : imgB, { x: 50, y: 400, width: 400, height: 300 });
      page.drawImage(i % 2 !== 0 ? imgA : imgB, { x: 50, y: 50, width: 400, height: 300 });
  }
  await writePdf('alpha-photo-heavy.pdf', await doc.save());
}

async function createAlphaPresentation() {
  if (!img1Bytes) return;
  const doc = await PDFDocument.create();
  const img = await doc.embedJpg(img1Bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for(let i=0; i<5; i++) {
      const page = doc.addPage([1024, 768]); // Landscape
      page.drawImage(img, { x: 0, y: 0, width: 1024, height: 768, opacity: 0.2 });
      page.drawText(`Slide ${i+1}`, { x: 100, y: 600, size: 48, font, color: rgb(0.2, 0.2, 0.6) });
      page.drawText(`Key point number 1 for slide ${i+1}`, { x: 100, y: 500, size: 24, font });
      page.drawText(`Key point number 2 for slide ${i+1}`, { x: 100, y: 450, size: 24, font });
  }
  await writePdf('alpha-presentation.pdf', await doc.save());
}

async function main() {
  await createAlphaScanned();
  await createAlphaPhotoHeavy();
  await createAlphaPresentation();
}

main().catch(console.error);
