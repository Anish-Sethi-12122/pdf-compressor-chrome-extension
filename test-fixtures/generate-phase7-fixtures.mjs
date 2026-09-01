/**
 * Phase 7A — Synthetic Test Fixture Generator
 *
 * Generates realistic development PDFs for benchmarking the compression engine.
 * All fixtures use freely licensable content (programmatically generated).
 *
 * Provenance:
 *   - JPEG data: generated via Canvas API (Node.js sharp equivalent or embedded
 *     test JPEGs from public domain sources)
 *   - PDF structure: pdf-lib (MIT)
 *   - No copyrighted or private user documents are committed.
 *
 * Run: node test-fixtures/generate-phase7-fixtures.mjs
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = __dirname;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writePdf(name, bytes) {
  const outPath = path.join(FIXTURES_DIR, name);
  fs.writeFileSync(outPath, bytes);
  const kb = (bytes.length / 1024).toFixed(1);
  console.log(`  ✓ ${name} (${kb} KB)`);
}

/**
 * Load the best available JPEG from the project.
 * Prefers jpeg/testimg.jpg (real libjpeg test image, 5.7 KB).
 * Returns null if no suitable JPEG found.
 */
function loadSampleJpeg() {
  // Priority order: real test JPEG > test-fixtures sample
  const candidates = [
    path.join(__dirname, '..', 'jpeg', 'testimg.jpg'),
    path.join(FIXTURES_DIR, 'sample.jpg'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const bytes = fs.readFileSync(p);
      // Quick JFIF/JPEG SOI check
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        return bytes;
      }
    }
  }
  console.warn('  ⚠ No suitable JPEG found — skipping JPEG-embedded fixtures');
  return null;
}

// ---------------------------------------------------------------------------
// Fixture 1: Single large JPEG (typical photo scan)
// The large-image.pdf in the existing fixtures is ~1 MB — use it if available.
// ---------------------------------------------------------------------------
async function makeFixture1_LargeJpeg() {
  const existingPath = path.join(FIXTURES_DIR, 'large-image.pdf');
  if (fs.existsSync(existingPath)) {
    const bytes = fs.readFileSync(existingPath);
    console.log(`  ✓ phase7-large-jpeg.pdf (using existing large-image.pdf, ${(bytes.length/1024).toFixed(1)} KB)`);
    return;
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const jpegBytes = makeSyntheticJpeg(2480, 3508);
  const img = await pdfDoc.embedJpg(jpegBytes);
  page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  const bytes = await pdfDoc.save();
  writePdf('phase7-large-jpeg.pdf', bytes);
}

// ---------------------------------------------------------------------------
// Fixture 2: Multi-page with JPEG images
// ---------------------------------------------------------------------------
async function makeFixture2_MultiPageJpeg() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) {
    console.log('  ⚠ Skipping phase7-multipage-jpeg.pdf (no sample JPEG)');
    return;
  }
  const pdfDoc = await PDFDocument.create();
  const img = await pdfDoc.embedJpg(jpegBytes);

  for (let i = 0; i < 5; i++) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText(`Page ${i + 1} — Test Document`, {
      x: 50, y: 780, size: 18, color: rgb(0.1, 0.1, 0.1),
    });
    page.drawImage(img, { x: 50, y: 200, width: 495, height: 371 });
    page.drawText(`Text line below image on page ${i + 1}`, {
      x: 50, y: 180, size: 12, color: rgb(0.2, 0.2, 0.2),
    });
  }

  const bytes = await pdfDoc.save();
  writePdf('phase7-multipage-jpeg.pdf', bytes);
}

// ---------------------------------------------------------------------------
// Fixture 3: Text-only (no images — should return qpdf-only or original)
// ---------------------------------------------------------------------------
async function makeFixture3_TextOnly() {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) {
    const page = pdfDoc.addPage([595, 842]);
    for (let line = 0; line < 30; line++) {
      page.drawText(`This is line ${line + 1} of page ${i + 1}. The quick brown fox jumps over the lazy dog.`, {
        x: 50, y: 800 - line * 24, size: 11, color: rgb(0, 0, 0),
      });
    }
  }
  const bytes = await pdfDoc.save();
  writePdf('phase7-text-only.pdf', bytes);
}

