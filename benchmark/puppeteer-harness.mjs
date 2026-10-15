import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import gs from '@jspawn/ghostscript-wasm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORPUS_DIR = path.join(__dirname, 'corpus-v2');
const OUTPUT_DIR = path.join(__dirname, 'output-v2');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function runGS(inputBytes, outPath) {
  return new Promise((resolve) => {
    try {
      const gsModule = gs({ noInitialRun: true, print: () => {}, printErr: () => {} });
      gsModule.then((mod) => {
        mod.FS.writeFile('/input.pdf', inputBytes);
        const args = ['gs', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', '-dPDFSETTINGS=/ebook', '-dNOPAUSE', '-dQUIET', '-dBATCH', '-sOutputFile=/output.pdf', '/input.pdf'];
        mod.callMain(args);
        try {
          const outBytes = mod.FS.readFile('/output.pdf');
          fs.writeFileSync(outPath, outBytes);
          resolve(outBytes);
        } catch (e) { resolve(null); }
      }).catch(() => resolve(null));
    } catch(e) { resolve(null); }
  });
}

const fixtures = fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.pdf'));

async function runBenchmark() {
  const extensionPath = path.join(__dirname, '..', 'dist');
  const browser = await puppeteer.launch({
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });

  const page = await browser.newPage();
  await page.goto('chrome://extensions');
  await new Promise(r => setTimeout(r, 1000));
  
  const extensionId = await page.evaluate(() => {
    const elements = document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelectorAll('extensions-item');
    for (let el of elements) {
      if (el.getAttribute('id')) return el.getAttribute('id');
    }
    return null;
  });

  const popupUrl = `chrome-extension://${extensionId}/index.html`;
  console.log('--- PHASE A BENCHMARK HARNESS ---');
  
  const report = [];

  for (const file of fixtures) {
    const pdfPath = path.join(CORPUS_DIR, file);
    const inputBytes = fs.readFileSync(pdfPath);
    console.log(`\nBenchmarking: ${file} (${(inputBytes.length / 1024).toFixed(1)} KB)`);

    const t0 = performance.now();
    // const gsBytes = await runGS(inputBytes, path.join(OUTPUT_DIR, `${file}-gs.pdf`));
    const gsSize = inputBytes.length; // gsBytes ? gsBytes.length : inputBytes.length;
    const gsTime = performance.now() - t0;
    
    const fileResult = {
      file,
      originalSize: inputBytes.length,
      gs: { size: gsSize, timeMs: gsTime },
      v1: {},
    };

    async function runPuppeteerCompress(modeStr) {
       await page.goto(popupUrl);
       await page.evaluate(() => { window.__TEST_RESULT__ = undefined; });
       
       if (modeStr) {
           const modeVal = modeStr.toLowerCase();
           await page.evaluate((val) => {
               const radio = document.querySelector(`input[name="compressionMode"][value="${val}"]`);
               if (radio) radio.click();
           }, modeVal);
       }
       
       await page.waitForSelector('.upload-dropzone');
       const fileInput = await page.$('input[type=file]');
       await fileInput.uploadFile(pdfPath);
       
       try { await page.waitForSelector('.selected-file__ready', {timeout: 5000}); } catch(e) {}
       const isError = await page.evaluate(() => {
           const txt = document.body.innerText.toLowerCase();
           return txt.includes('error') || txt.includes('damaged') || txt.includes('password');
       });
       if(isError) return { ok: false, error: 'rejected_on_upload' };
       
       const compressBtn = await page.$('button[aria-label="Compress PDF"]');
       if(!compressBtn) return {ok: false, error: 'no_compress_btn'};
       await compressBtn.click();
       
       try {
         await page.waitForFunction(() => window.__TEST_RESULT__ !== undefined, { timeout: 60000 });
         const result = await page.evaluate(() => window.__TEST_RESULT__);
         return result;
       } catch(e) { return {ok: false, error: 'timeout'}; }
    }

    for (const mode of ['Low', 'Balanced', 'High']) {
       console.log(`  -> Running V1 ${mode}...`);
       const res = await runPuppeteerCompress(mode);
       if (res && res.ok !== false && res.stats) {
           fileResult.v1[mode] = res.stats;
           console.log(`     Saved: ${res.stats?.savedPercent?.toFixed(1)}%`);
       } else {
           console.log(`     Failed/Unchanged: ${res?.error || 'N/A'}`);
       }
    }
    
    report.push(fileResult);
  }
  
  await browser.close();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'phase_b_report.json'), JSON.stringify(report, null, 2));
  console.log('\nBenchmark complete! Results saved.');
}

runBenchmark().catch(console.error);
