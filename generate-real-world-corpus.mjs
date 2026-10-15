import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts, PDFName, PDFNumber } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REAL_WORLD_DIR = path.join(__dirname, 'test-fixtures', 'real-world');
if (!fs.existsSync(REAL_WORLD_DIR)) {
  fs.mkdirSync(REAL_WORLD_DIR, { recursive: true });
}

async function prepareRealWorldCorpus() {
  console.log('=== Preparing Phase C.1 Real-World & FlateDecode Corpus ===\n');

  // 1. RW01: Real Operating Systems Lab Document (Screenshots, Terminal text, diagrams)
  const sourceLab = 'D:\\PYTHON LOL\\C.EXE\\CS-207--Operating System Design\\25_CS_045_LAB_FILE.pdf';
  if (fs.existsSync(sourceLab)) {
    const labBytes = fs.readFileSync(sourceLab);
    // Extract first 5 pages to keep benchmark fast and focused
    const srcDoc = await PDFDocument.load(labBytes, { ignoreEncryption: true });
    const subDoc = await PDFDocument.create();
    const pageIndices = [0, 1, 2, 3, 4].filter(i => i < srcDoc.getPageCount());
    const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach(p => subDoc.addPage(p));
    const outBytes = await subDoc.save();
    const dest = path.join(REAL_WORLD_DIR, 'RW01_Lab_Screenshots_Code.pdf');
    fs.writeFileSync(dest, outBytes);
    console.log(`✓ RW01_Lab_Screenshots_Code.pdf: ${(outBytes.length / 1024).toFixed(1)} KB (Real Lab Report: UI Screenshots, Code, Tables)`);
  }

  // 2. RW02: Real Machine Learning Project Report (Matplotlib plots, curves, architecture diagrams)
  const sourceML = 'D:\\PYTHON LOL\\PYTHON.EXE\\ML\\CS-106\\Project\\Project_Report.pdf';
  if (fs.existsSync(sourceML)) {
    const mlBytes = fs.readFileSync(sourceML);
    const srcDoc = await PDFDocument.load(mlBytes, { ignoreEncryption: true });
    const subDoc = await PDFDocument.create();
    const pageIndices = [0, 1, 2, 3, 4, 5].filter(i => i < srcDoc.getPageCount());
    const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach(p => subDoc.addPage(p));
    const outBytes = await subDoc.save();
    const dest = path.join(REAL_WORLD_DIR, 'RW02_ML_Report_Charts_Plots.pdf');
    fs.writeFileSync(dest, outBytes);
    console.log(`✓ RW02_ML_Report_Charts_Plots.pdf: ${(outBytes.length / 1024).toFixed(1)} KB (Real ML Report: Training Curves, Architecture Diagrams)`);
  }

  // 3. RW03: Real Architecture Presentation (Slide geometry, vector flowcharts, text callouts)
  const sourceArch = 'D:\\PYTHON LOL\\Hackathon Ideas\\Legal.AI\\docs\\Proposed Architecture.pdf';
  if (fs.existsSync(sourceArch)) {
    const archBytes = fs.readFileSync(sourceArch);
    const dest = path.join(REAL_WORLD_DIR, 'RW03_Architecture_Presentation.pdf');
    fs.writeFileSync(dest, archBytes);
    console.log(`✓ RW03_Architecture_Presentation.pdf: ${(archBytes.length / 1024).toFixed(1)} KB (Real Architecture Presentation: Flowcharts, Boxes, Arrows)`);
  }

  // 4. RW04: Real Legal / Government Act (Complex typography, multi-column headers, footnotes)
  const sourceLegal = 'D:\\PYTHON LOL\\Hackathon Ideas\\Legal.AI\\backend\\data\\Consumer Protection (Jurisdiction of Commissions) Rules.pdf';
  if (fs.existsSync(sourceLegal)) {
    const legalBytes = fs.readFileSync(sourceLegal);
    const dest = path.join(REAL_WORLD_DIR, 'RW04_Government_Rules_Legal.pdf');
    fs.writeFileSync(dest, legalBytes);
    console.log(`✓ RW04_Government_Rules_Legal.pdf: ${(legalBytes.length / 1024).toFixed(1)} KB (Real Government Act: Complex Typography, Columns, Footnotes)`);
  }

  // 5. RW05: Real Large Qualifying Opaque RGB FlateDecode Image (PNG-based 3MB raster)
  const sourcePng = path.join(__dirname, 'benchmark', 'corpus-v2', 'large-png.pdf');
  if (fs.existsSync(sourcePng)) {
    const pngBytes = fs.readFileSync(sourcePng);
    const dest = path.join(REAL_WORLD_DIR, 'RW05_Opaque_RGB_FlateDecode_3MB.pdf');
    fs.writeFileSync(dest, pngBytes);
    console.log(`✓ RW05_Opaque_RGB_FlateDecode_3MB.pdf: ${(pngBytes.length / 1024).toFixed(1)} KB (Real FlateDecode: 3MB RGB Image with PNG Predictor)`);
  }

  // 6. RW06: Qualifying Large DeviceGray FlateDecode Image (Grayscale Document Scan)
  {
    // Synthesize an uncompressed DeviceGray FlateDecode stream exceeding 32KB
    const w = 400;
    const h = 300;
    const rawGray = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Gradient with scan noise pattern
        rawGray[y * w + x] = ((x * y) % 256 + Math.floor(Math.sin(x / 10) * 20) + 128) & 0xff;
      }
    }

    // Embed using standard PDF stream object with /Filter /FlateDecode, /ColorSpace /DeviceGray
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    
    const stream = pdfDoc.context.flateStream(rawGray);
    stream.dict.set(PDFName.of('Type'), PDFName.of('XObject'));
    stream.dict.set(PDFName.of('Subtype'), PDFName.of('Image'));
    stream.dict.set(PDFName.of('Width'), PDFNumber.of(w));
    stream.dict.set(PDFName.of('Height'), PDFNumber.of(h));
    stream.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
    stream.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
    const streamRef = pdfDoc.context.register(stream);

    page.node.set(
      PDFName.of('Resources'),
      pdfDoc.context.obj({
        XObject: { ImgGray: streamRef }
      })
    );
    page.drawText('DeviceGray FlateDecode Scan Test', { x: 50, y: 800, size: 14 });
    const bytes = await pdfDoc.save();
    const dest = path.join(REAL_WORLD_DIR, 'RW06_DeviceGray_FlateDecode.pdf');
    fs.writeFileSync(dest, bytes);
    console.log(`✓ RW06_DeviceGray_FlateDecode.pdf: ${(bytes.length / 1024).toFixed(1)} KB (Qualifying DeviceGray FlateDecode Scan)`);
  }

  // 7. RW07: Non-default /Decode Array PDF (Inverted [1 0] grayscale stream)
  {
    const w = 400;
    const h = 300;
    const rawGray = new Uint8Array(w * h);
    rawGray.fill(200);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const stream = pdfDoc.context.flateStream(rawGray);
    stream.dict.set(PDFName.of('Type'), PDFName.of('XObject'));
    stream.dict.set(PDFName.of('Subtype'), PDFName.of('Image'));
    stream.dict.set(PDFName.of('Width'), PDFNumber.of(w));
    stream.dict.set(PDFName.of('Height'), PDFNumber.of(h));
    stream.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
    stream.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
    stream.dict.set(PDFName.of('Decode'), pdfDoc.context.obj([1, 0])); // Non-default inverse mapping
    const streamRef = pdfDoc.context.register(stream);

    page.node.set(
      PDFName.of('Resources'),
      pdfDoc.context.obj({
        XObject: { ImgInverted: streamRef }
      })
    );
    page.drawText('Non-default /Decode [1 0] Array Test', { x: 50, y: 800, size: 14 });
    const bytes = await pdfDoc.save();
    const dest = path.join(REAL_WORLD_DIR, 'RW07_Custom_Decode_Inverted.pdf');
    fs.writeFileSync(dest, bytes);
    console.log(`✓ RW07_Custom_Decode_Inverted.pdf: ${(bytes.length / 1024).toFixed(1)} KB (Image with Non-Default /Decode [1.0, 0.0] Mapping)`);
  }

  // 8. RW08: High-DPI Sharp-Edged Screenshot / UI Text Document
  {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.CourierBold);
    const page = pdfDoc.addPage([792, 612]); // Letter Landscape

    page.drawText('High-DPI Sharp UI Screenshot Simulation', { x: 40, y: 570, size: 16 });
    // Simulate terminal window with crisp high-contrast text and box borders
    page.drawRectangle({
      x: 40, y: 60, width: 712, height: 490,
      color: rgb(0.1, 0.12, 0.15),
      borderColor: rgb(0.3, 0.35, 0.4),
      borderWidth: 2
    });

    const lines = [
      '$ git status',
      'On branch main',
      'Your branch is up to date with origin/main.',
      '',
      'Changes to be committed:',
      '  modified:   src/lib/compression/QpdfCompressionEngine.ts',
      '  modified:   qpdf_wrapper.cpp',
      '',
      '$ npm run build',
      'vite v8.2.2 building for production...',
      '[OK] 2017 modules transformed.',
      'dist/assets/qpdf_wrapper.wasm   878.07 kB',
      '[OK] built in 1.33s',
      '',
      '$ node test-phase-c-units.mjs',
      'Test results: 84 passed, 0 failed'
    ];

    for (let i = 0; i < lines.length; i++) {
      page.drawText(lines[i], {
        x: 60, y: 510 - i * 26, size: 13, font,
        color: lines[i].startsWith('$') ? rgb(0.2, 0.9, 0.4) : rgb(0.9, 0.95, 1)
      });
    }

    const bytes = await pdfDoc.save();
    const dest = path.join(REAL_WORLD_DIR, 'RW08_Sharp_Screenshot_Text.pdf');
    fs.writeFileSync(dest, bytes);
    console.log(`✓ RW08_Sharp_Screenshot_Text.pdf: ${(bytes.length / 1024).toFixed(1)} KB (Sharp High-DPI Terminal Screenshot & UI Elements)`);
  }

  console.log('\n✅ Real-World & FlateDecode Corpus Successfully Generated.\n');
}

prepareRealWorldCorpus().catch(err => {
  console.error('Failed to prepare real-world corpus:', err);
  process.exit(1);
});
