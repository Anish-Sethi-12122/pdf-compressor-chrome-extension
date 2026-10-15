import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runLiveBenchmark() {
  const extensionPath = path.join(__dirname, 'dist');
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await browser.newPage();

  // Route worker logs
  browser.on('targetcreated', async target => {
    if (target.type() === 'worker' || target.type() === 'service_worker') {
      try {
        const worker = await target.worker();
        worker.on('console', msg => console.log('WORKER LOG:', msg.text()));
      } catch (e) { }
    }
  });

  await page.goto('chrome://extensions');
  await new Promise(r => setTimeout(r, 1000));

  const extensionId = await page.evaluate(() => {
    const elements = document.querySelector('extensions-manager').shadowRoot
      .querySelector('extensions-item-list').shadowRoot
      .querySelectorAll('extensions-item');
    for (let el of elements) {
      if (el.getAttribute('id')) return el.getAttribute('id');
    }
    return null;
  });

  if (!extensionId) {
    console.error("Could not find extension ID");
    await browser.close();
    process.exit(1);
  }

  const popupUrl = `chrome-extension://${extensionId}/index.html`;
  console.log('Extension Popup URL:', popupUrl);
  await page.goto(popupUrl);
  await page.waitForSelector('.upload-dropzone');

  // Verify client is present
  const clientReady = await page.evaluate(() => typeof window.__TEST_COMPRESSION_CLIENT !== 'undefined');
  if (!clientReady) {
    console.error("window.__TEST_COMPRESSION_CLIENT is not defined!");
    await browser.close();
    process.exit(1);
  }

  // Define candidate PDFs for benchmark
  const testPdfs = [
    { name: 'test_fixture.pdf', path: path.join(__dirname, 'test_fixture.pdf'), category: 'Mixed Multi-Image Document' },
    { name: 'large-image.pdf', path: path.join(__dirname, 'test-fixtures', 'large-image.pdf'), category: 'High-Res Photo Scan (2480x3508)' },
    { name: 'alpha-photo-heavy.pdf', path: path.join(__dirname, 'test-fixtures', 'alpha-photo-heavy.pdf'), category: 'Photo-Heavy PDF' },
    { name: 'alpha-presentation.pdf', path: path.join(__dirname, 'test-fixtures', 'alpha-presentation.pdf'), category: 'Presentation PDF' },
    { name: 'alpha-scanned.pdf', path: path.join(__dirname, 'test-fixtures', 'alpha-scanned.pdf'), category: 'Color/Grayscale Scan' },
    { name: 'phase7-multipage-jpeg.pdf', path: path.join(__dirname, 'test-fixtures', 'phase7-multipage-jpeg.pdf'), category: 'Multi-Page Document' },
    { name: 'phase7-text-only.pdf', path: path.join(__dirname, 'test-fixtures', 'phase7-text-only.pdf'), category: 'Text-Only / Vector' },
    { name: 'phase7-png-only.pdf', path: path.join(__dirname, 'test-fixtures', 'phase7-png-only.pdf'), category: 'FlateDecode / PNG Raster' },
    { name: 'hardening-forms-links-bookmarks.pdf', path: path.join(__dirname, 'test-fixtures', 'hardening-forms-links-bookmarks.pdf'), category: 'Forms, Links, Bookmarks' },
    { name: 'hardening-unsupported-images.pdf', path: path.join(__dirname, 'test-fixtures', 'hardening-unsupported-images.pdf'), category: 'CMYK / Masked / Unsupported' },
    { name: 'C01-word-export.pdf', path: path.join(__dirname, 'test-fixtures', 'phase-c', 'C01-word-export.pdf'), category: 'Word / Office Document Export' },
    { name: 'C03-screenshot-heavy.pdf', path: path.join(__dirname, 'test-fixtures', 'phase-c', 'C03-screenshot-heavy.pdf'), category: 'Screenshot-Heavy Document' },
    { name: 'C05-bw-scan-simulation.pdf', path: path.join(__dirname, 'test-fixtures', 'phase-c', 'C05-bw-scan-simulation.pdf'), category: 'Black & White Document Scan' },
    { name: 'C07-charts-diagrams.pdf', path: path.join(__dirname, 'test-fixtures', 'phase-c', 'C07-charts-diagrams.pdf'), category: 'Charts, Fine Lines & Technical Art' },
    { name: 'C10-text-vector-heavy.pdf', path: path.join(__dirname, 'test-fixtures', 'phase-c', 'C10-text-vector-heavy.pdf'), category: 'Text & Vector Heavy' }
  ];

  // Filter available
  const availablePdfs = testPdfs.filter(p => fs.existsSync(p.path));
  console.log(`Loaded ${availablePdfs.length} candidate benchmark PDFs.`);

  const results = {
    modes: {},
    ablation: {},
    flateComparison: {},
    batch: {}
  };

  // Helper function to compress via browser
  async function compressFile(filePath, options = {}) {
    const buf = fs.readFileSync(filePath);
    const b64 = buf.toString('base64');

    return await page.evaluate(async (base64, opts) => {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const client = window.__TEST_COMPRESSION_CLIENT;
      if (opts.benchmarkProfile) {
        window.__BENCHMARK_PROFILE__ = opts.benchmarkProfile;
      } else {
        window.__BENCHMARK_PROFILE__ = null;
      }
      const memBefore = window.performance?.memory?.usedJSHeapSize || 0;
      const res = await client.compress(bytes, opts);
      const memAfter = window.performance?.memory?.usedJSHeapSize || 0;
      return {
        res,
        memBefore,
        memAfter,
        memDelta: memAfter - memBefore
      };
    }, b64, options);
  }

  // 1. RUN COMPRESSION MODES (Low, Balanced, High)
  console.log('\n========================================');
  console.log('1. RUNNING LOW, BALANCED, HIGH MODES');
  console.log('========================================');

  for (const item of availablePdfs) {
    console.log(`\nEvaluating Modes: ${item.name} (${item.category})...`);
    results.modes[item.name] = { category: item.category, modes: {} };

    for (const mode of ['low', 'balanced', 'high']) {
      const { res, memBefore, memAfter } = await compressFile(item.path, { mode });
      if (res.ok) {
        results.modes[item.name].modes[mode] = {
          inputBytes: res.stats.inputBytes,
          outputBytes: res.stats.outputBytes,
          savedBytes: res.stats.savedBytes,
          savedPercent: parseFloat(res.stats.savedPercent.toFixed(2)),
          processingTimeMs: Math.round(res.stats.processingTimeMs),
          imagesDetected: res.stats.imagesDetected,
          imagesModified: res.stats.imagesModified,
          imagesSkipped: res.stats.imagesSkipped,
          changed: res.changed,
          memAfterBytes: memAfter
        };
        console.log(`  [${mode.toUpperCase()}] ${res.stats.inputBytes} -> ${res.stats.outputBytes} bytes (${res.stats.savedPercent.toFixed(1)}%) in ${Math.round(res.stats.processingTimeMs)}ms | mod:${res.stats.imagesModified} skip:${res.stats.imagesSkipped}`);
      } else {
        console.log(`  [${mode.toUpperCase()}] Failed: ${res.reason}`);
      }
    }
  }

  // 2. RUN ABLATION BENCHMARKS (A, B, C, D)
  console.log('\n========================================');
  console.log('2. RUNNING INDEPENDENT ABLATION MATRIX');
  console.log('========================================');
  console.log('A: Orig Quality (0.82) + Orig Resizing (maxDim 2400, no maxArea)');
  console.log('B: New Quality (0.72)  + Orig Resizing (maxDim 2400, no maxArea)');
  console.log('C: Orig Quality (0.82) + New Resizing (maxDim 2400, maxArea 2MP)');
  console.log('D: New Quality (0.72)  + New Resizing (maxDim 2400, maxArea 2MP)');

  const ablationProfiles = {
    A: {
      mode: 'balanced',
      label: 'A: Orig Quality (0.82) + Orig Resizing (2400px edge)',
      description: 'Ablation A',
      jpegQuality: 0.82,
      maxImageDimension: 2400,
      minEligibleStreamSize: 32768,
      replacementThreshold: 0.10,
      maxImageArea: 0 // disabled
    },
    B: {
      mode: 'balanced',
      label: 'B: New Quality (0.72) + Orig Resizing (2400px edge)',
      description: 'Ablation B',
      jpegQuality: 0.72,
      maxImageDimension: 2400,
      minEligibleStreamSize: 32768,
      replacementThreshold: 0.10,
      maxImageArea: 0 // disabled
    },
    C: {
      mode: 'balanced',
      label: 'C: Orig Quality (0.82) + New Area Resizing (2MP)',
      description: 'Ablation C',
      jpegQuality: 0.82,
      maxImageDimension: 2400,
      minEligibleStreamSize: 32768,
      replacementThreshold: 0.10,
      maxImageArea: 2000000
    },
    D: {
      mode: 'balanced',
      label: 'D: New Quality (0.72) + New Area Resizing (2MP)',
      description: 'Ablation D (Current Balanced)',
      jpegQuality: 0.72,
      maxImageDimension: 2400,
      minEligibleStreamSize: 32768,
      replacementThreshold: 0.10,
      maxImageArea: 2000000
    }
  };

  // Run on image-containing files where differences manifest
  const ablationTargets = availablePdfs.filter(p => 
    ['test_fixture.pdf', 'large-image.pdf', 'alpha-photo-heavy.pdf', 'alpha-presentation.pdf', 'alpha-scanned.pdf'].includes(p.name)
  );

  for (const item of ablationTargets) {
    console.log(`\nAblation for: ${item.name}...`);
    results.ablation[item.name] = {};

    for (const [code, prof] of Object.entries(ablationProfiles)) {
      const { res, memAfter } = await compressFile(item.path, { benchmarkProfile: prof });
      if (res.ok) {
        results.ablation[item.name][code] = {
          inputBytes: res.stats.inputBytes,
          outputBytes: res.stats.outputBytes,
          savedBytes: res.stats.savedBytes,
          savedPercent: parseFloat(res.stats.savedPercent.toFixed(2)),
          processingTimeMs: Math.round(res.stats.processingTimeMs),
          imagesModified: res.stats.imagesModified,
          imagesSkipped: res.stats.imagesSkipped,
          changed: res.changed
        };
        console.log(`  Profile ${code}: ${res.stats.outputBytes} bytes (saved ${res.stats.savedBytes} B / ${res.stats.savedPercent.toFixed(1)}%) in ${Math.round(res.stats.processingTimeMs)}ms`);
      }
    }
  }

  // 3. FLATEDECODE V1 vs PHASE B COMPARISON
  console.log('\n========================================');
  console.log('3. PNG / FLATEDECODE: V1 vs PHASE B');
  console.log('========================================');
  // In V1, imageClassifier skipped all /FlateDecode images
  // We simulate V1 by checking if images are FlateDecode or using a custom profile
  // Or we test phase7-png-only.pdf and documents with mixed types
  const flateTargets = availablePdfs.filter(p =>
    ['phase7-png-only.pdf', 'hardening-unsupported-images.pdf', 'C03-screenshot-heavy.pdf', 'test_fixture.pdf'].includes(p.name)
  );

  for (const item of flateTargets) {
    const { res } = await compressFile(item.path, { mode: 'balanced' });
    results.flateComparison[item.name] = {
      detected: res.stats?.imagesDetected,
      modified: res.stats?.imagesModified,
      skipped: res.stats?.imagesSkipped,
      logs: res.stats?.imageLogs || [],
      changed: res.changed,
      savedPercent: res.stats?.savedPercent
    };
    console.log(`  ${item.name}: detected=${res.stats?.imagesDetected}, modified=${res.stats?.imagesModified}, skipped=${res.stats?.imagesSkipped}, changed=${res.changed}`);
    if (res.stats?.imageLogs && res.stats.imageLogs.length > 0) {
      for (const log of res.stats.imageLogs) {
        console.log(`    obj ${log.objectId}: filter=${log.filter}, bpc=${log.bpc}, cs=${log.colorspace}, accept=${log.accepted}, reason=${log.reason}`);
      }
    }
  }

  // 4. BATCH TESTING (4 WORKERS CONCURRENCY & MEMORY)
  console.log('\n========================================');
  console.log('4. BATCH TESTING WITH FOUR WORKERS');
  console.log('========================================');

  const batchFiles = [
    path.join(__dirname, 'test_fixture.pdf'),
    path.join(__dirname, 'test-fixtures', 'large-image.pdf'),
    path.join(__dirname, 'test-fixtures', 'alpha-photo-heavy.pdf'),
    path.join(__dirname, 'test-fixtures', 'alpha-presentation.pdf')
  ].filter(p => fs.existsSync(p));

  const batchData = batchFiles.map(fp => ({
    name: path.basename(fp),
    base64: fs.readFileSync(fp).toString('base64')
  }));

  const batchResult = await page.evaluate(async (files) => {
    const ClientClass = window.__TEST_COMPRESSION_CLIENT.constructor;
    // Instantiate 4 separate Web Workers
    const workers = [new ClientClass(), new ClientClass(), new ClientClass(), new ClientClass()];
    const capacity = workers.length;

    const t0 = performance.now();
    const memInitial = performance.memory ? performance.memory.usedJSHeapSize : 0;

    const promises = files.map(async (f, idx) => {
      const client = workers[idx % capacity];
      const bytes = Uint8Array.from(atob(f.base64), c => c.charCodeAt(0));
      const res = await client.compress(bytes, { mode: 'balanced' });
      return { name: f.name, res };
    });

    const outcomes = await Promise.all(promises);
    const totalTimeMs = performance.now() - t0;
    const memPeak = performance.memory ? performance.memory.usedJSHeapSize : 0;

    // Clean up
    for (const w of workers) {
      w.terminate();
    }

    return {
      capacity,
      totalTimeMs,
      memInitial,
      memPeak,
      memDelta: memPeak - memInitial,
      outcomes: outcomes.map(o => ({
        name: o.name,
        ok: o.res.ok,
        changed: o.res.changed,
        savedPercent: o.res.stats?.savedPercent,
        timeMs: o.res.stats?.processingTimeMs
      }))
    };
  }, batchData);

  results.batch = batchResult;
  console.log(`Batch processed ${batchResult.outcomes.length} large PDFs concurrently:`);
  console.log(`  Worker Capacity: ${batchResult.capacity}`);
  console.log(`  Total Batch Elapsed Time: ${Math.round(batchResult.totalTimeMs)}ms`);
  console.log(`  Initial JS Heap: ${(batchResult.memInitial / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  Peak JS Heap: ${(batchResult.memPeak / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  Heap Delta: ${(batchResult.memDelta / (1024 * 1024)).toFixed(2)} MB`);
  for (const o of batchResult.outcomes) {
    console.log(`    ✓ ${o.name}: changed=${o.changed}, saved=${o.savedPercent?.toFixed(1)}%, time=${Math.round(o.timeMs)}ms`);
  }

  // Save full results
  const outPath = path.join(__dirname, 'phase-c-live-benchmark-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Full live benchmark results saved to ${outPath}`);

  await browser.close();
}

runLiveBenchmark().catch(err => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
