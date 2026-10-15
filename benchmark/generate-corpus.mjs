import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

const CORPUS_DIR = path.join(process.cwd(), 'benchmark', 'corpus-v2');
if (!fs.existsSync(CORPUS_DIR)) {
  fs.mkdirSync(CORPUS_DIR, { recursive: true });
}

// Just copy a bunch of test fixtures into our corpus
const fixtures = path.join(process.cwd(), 'test-fixtures');
const toCopy = [
  'alpha-photo-heavy.pdf',
  'alpha-presentation.pdf',
  'alpha-scanned.pdf',
  'phase7-png-only.pdf',
  'phase7-text-only.pdf',
  'large-image.pdf'
];

for(const f of toCopy) {
   fs.copyFileSync(path.join(fixtures, f), path.join(CORPUS_DIR, f));
   console.log(`Copied ${f}`);
}

async function createPDF(name, buildFn) {
  const doc = await PDFDocument.create();
  await buildFn(doc);
  const bytes = await doc.save();
  fs.writeFileSync(path.join(CORPUS_DIR, name), bytes);
  console.log(`Created ${name} (${(bytes.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const opaquePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
  
  const sampleJpg = fs.readFileSync(path.join(fixtures, 'sample.jpg')); // 600x400
  
  await createPDF('high-dpi-proxy.pdf', async (doc) => {
    const img = await doc.embedJpg(sampleJpg);
    const page = doc.addPage([100, 100]); 
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });
  });

  await createPDF('transparent-safety.pdf', async (doc) => {
    const img = await doc.embedPng(transparentPng);
    const page = doc.addPage([100, 100]);
    page.drawImage(img, { x: 10, y: 10, width: 80, height: 80 });
  });
}
main().catch(console.error);
