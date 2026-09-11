import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBatchTests() {
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
    console.error("Could not find extension ID");
    await browser.close();
    process.exit(1);
  }

  const popupUrl = `chrome-extension://${extensionId}/index.html`;
  
  console.log('--- RUNNING BATCH TESTS ---');

  // Helper to extract texts
  const getBatchTexts = async () => {
    return await page.evaluate(() => {
      const names = Array.from(document.querySelectorAll('.batch-job-name')).map(n => n.innerText);
      const statuses = Array.from(document.querySelectorAll('.batch-status')).map(n => n.innerText);
      const summary = document.querySelector('.batch-summary-text')?.innerText || '';
      return { names, statuses, summary };
    });
  };

  // 1. Upload multiple files
  console.log('Testing Multiple File Upload...');
  await page.goto(popupUrl);
  await page.waitForSelector('.upload-dropzone');
  
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(
    path.join(__dirname, 'test-fixtures', 'phase7-text-only.pdf'),
    path.join(__dirname, 'test-fixtures', 'large-image.pdf'),
    path.join(__dirname, 'test-fixtures', 'not-a-pdf.pdf') // invalid
  );

  await page.waitForSelector('.batch-job-row', { timeout: 5000 });
  const data = await getBatchTexts();
  console.log(`Found ${data.names.length} jobs in UI.`);
  if (data.names.length !== 3) {
    throw new Error(`Expected 3 PDFs in queue, got ${data.names.length}`);
  }

  // 2. Wait for completion
  console.log('Waiting for batch completion...');
  await page.waitForFunction(() => {
    const text = document.querySelector('.batch-summary-text')?.innerText || '';
    return text.includes('3 / 3 completed');
  }, { timeout: 30000 });
  
  const data2 = await getBatchTexts();
  console.log('Final Statuses:', data2.statuses);
  console.log('Summary:', data2.summary);

  // 3. Test duplicate filenames
  console.log('Testing Duplicate Filenames (Collision safety)...');
  await page.goto(popupUrl);
  await page.waitForSelector('.upload-dropzone');
  
  const fileInput2 = await page.$('input[type=file]');
  await fileInput2.uploadFile(
    path.join(__dirname, 'test-fixtures', 'large-image.pdf'),
    path.join(__dirname, 'test-fixtures', 'large-image.pdf') // Same name
  );
  
  await page.waitForFunction(() => {
    const text = document.querySelector('.batch-summary-text')?.innerText || '';
    return text.includes('2 / 2 completed');
  }, { timeout: 30000 });
  
  // Test if download outputs are deterministic
  const downloadNames = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.batch-download-btn')).map(el => el.getAttribute('aria-label'));
  });
  console.log('Download Buttons:', downloadNames);
  if (!downloadNames[1].includes('(2)')) {
    throw new Error('Collision detection failed. Second file should have (2).');
  }

  // 4. Test Cancellation
  console.log('Testing Cancellation...');
  await page.goto(popupUrl);
  await page.waitForSelector('.upload-dropzone');
  
  // Set concurrency to 1 so we can cancel while job 2 is queued
  await page.evaluate(() => { window.__FORCE_CONCURRENCY = 1; });
  
  const fileInput3 = await page.$('input[type=file]');
  await fileInput3.uploadFile(
    path.join(__dirname, 'test-fixtures', 'large-image.pdf'),
    path.join(__dirname, 'test-fixtures', 'phase7-text-only.pdf')
  );
  
  // Wait for processing to start
  await page.waitForSelector('.batch-status--processing');
  
  // Click Cancel
  const cancelBtn = await page.$('button[aria-label="Cancel batch processing"]');
  await cancelBtn.click();
  
  const data3 = await getBatchTexts();
  console.log('Statuses after cancel:', data3.statuses);
  if (!data3.statuses.some(s => s.includes('Cancelled'))) {
    throw new Error('No jobs were cancelled!');
  }

  await browser.close();
  console.log('Batch tests passed!');
}

runBatchTests().catch(e => {
  console.error(e);
  process.exit(1);
});
