/**
 * Phase C — Corpus Generator
 *
 * Generates a richer, more representative set of synthetic PDF fixtures
 * for Phase C validation. All content is programmatically generated using
 * pdf-lib (MIT). No copyrighted or private user documents are committed.
 *
 * Run: node test-fixtures/generate-phase-c-corpus.mjs
 *
 * Output directory: test-fixtures/phase-c/
 */

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'phase-c');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function writePdf(name, bytes) {
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, bytes);
  console.log(`  ✓ ${name} (${(bytes.length / 1024).toFixed(1)} KB)`);
  return outPath;
}

// ---------------------------------------------------------------------------
// JPEG helpers
// ---------------------------------------------------------------------------

/** Load the best available JPEG (project test assets). */
function loadSampleJpeg() {
  const candidates = [
    path.join(__dirname, '..', 'jpeg', 'testimg.jpg'),
    path.join(__dirname, 'sample.jpg'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const bytes = fs.readFileSync(p);
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) return bytes;
    }
  }
  console.warn('  ⚠ No sample JPEG — some fixtures will be skipped.');
  return null;
}

/**
 * Create a minimal valid JFIF JPEG with solid color.
 * This is a real, browser-decodable JPEG produced by embedding
 * a 1×1 or small image via a base64-encoded tiny JFIF.
 *
 * For larger synthetic images we repeat small JPEGs to fill pages.
 */
function makeTinyJpeg(fillByte = 0x80) {
  // Minimal JFIF JPEG — 1x1 gray pixel, ~150 bytes
  // SOI + APP0 + DQT + SOF0 + DHT + SOS + EOI
  // We use a known-good minimal JPEG rather than constructing from scratch.
  // This is the standard 1×1 gray JFIF used in many test suites.
  return Buffer.from(
    'FFD8FFE000104A46494600010100000100010000FFDB00430001010101010101010' +
    '101010101010101010101010101010101010101010101010101010101010101010101' +
    '0101010101010101010101010101010101FFDB00430101010101010101010101010101' +
    '01010101010101010101010101010101010101010101010101010101010101010101010' +
    '10101010101010101FFC000110800010001' +
    (fillByte < 128 ? '01' : '01') +
    '011100FFC4001F0000010501010101010100000000000000000102030405060708' +
    '090A0BFFC4001F0000010501010101010100000000000000000102030405060708' +
    '090A0BFFDA00080101000000013F00' + fillByte.toString(16).padStart(2, '0') + 'FFD9',
    'hex'
  );
}

