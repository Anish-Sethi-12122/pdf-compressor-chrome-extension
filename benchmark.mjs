import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import puppeteer from 'puppeteer';
import http from 'http';
import serveStatic from 'serve-static';
import finalhandler from 'finalhandler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We need a static server to serve dist/ and test-fixtures/
function startServer() {
  const serveDist = serveStatic(path.join(__dirname, 'dist'));
  const serveFixtures = serveStatic(path.join(__dirname, 'test-fixtures'));
  const serveJpeg = serveStatic(path.join(__dirname, 'jpeg')); // for the large image if needed

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/fixtures/')) {
      req.url = req.url.replace('/fixtures', '');
      serveFixtures(req, res, finalhandler(req, res));
    } else {
      serveDist(req, res, finalhandler(req, res));
    }
  });

  return new Promise((resolve) => {
    server.listen(4174, () => resolve(server));
  });
}

// Run a shell command
function runCommand(command) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, { shell: true, stdio: 'inherit' });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${command}`));
    });
  });
}

// Change JPEG_QUALITY in imageProcessor.ts
function setJpegQuality(quality) {
  const filePath = path.join(__dirname, 'src', 'lib', 'compression', 'imageProcessor.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/export const JPEG_QUALITY = [\d.]+;/, `export const JPEG_QUALITY = ${quality};`);
  fs.writeFileSync(filePath, content);
  console.log(`\n======================================================`);
  console.log(`🔹 Set JPEG_QUALITY to ${quality} and rebuilding...`);
  console.log(`======================================================\n`);
}

async function runBenchmarkForFile(page, filename) {
  console.log(`   Running ${filename}...`);
  return await page.evaluate(async (file) => {
    try {
      const res = await fetch(`/fixtures/${file}`);
      if (!res.ok) throw new Error('File not found');
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      
      const startTime = performance.now();
      // @ts-ignore
      const result = await window.__BENCHMARK_CLIENT__.compress(bytes, { preset: 'balanced' });
      const duration = performance.now() - startTime;
      
      return { ok: true, result, duration };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, filename);
}

async function main() {
  const qualities = [0.85, 0.82, 0.80, 0.75, 0.70];
  const fixtures = [
    'large-image.pdf',
    'phase7-multipage-jpeg.pdf',
    'phase7-text-only.pdf',
    'phase7-mixed-content.pdf',
    'phase7-png-only.pdf',
    'phase7-shared-image.pdf',
    'phase7-small-images.pdf'
  ];

  const results = {};

  for (const q of qualities) {
    setJpegQuality(q);
    await runCommand('npm run build');

    const server = await startServer();
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Capture browser console
    page.on('console', msg => console.log(`[Browser] ${msg.type()}: ${msg.text()}`));
    page.on('workercreated', worker => worker.on('console', msg => console.log(`[Worker] ${msg.type()}: ${msg.text()}`)));
    
    await page.goto('http://localhost:4174/', { waitUntil: 'networkidle0' });

    results[q] = {};

    // Sweep all fixtures on 0.82, but only the large one on other qualities to save time
    const filesToTest = q === 0.82 ? fixtures : ['large-image.pdf'];

    for (const file of filesToTest) {
      const res = await runBenchmarkForFile(page, file);
      results[q][file] = res;
      if (res.ok && res.result.ok) {
        const stats = res.result.stats;
        console.log(`     -> Original: ${(stats.inputBytes/1024).toFixed(1)} KB`);
        console.log(`     -> Final:    ${(stats.outputBytes/1024).toFixed(1)} KB (Savings: ${stats.savedPercent.toFixed(1)}%)`);
        console.log(`     -> Time:     ${res.duration.toFixed(0)} ms`);
        console.log(`     -> Images:   ${stats.imagesModified} mod / ${stats.imagesSkipped} skip`);
      } else {
        const err = res.error || (res.result && res.result.message) || (res.result && res.result.reason) || 'Unknown error';
        console.log(`     -> Failed: ${err}`);
      }
    }

    await browser.close();
    server.close();
  }

  // Restore 0.82
  setJpegQuality(0.82);
  await runCommand('npm run build');

  fs.writeFileSync('benchmark_results.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Benchmarks complete! Results saved to benchmark_results.json.');
}

main().catch(console.error);
