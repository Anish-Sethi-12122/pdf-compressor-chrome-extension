import fs from 'fs';
import path from 'path';
import { QpdfCompressionEngine } from './src/lib/compression/QpdfCompressionEngine.js';
import { COMPRESSION_PROFILES } from './src/lib/compression/compressionConfig.js';

// The Ghostscript-wasm wrapper we just installed
import gs from '@jspawn/ghostscript-wasm';

const CORPUS_DIR = path.join(process.cwd(), 'benchmark', 'corpus-v2');
const OUTPUT_DIR = path.join(process.cwd(), 'benchmark', 'output-v2');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const pdfFiles = fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.pdf'));

async function runGS(inputBytes, outPath) {
  return new Promise((resolve) => {
    try {
      const gsModule = gs({
        noInitialRun: true,
        print: (text) => {},
        printErr: (text) => {}
      });
      
      gsModule.then((mod) => {
        mod.FS.writeFile('/input.pdf', inputBytes);
        const args = [
          'gs', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4',
          '-dPDFSETTINGS=/ebook', '-dNOPAUSE', '-dQUIET', '-dBATCH',
          '-sOutputFile=/output.pdf', '/input.pdf'
        ];
        mod.callMain(args);
        
        try {
          const outBytes = mod.FS.readFile('/output.pdf');
          fs.writeFileSync(outPath, outBytes);
          resolve(outBytes);
        } catch (e) {
          resolve(null);
        }
      });
    } catch(e) {
      resolve(null);
    }
  });
}

async function main() {
  const engine = new QpdfCompressionEngine();
  const results = [];

  for (const file of pdfFiles) {
    console.log(`\n--- Benchmarking ${file} ---`);
    const inputPath = path.join(CORPUS_DIR, file);
    const inputBytes = fs.readFileSync(inputPath);
    const originalSize = inputBytes.length;

    console.log(`Original size: ${(originalSize / 1024).toFixed(1)} KB`);

    // 1. Ghostscript Baseline
    console.log('Running Ghostscript /ebook...');
    const tGS = performance.now();
    const gsBytes = await runGS(inputBytes, path.join(OUTPUT_DIR, `${file}-gs.pdf`));
    const gsTime = performance.now() - tGS;
    const gsSize = gsBytes ? gsBytes.length : originalSize;

    // 2. V1 Baselines (Low, Balanced, High)
    const modes = ['Low', 'Balanced', 'High'];
    const v1Results = {};
    for (const mode of modes) {
      console.log(`Running V1 ${mode}...`);
      const res = await engine.compress(inputBytes, { mode });
      if (res.ok) {
        fs.writeFileSync(path.join(OUTPUT_DIR, `${file}-v1-${mode}.pdf`), res.output);
        v1Results[mode] = res.stats;
      }
    }

    // 3. Hypothesis A: Quality Calibration (Balanced with Q=0.75, 0.72, 0.70)
    console.log(`Running Hypothesis A (Quality)...`);
    const hAResults = {};
    for (const q of [0.75, 0.72, 0.70]) {
      const profile = { ...COMPRESSION_PROFILES['Balanced'], jpegQuality: q };
      const res = await engine.compress(inputBytes, { benchmarkProfile: profile });
      if (res.ok) hAResults[`Q${q}`] = res.stats;
    }

    // 4. Hypothesis B: Pixel-Budget Downsampling (Balanced with 2MP budget)
    console.log(`Running Hypothesis B (Pixel Budget)...`);
    const hBProfile = { ...COMPRESSION_PROFILES['Balanced'], maxImageArea: 2000000 };
    const resHB = await engine.compress(inputBytes, { benchmarkProfile: hBProfile });
    const hBStats = resHB.ok ? resHB.stats : null;

    results.push({
      file,
      originalSize,
      gs: { size: gsSize, time: gsTime },
      v1: v1Results,
      hypA: hAResults,
      hypB: hBStats
    });
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(results, null, 2));
  console.log('\nBenchmark complete. Wrote report.json.');
}

main().catch(console.error);