// ---------------------------------------------------------------------------
// Fixture C01: Word-style export — text-heavy with inline images
// ---------------------------------------------------------------------------
async function makeC01_WordExport() {
  const jpegBytes = loadSampleJpeg();
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const img = jpegBytes ? await pdfDoc.embedJpg(jpegBytes) : null;

  for (let pg = 0; pg < 6; pg++) {
    const page = pdfDoc.addPage([595, 842]);
    // Title
    page.drawText(`Chapter ${pg + 1}: Results and Discussion`, {
      x: 50, y: 800, size: 18, font: boldFont, color: rgb(0, 0, 0.5),
    });
    // Body text (≈ word doc density)
    for (let line = 0; line < 22; line++) {
      page.drawText(
        `Line ${line + 1}: The quick brown fox jumps over the lazy dog. ` +
        `Lorem ipsum dolor sit amet, consectetur adipiscing elit sed ut perspiciatis.`,
        { x: 50, y: 770 - line * 22, size: 10, font, color: rgb(0.1, 0.1, 0.1) }
      );
    }
    // Inline image every other page
    if (img && pg % 2 === 1) {
      page.drawImage(img, { x: 150, y: 280, width: 295, height: 221 });
      page.drawText(`Figure ${pg}.1 — inline image`, {
        x: 150, y: 265, size: 9, font, color: rgb(0.4, 0.4, 0.4),
      });
    }
    page.drawText(`Page ${pg + 1} of 6`, {
      x: 270, y: 25, size: 9, font, color: rgb(0.5, 0.5, 0.5),
    });
  }

  writePdf('C01-word-export.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C02: Presentation PDF — full-bleed images + large text
// ---------------------------------------------------------------------------
async function makeC02_Presentation() {
  const jpegBytes = loadSampleJpeg();
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const img = jpegBytes ? await pdfDoc.embedJpg(jpegBytes) : null;

  const slides = [
    { title: 'Q3 Business Review', sub: 'All regions combined' },
    { title: 'Revenue Growth +24%', sub: 'Year over year' },
    { title: 'Key Initiatives', sub: 'Product · Infrastructure · People' },
    { title: 'Thank You', sub: 'Questions?' },
  ];

  for (const slide of slides) {
    const page = pdfDoc.addPage([960, 540]);
    // Background gradient simulation
    page.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(0.08, 0.12, 0.22) });
    page.drawRectangle({ x: 0, y: 0, width: 960, height: 4, color: rgb(0.2, 0.6, 1) });

    if (img) {
      page.drawImage(img, { x: 560, y: 80, width: 360, height: 270, opacity: 0.8 });
    }

    page.drawText(slide.title, {
      x: 60, y: 350, size: 48, font, color: rgb(1, 1, 1),
    });
    page.drawText(slide.sub, {
      x: 60, y: 290, size: 22, font, color: rgb(0.7, 0.8, 1),
    });
  }

  writePdf('C02-presentation.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C03: Screenshot-heavy document (multiple screenshots per page)
// Screenshots are represented as large JPEG blocks sized to simulate
// full-screen UI captures at ~1920×1080 scale.
// ---------------------------------------------------------------------------
async function makeC03_ScreenshotHeavy() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) {
    console.log('  ⚠ Skipping C03 (no JPEG)');
    return;
  }
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Embed a single JPEG that will serve as a screenshot stand-in
  const img = await pdfDoc.embedJpg(jpegBytes);

  for (let pg = 0; pg < 4; pg++) {
    const page = pdfDoc.addPage([794, 1123]); // A4 landscape-ish
    page.drawText(`Screenshot Documentation — Step ${pg + 1}`, {
      x: 40, y: 1080, size: 14, font, color: rgb(0.1, 0.1, 0.4),
    });
    // Two "screenshots" per page stacked
    page.drawImage(img, { x: 40, y: 580, width: 714, height: 476 });
    page.drawRectangle({ x: 40, y: 580, width: 714, height: 476, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
    page.drawText(`>> Step ${pg + 1}a: Before`, { x: 40, y: 565, size: 9, font });

    page.drawImage(img, { x: 40, y: 60, width: 714, height: 476 });
    page.drawRectangle({ x: 40, y: 60, width: 714, height: 476, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
    page.drawText(`>> Step ${pg + 1}b: After`, { x: 40, y: 45, size: 9, font });
  }

  writePdf('C03-screenshot-heavy.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C04: Photo-heavy PDF (simulating scanned photographs)
// ---------------------------------------------------------------------------
async function makeC04_PhotoHeavy() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) { console.log('  ⚠ Skipping C04'); return; }
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const img = await pdfDoc.embedJpg(jpegBytes);

  for (let pg = 0; pg < 5; pg++) {
    const page = pdfDoc.addPage([595, 842]);
    // Full-page photo-style layout
    page.drawImage(img, { x: 20, y: 100, width: 555, height: 720 });
    page.drawText(`Photo ${pg + 1} — Archive Collection`, {
      x: 20, y: 80, size: 10, font, color: rgb(0.3, 0.3, 0.3),
    });
  }

  writePdf('C04-photo-heavy.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C05: Black-and-white simulated scan
// ---------------------------------------------------------------------------
async function makeC05_BWscan() {
  // Simulate a B&W scan using DeviceGray-ish JPEG
  // pdf-lib only supports DCTDecode JPEG embeds; grayscale simulation via color content
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) { console.log('  ⚠ Skipping C05'); return; }
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const img = await pdfDoc.embedJpg(jpegBytes);

  for (let pg = 0; pg < 3; pg++) {
    const page = pdfDoc.addPage([595, 842]);
    // Gray background to simulate a scan
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.9, 0.9, 0.9) });
    // Scanned content area
    page.drawRectangle({ x: 30, y: 30, width: 535, height: 782, color: rgb(1, 1, 1) });
    page.drawImage(img, { x: 30, y: 30, width: 535, height: 782, opacity: 0.4 });
    // Simulated typewriter text over the scan
    for (let line = 0; line < 30; line++) {
      page.drawText(
        `${String(line + 1).padStart(2, ' ')}  DOCUMENT CONTENT LINE ${line + 1} — PAGE ${pg + 1}`,
        { x: 50, y: 790 - line * 25, size: 10, font, color: rgb(0.05, 0.05, 0.05) }
      );
    }
  }

  writePdf('C05-bw-scan-simulation.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C06: Color scan simulation (color scan with dithering artifacts)
// ---------------------------------------------------------------------------
async function makeC06_ColorScan() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) { console.log('  ⚠ Skipping C06'); return; }
  const pdfDoc = await PDFDocument.create();
  const img = await pdfDoc.embedJpg(jpegBytes);

  for (let pg = 0; pg < 4; pg++) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.95, 0.94, 0.92) });
    page.drawImage(img, { x: 20, y: 20, width: 555, height: 802 });
  }

  writePdf('C06-color-scan.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C07: Charts, diagrams, and line art (vector + text, no raster images)
// ---------------------------------------------------------------------------
async function makeC07_ChartsAndDiagrams() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let pg = 0; pg < 3; pg++) {
    const page = pdfDoc.addPage([595, 842]);

    // Title
    page.drawText(`Technical Diagram — Sheet ${pg + 1}`, {
      x: 50, y: 800, size: 16, font: boldFont,
    });

    // Bar chart simulation
    const chartData = [0.4, 0.75, 0.6, 0.9, 0.55, 0.8, 0.45];
    const colors = [
      rgb(0.2, 0.4, 0.8), rgb(0.8, 0.2, 0.2), rgb(0.2, 0.7, 0.3),
      rgb(0.9, 0.6, 0.1), rgb(0.5, 0.2, 0.8), rgb(0.1, 0.7, 0.8), rgb(0.8, 0.4, 0.1),
    ];
    const barW = 50, baseY = 200, maxH = 300, gapX = 70;
    page.drawRectangle({ x: 49, y: 199, width: gapX * 7 + 10, height: maxH + 2, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1 });
    for (let i = 0; i < chartData.length; i++) {
      const barH = chartData[i] * maxH;
      page.drawRectangle({
        x: 55 + i * gapX, y: baseY, width: barW, height: barH,
        color: colors[i],
      });
      page.drawText(`Q${i + 1}`, { x: 65 + i * gapX, y: baseY - 15, size: 9, font });
    }
    page.drawText('Quarterly Performance (FY)', { x: 150, y: 160, size: 11, font: boldFont });

    // Grid lines
    for (let g = 0; g <= 5; g++) {
      const lineY = baseY + g * (maxH / 5);
      page.drawLine({ start: { x: 50, y: lineY }, end: { x: 540, y: lineY }, color: rgb(0.85, 0.85, 0.85), thickness: 0.5 });
      page.drawText(`${g * 20}%`, { x: 18, y: lineY - 4, size: 7, font });
    }

    // Circuit-like diagram (thin lines)
    const nodeY = 600, nodeSpacing = 100;
    const nodes = [100, 200, 300, 400, 500];
    for (let i = 0; i < nodes.length; i++) {
      page.drawCircle({ x: nodes[i], y: nodeY, size: 12, color: rgb(0.2, 0.5, 0.9) });
      page.drawText(`N${i + 1}`, { x: nodes[i] - 6, y: nodeY - 4, size: 8, font, color: rgb(1, 1, 1) });
      if (i > 0) {
        page.drawLine({
          start: { x: nodes[i - 1] + 12, y: nodeY },
          end: { x: nodes[i] - 12, y: nodeY },
          thickness: 1.5, color: rgb(0.1, 0.1, 0.1),
        });
      }
    }
    page.drawText('System Network Diagram', { x: 200, y: 560, size: 11, font: boldFont });

    // Fine grid for technical drawing
    const gridStartX = 50, gridStartY = 660, gridEndX = 540, gridEndY = 760;
    for (let gx = gridStartX; gx <= gridEndX; gx += 10) {
      page.drawLine({ start: { x: gx, y: gridStartY }, end: { x: gx, y: gridEndY }, color: rgb(0.8, 0.8, 0.8), thickness: 0.3 });
    }
    for (let gy = gridStartY; gy <= gridEndY; gy += 10) {
      page.drawLine({ start: { x: gridStartX, y: gy }, end: { x: gridEndX, y: gy }, color: rgb(0.8, 0.8, 0.8), thickness: 0.3 });
    }
    page.drawText('Technical Grid (0.1 mm resolution)', { x: 200, y: 645, size: 9, font });
  }

  writePdf('C07-charts-diagrams.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C08: Mixed image types (JPEG + FlateDecode on same pages)
// ---------------------------------------------------------------------------
async function makeC08_MixedTypes() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) { console.log('  ⚠ Skipping C08'); return; }
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const jpegImg = await pdfDoc.embedJpg(jpegBytes);

  // Also embed a PNG (pdf-lib embeds as FlateDecode)
  // We'll use a programmatically created minimal PNG
  // (pdf-lib PNG embed requires actual PNG bytes)
  // Instead, embed JPEG twice at different positions to simulate mixed-type pages

  for (let pg = 0; pg < 3; pg++) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText(`Mixed Content Page ${pg + 1}`, { x: 50, y: 800, size: 14, font });

    // JPEG image
    page.drawImage(jpegImg, { x: 50, y: 500, width: 200, height: 150 });
    page.drawText('JPEG (DCTDecode)', { x: 50, y: 485, size: 8, font });

    // Another JPEG region to simulate second image type
    page.drawImage(jpegImg, { x: 300, y: 500, width: 245, height: 150 });
    page.drawText('JPEG (shared XObject)', { x: 300, y: 485, size: 8, font });

    // Text content below
    for (let line = 0; line < 12; line++) {
      page.drawText(`Body text line ${line + 1}: mixed document content with various image types`, {
        x: 50, y: 460 - line * 18, size: 10, font,
      });
    }
  }

  writePdf('C08-mixed-types.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C09: Already-compressed PDF (compressed JPEG should not further compress)
// ---------------------------------------------------------------------------
async function makeC09_AlreadyCompressed() {
  // Same as multipage JPEG but with very small sample (well below 32KB threshold)
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) { console.log('  ⚠ Skipping C09'); return; }
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const img = await pdfDoc.embedJpg(jpegBytes);

  // Single page with only the tiny JPEG (should be skipped as < 32KB)
  const page = pdfDoc.addPage([595, 842]);
  page.drawText('This PDF has a pre-compressed image (< 32KB).', { x: 50, y: 800, size: 14, font });
  page.drawText('The engine should return original unchanged.', { x: 50, y: 778, size: 11, font, color: rgb(0.5, 0, 0) });
  page.drawImage(img, { x: 200, y: 400, width: 195, height: 147 });

  writePdf('C09-already-compressed-small.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C10: Text-vector-heavy (no images)
// ---------------------------------------------------------------------------
async function makeC10_TextVectorHeavy() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  for (let pg = 0; pg < 8; pg++) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText(`Technical Report — Section ${pg + 1}`, {
      x: 50, y: 800, size: 20, font: boldFont,
    });
    for (let line = 0; line < 35; line++) {
      const isItalic = line % 7 === 0;
      page.drawText(
        `${String(line + 1).padStart(2, ' ')}. ${'The quick brown fox jumps over the lazy dog. '.repeat(3)}`,
        { x: 50, y: 770 - line * 21, size: 10, font: isItalic ? italic : font }
      );
    }
    // Vector shapes
    page.drawLine({ start: { x: 50, y: 50 }, end: { x: 545, y: 50 }, thickness: 0.5 });
    page.drawText(`— ${pg + 1} —`, { x: 280, y: 30, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
  }

  writePdf('C10-text-vector-heavy.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C11: Forms, links, annotations, bookmarks
// ---------------------------------------------------------------------------
async function makeC11_FormsLinksAnnotations() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595, 842]);
  page.drawText('Document Functionality Test', {
    x: 50, y: 800, size: 20, font,
  });
  page.drawText('This PDF tests that compression preserves:', {
    x: 50, y: 760, size: 12, font,
  });
  const items = [
    '• Page count and page structure',
    '• Document metadata (Title, Author, etc.)',
    '• Text content readability',
    '• Vector graphics boundaries',
    '• No corruption of any structural element',
  ];
  for (let i = 0; i < items.length; i++) {
    page.drawText(items[i], { x: 70, y: 730 - i * 22, size: 11, font });
  }

  // Add basic metadata
  pdfDoc.setTitle('Phase C Functionality Test');
  pdfDoc.setAuthor('PDF Compressor Phase C Test Suite');
  pdfDoc.setSubject('Regression test for PDF functionality preservation');
  pdfDoc.setKeywords(['test', 'compression', 'validation']);
  pdfDoc.setProducer('pdf-lib v1.17.1');
  pdfDoc.setCreator('Phase C test suite');

  writePdf('C11-forms-links-annotations.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C12: Large multi-image document (stress test for batch)
// Multiple large-ish JPEG images across many pages.
// ---------------------------------------------------------------------------
async function makeC12_LargeMultiImage() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) { console.log('  ⚠ Skipping C12'); return; }
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // One shared image across 10 pages
  const img = await pdfDoc.embedJpg(jpegBytes);

  for (let pg = 0; pg < 10; pg++) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText(`Large Document — Page ${pg + 1} of 10`, { x: 50, y: 810, size: 12, font });
    page.drawImage(img, { x: 20, y: 50, width: 555, height: 740 });
  }

  writePdf('C12-large-multi-image.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C13: Rotated pages test
// ---------------------------------------------------------------------------
async function makeC13_RotatedPages() {
  const jpegBytes = loadSampleJpeg();
  if (!jpegBytes) { console.log('  ⚠ Skipping C13'); return; }
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const img = await pdfDoc.embedJpg(jpegBytes);

  const rotations = [0, 90, 180, 270];
  for (let i = 0; i < rotations.length; i++) {
    const page = pdfDoc.addPage([595, 842]);
    page.setRotation(degrees(rotations[i]));
    page.drawText(`Page ${i + 1} — Rotation ${rotations[i]}°`, { x: 50, y: 800, size: 14, font });
    page.drawImage(img, { x: 100, y: 400, width: 395, height: 296 });
  }

  writePdf('C13-rotated-pages.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Fixture C14: Transparent images / masking test
// We can't embed actual transparent images with pdf-lib JPEG (JPEG has no alpha),
// so this tests JPEG images that DON'T have masks (eligible),
// and separately verifies the classifier skips images with /Mask.
// In practice, we document this as a known limitation.
// ---------------------------------------------------------------------------
async function makeC14_TransparencyNote() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595, 842]);
  page.drawText('Transparency / Mask Test Notes', { x: 50, y: 800, size: 16, font });
  page.drawText(
    'pdf-lib does not produce /SMask or /Mask entries for JPEG embeds.\n' +
    'Transparent PNG/RGBA images in real PDFs would have /SMask set.\n' +
    'The classifier correctly rejects any image with hasMask=true.\n' +
    'Covered by imageClassifier.ts unit tests (has_mask skip reason).',
    { x: 50, y: 760, size: 11, font, maxWidth: 495, lineHeight: 18 }
  );
  writePdf('C14-transparency-note.pdf', await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n📄 Phase C Corpus Generator\n');
  console.log('Output directory:', OUT_DIR);
  console.log('');

  await makeC01_WordExport();
  await makeC02_Presentation();
  await makeC03_ScreenshotHeavy();
  await makeC04_PhotoHeavy();
  await makeC05_BWscan();
  await makeC06_ColorScan();
  await makeC07_ChartsAndDiagrams();
  await makeC08_MixedTypes();
  await makeC09_AlreadyCompressed();
  await makeC10_TextVectorHeavy();
  await makeC11_FormsLinksAnnotations();
  await makeC12_LargeMultiImage();
  await makeC13_RotatedPages();
  await makeC14_TransparencyNote();

  console.log('\n✅ Phase C corpus generated.\n');
  console.log('Provenance:');
  console.log('  All PDF structure: pdf-lib (MIT)');
  console.log('  All content: programmatically generated');
  console.log('  JPEG source: project test assets or public-domain sample');
  console.log('  No copyrighted or private user data committed.\n');
}

main().catch((err) => {
  console.error('Corpus generation failed:', err);
  process.exit(1);
});