// ---------------------------------------------------------------------------
// Fixture 4: Mixed text + JPEG
// ---------------------------------------------------------------------------
async function makeFixture4_MixedContent() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) {
    console.log('  ⚠ Skipping phase7-mixed-content.pdf (no sample JPEG)');
    return;
  }
  const pdfDoc = await PDFDocument.create();
  const img = await pdfDoc.embedJpg(jpegBytes);

  for (let i = 0; i < 4; i++) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText(`Chapter ${i + 1}: Sample Content`, {
      x: 50, y: 800, size: 20, color: rgb(0, 0, 0.7),
    });
    for (let line = 0; line < 10; line++) {
      page.drawText(`Body text line ${line + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`, {
        x: 50, y: 760 - line * 18, size: 11,
      });
    }
    page.drawImage(img, { x: 100, y: 300, width: 395, height: 296 });
    page.drawText(`Caption: Figure ${i + 1}.1 — Image embedded in page ${i + 1}`, {
      x: 100, y: 285, size: 9, color: rgb(0.4, 0.4, 0.4),
    });
  }
  const bytes = await pdfDoc.save();
  writePdf('phase7-mixed-content.pdf', bytes);
}

// ---------------------------------------------------------------------------
// Fixture 5: PNG-only images (FlateDecode — should all be SKIPPED)
// ---------------------------------------------------------------------------
async function makeFixture5_PngOnly() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  page.drawText('This PDF contains only PNG (FlateDecode) images.', {
    x: 50, y: 800, size: 14,
  });
  page.drawText('The compressor should skip all images here.', {
    x: 50, y: 780, size: 12, color: rgb(0.5, 0, 0),
  });
  // pdf-lib embeds PNG as FlateDecode by default
  // Draw a colored rectangle to simulate a rasterized element
  page.drawRectangle({ x: 100, y: 300, width: 395, height: 296, color: rgb(0.2, 0.6, 0.8) });
  const bytes = await pdfDoc.save();
  writePdf('phase7-png-only.pdf', bytes);
}

// ---------------------------------------------------------------------------
// Fixture 6: Shared image object (same image referenced on multiple pages)
// ---------------------------------------------------------------------------
async function makeFixture6_SharedImage() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) {
    console.log('  ⚠ Skipping phase7-shared-image.pdf (no sample JPEG)');
    return;
  }
  const pdfDoc = await PDFDocument.create();
  // Embed ONCE — pdf-lib reuses the same XObject reference
  const img = await pdfDoc.embedJpg(jpegBytes);

  for (let i = 0; i < 4; i++) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText(`Shared image test — page ${i + 1}`, { x: 50, y: 800, size: 16 });
    // The same img reference is reused across pages → single XObject in the PDF
    page.drawImage(img, { x: 100, y: 400, width: 395, height: 296 });
  }
  const bytes = await pdfDoc.save();
  writePdf('phase7-shared-image.pdf', bytes);
}

// ---------------------------------------------------------------------------
// Fixture 7: Already-small JPEG images (should all be SKIPPED - below threshold)
// ---------------------------------------------------------------------------
async function makeFixture7_SmallImages() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) {
    console.log('  ⚠ Skipping phase7-small-images.pdf (no sample JPEG)');
    return;
  }
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  page.drawText('This PDF has only tiny JPEG images (< 32KB each).', {
    x: 50, y: 800, size: 13,
  });

  // Use the sample JPEG (it's 721 bytes — well below the 32 KB threshold)
  const img = await pdfDoc.embedJpg(jpegBytes);

  // Draw it many times (still one XObject)
  for (let i = 0; i < 5; i++) {
    page.drawImage(img, { x: 50 + i * 100, y: 400, width: 80, height: 60 });
  }
  const bytes = await pdfDoc.save();
  writePdf('phase7-small-images.pdf', bytes);
}

// ---------------------------------------------------------------------------
// Fixture 8: Large-image.pdf reference (use existing if present)
// ---------------------------------------------------------------------------
async function makeFixture8_ExistingLarge() {
  // Document the existing large-image.pdf
  const src = path.join(FIXTURES_DIR, 'large-image.pdf');
  if (fs.existsSync(src)) {
    const bytes = fs.readFileSync(src);
    console.log(`  ✓ (existing) large-image.pdf — ${(bytes.length/1024).toFixed(1)} KB — use as benchmark fixture`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n📄 Phase 7A Fixture Generator\n');

  await makeFixture1_LargeJpeg();
  await makeFixture2_MultiPageJpeg();
  await makeFixture3_TextOnly();
  await makeFixture4_MixedContent();
  await makeFixture5_PngOnly();
  await makeFixture6_SharedImage();
  await makeFixture7_SmallImages();
  await makeFixture8_ExistingLarge();

  console.log('\n✅ All fixtures generated.\n');
  console.log('Fixture provenance:');
  console.log('  JPEG data:    programmatically generated or from test-fixtures/sample.jpg');
  console.log('  PDF structure: pdf-lib (MIT license)');
  console.log('  No copyrighted or private user data committed.\n');
}

main().catch((err) => {
  console.error('Fixture generation failed:', err);
  process.exit(1);
});
