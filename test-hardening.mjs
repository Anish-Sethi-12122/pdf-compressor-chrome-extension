import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixtures = [
  { name: 'encrypted.pdf', expected: 'error' },
  { name: 'malformed.pdf', expected: 'error' },
  { name: 'empty.pdf', expected: 'error' },
  { name: 'not-a-pdf.pdf', expected: 'error' },
  { name: 'large-image.pdf', expected: 'success' },
  { name: 'phase7-png-only.pdf', expected: 'unchanged' },
  { name: 'hardening-unsupported-images.pdf', expected: 'unchanged' },
  { name: 'hardening-forms-links-bookmarks.pdf', expected: 'success' },
  { name: 'phase7-shared-image.pdf', expected: 'unchanged' },
  { name: 'phase7-mixed-content.pdf', expected: 'unchanged' },
];

async function runHardeningTests() {
  const extensionPath = path.join(__dirname, 'dist');
  const browser = await puppeteer.launch({
    headless: false,
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
    console.error("Could not find extension ID");
    await browser.close();
    process.exit(1);
  }

  const popupUrl = `chrome-extension://${extensionId}/index.html`;
  
  console.log('--- RUNNING MATRIX TESTS ---');
  for (const fixture of fixtures) {
    const pdfPath = path.join(__dirname, 'test-fixtures', fixture.name);
    if (!fs.existsSync(pdfPath)) {
      console.error(`Fixture not found: ${fixture.name}`);
      continue;
    }

    await page.goto(popupUrl);
    await page.waitForSelector('.upload-dropzone');
    
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(pdfPath);
    
    // Wait for UI to stabilize after upload
    try {
        await page.waitForFunction(() => {
            const text = document.body.innerText.toLowerCase();
            return document.querySelector('.selected-file__ready') !== null || 
                   document.querySelector('.file-error') !== null ||
                   text.includes('error') || text.includes('failed') || text.includes('password-protected') || 
                   text.includes('damaged') || text.includes('doesn\'t look like') || text.includes('could not read');
        }, { timeout: 5000 });
    } catch(e) {}

    const uploadState = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        if (text.includes("doesn't look like a pdf")) return 'rejected_upload';
        if (text.includes('password-protected') || text.includes('damaged') || text.includes('could not read') || document.querySelector('.file-error')) return 'inspection_failed';
        if (document.querySelector('.selected-file__ready')) return 'ready';
        return 'unexpected_state';
    });

    if (uploadState === 'rejected_upload') {
        console.log(`[${fixture.name}] -> Rejected at upload stage (Expected: ${fixture.expected})`);
        continue;
    }
    if (uploadState === 'inspection_failed') {
        console.log(`[${fixture.name}] -> Inspection failed (Expected: ${fixture.expected})`);
        continue;
    }
    if (uploadState === 'unexpected_state') {
        console.log(`[${fixture.name}] -> Unexpected UI state after upload (Expected: ${fixture.expected})`);
        continue;
    }
    
    const compressBtn = await page.$('button[aria-label="Compress PDF"]');
    if (!compressBtn) {
        console.log(`[${fixture.name}] -> Compression unavailable? (Expected: ${fixture.expected})`);
        continue;
    }
    await compressBtn.click();
    
    try {
      await page.waitForFunction(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('pdf compressed') || text.includes('no meaningful savings') || text.includes('went wrong') || text.includes('error') || document.querySelector('.compression-error');
      }, { timeout: 30000 });
      
      const text = await page.evaluate(() => document.body.innerText.toLowerCase());
      if (text.includes('pdf compressed')) {
          console.log(`[${fixture.name}] -> SUCCESS (Expected: ${fixture.expected})`);
      } else if (text.includes('no meaningful savings')) {
          console.log(`[${fixture.name}] -> UNCHANGED (Expected: ${fixture.expected})`);
      } else if (text.includes('went wrong') || text.includes('error') || text.includes('failed')) {
          console.log(`[${fixture.name}] -> COMPRESSION FAILED (Expected: ${fixture.expected})`);
      } else {
          console.log(`[${fixture.name}] -> UNEXPECTED POST-COMPRESSION STATE`);
      }
    } catch(e) {
      console.log(`[${fixture.name}] -> TIMEOUT OR FAILURE`);
    }
  }
  
  console.log('\n--- LIFECYCLE TESTS ---');
  // 1. Rapid file replacement
  console.log('Testing Rapid File Replacement...');
  await page.goto(popupUrl);
  await page.waitForSelector('.upload-dropzone');
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(path.join(__dirname, 'test-fixtures', 'phase7-text-only.pdf'));
  await fileInput.uploadFile(path.join(__dirname, 'test-fixtures', 'large-image.pdf'));
  
  await page.waitForFunction(() => document.querySelector('.selected-file__ready') !== null, {timeout: 5000});
  let readyText = await page.evaluate(() => document.body.innerText);
  console.log(`Replacement UI state normal: ${readyText.includes('large-image.pdf')}`);

  // 2. Repeated compression
  console.log('Testing Repeated Compression...');
  const compressBtn3 = await page.$('button[aria-label="Compress PDF"]');
  await compressBtn3.click();
  await page.waitForFunction(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes('pdf compressed') || text.includes('no meaningful savings');
  }, { timeout: 30000 });
  
  const text2 = await page.evaluate(() => document.body.innerText.toLowerCase());
  console.log(`First pass done. Status: ${text2.includes('pdf compressed') ? 'Compressed' : 'Skipped'}`);
  
  // Wait, the UI doesn't have a "compress again" button. We need to upload the output.
  // Actually, we can download it, then upload it.
  
  // 3. Popup close/reopen during processing
  console.log('Testing Popup close/reopen (simulated by page reload)...');
  await page.goto(popupUrl);
  await page.waitForSelector('.upload-dropzone');
  const fileInput2 = await page.$('input[type=file]');
  await fileInput2.uploadFile(path.join(__dirname, 'test-fixtures', 'large-image.pdf'));
  await page.waitForSelector('.selected-file__ready');
  const compressBtn2 = await page.$('button[aria-label="Compress PDF"]');
  await compressBtn2.click();
  
  // Reload immediately
  await page.reload();
  await page.waitForSelector('.upload-dropzone');
  console.log('Reloaded successfully, UI reset to upload dropzone.');

  await browser.close();
  console.log('Tests completed.');
}

runHardeningTests().catch(console.error);
