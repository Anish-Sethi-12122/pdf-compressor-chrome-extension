import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runBenchmarkForConcurrency(concurrency) {
  const extensionPath = path.join(__dirname, 'dist');
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await browser.newPage();
  
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
    throw new Error("Could not find extension ID");
  }

  const popupUrl = `chrome-extension://${extensionId}/index.html`;
  
  await page.goto(popupUrl);
  await page.waitForSelector('.upload-dropzone');
  
  // Force concurrency
  await page.evaluate((c) => { window.__FORCE_CONCURRENCY = c; }, concurrency);

  const fileInput = await page.$('input[type=file]');
  const fixturesDir = path.join(__dirname, 'test-fixtures');
  
  // Create a batch of 8 copies of the large-image.pdf
  const files = Array(8).fill(path.join(fixturesDir, 'large-image.pdf'));
  
  const startTime = Date.now();
  
  await fileInput.uploadFile(...files);
  
  await page.waitForFunction((count) => {
    const text = document.querySelector('.batch-summary-text')?.innerText || '';
    return text.includes(`${count} / ${count} completed`);
  }, { timeout: 120000 }, files.length);

  const duration = Date.now() - startTime;
  
  await browser.close();
  return duration;
}

async function main() {
  console.log('--- BATCH CONCURRENCY BENCHMARK ---');
  console.log('Workload: 8 copies of large-image.pdf');
  
  const results = {};
  
  for (const c of [1, 2, 4]) {
    console.log(`\nTesting concurrency: ${c} worker(s)...`);
    try {
      const duration = await runBenchmarkForConcurrency(c);
      console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)} seconds`);
      results[c] = duration;
    } catch (e) {
      console.error(`Failed at concurrency ${c}:`, e);
    }
  }

  console.log('\n--- RESULTS SUMMARY ---');
  for (const [c, duration] of Object.entries(results)) {
    console.log(`Workers: ${c} | Time: ${(duration / 1000).toFixed(2)}s`);
  }
}

main().catch(console.error);
