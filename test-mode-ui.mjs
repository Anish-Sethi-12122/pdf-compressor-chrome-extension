import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runModeUITests() {
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
    process.exit(1);
  }

  const popupUrl = `chrome-extension://${extensionId}/index.html`;
  
  console.log('--- RUNNING MODE UI TESTS ---');

  // Test 1: Default mode
  await page.goto(popupUrl);
  await page.waitForSelector('input[name="compressionMode"]');
  let selectedMode = await page.evaluate(() => {
    const checked = document.querySelector('input[name="compressionMode"]:checked');
    return checked ? checked.value : null;
  });
  console.log(`Test Default Mode: expected 'balanced', got '${selectedMode}'`);
  if (selectedMode !== 'balanced') throw new Error('Default mode is not balanced');

  // Test 2: Select Low, reload, verify it resets to Balanced
  await page.click('input[value="low"]');
  await page.goto(popupUrl);
  await page.waitForSelector('input[name="compressionMode"]');
  selectedMode = await page.evaluate(() => {
    const checked = document.querySelector('input[name="compressionMode"]:checked');
    return checked ? checked.value : null;
  });
  console.log(`Test Reset on Reload: expected 'balanced', got '${selectedMode}'`);
  if (selectedMode !== 'balanced') throw new Error('Mode did not reset to balanced on reload');

  // Test 3 removed (no local storage fallback to test anymore)

  // Test 4: File replacement and Compression Lifecycle
  // Reset to high
  await page.click('input[value="high"]');
  
  const dummyPdfPath = path.join(__dirname, 'test_fixture.pdf');
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(dummyPdfPath);
  
  await page.waitForSelector('.selected-file__ready', { timeout: 5000 });
  
  // Verify mode is still high
  selectedMode = await page.evaluate(() => document.querySelector('input[name="compressionMode"]:checked').value);
  console.log(`Test Mode After File Select: expected 'high', got '${selectedMode}'`);
  if (selectedMode !== 'high') throw new Error('Mode changed after file select');

  // Compress
  const compressBtn = await page.$('button[aria-label="Compress PDF"]');
  await compressBtn.click();
  
  await page.waitForFunction(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes('pdf compressed') || text.includes('no further compression needed');
  }, { timeout: 30000 });
  
  // Verify mode is still high after success
  selectedMode = await page.evaluate(() => document.querySelector('input[name="compressionMode"]:checked').value);
  console.log(`Test Mode After Success: expected 'high', got '${selectedMode}'`);
  if (selectedMode !== 'high') throw new Error('Mode changed after success');

  await browser.close();
  console.log('All UI mode tests passed.');
}

runModeUITests().catch(err => {
  console.error(err);
  process.exit(1);
});
