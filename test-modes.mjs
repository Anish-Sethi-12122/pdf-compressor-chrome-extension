import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runModeTests() {
  const extensionPath = path.join(__dirname, 'dist');
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await browser.newPage();
  
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
  
  console.log('--- RUNNING MODE TESTS ---');
  
  const pdfPath = path.join(__dirname, 'test_fixture.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error(`Fixture not found: test_fixture.pdf`);
    await browser.close();
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  await page.goto(popupUrl);
  await page.waitForSelector('.upload-dropzone');
  
  // Test low mode
  const lowResult = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    // @ts-ignore
    const client = window.__TEST_COMPRESSION_CLIENT;
    return await client.compress(bytes, { mode: 'low' });
  }, pdfBase64);
  console.log(`Low mode result: ok=${lowResult.ok}, changed=${lowResult.changed}`);
  
  // Test balanced mode
  const balancedResult = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    // @ts-ignore
    const client = window.__TEST_COMPRESSION_CLIENT;
    return await client.compress(bytes, { mode: 'balanced' });
  }, pdfBase64);
  console.log(`Balanced mode result: ok=${balancedResult.ok}, changed=${balancedResult.changed}`);
  
  // Test high mode
  const highResult = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    // @ts-ignore
    const client = window.__TEST_COMPRESSION_CLIENT;
    return await client.compress(bytes, { mode: 'high' });
  }, pdfBase64);
  console.log(`High mode result: ok=${highResult.ok}, changed=${highResult.changed}`);

  if (lowResult.stats && balancedResult.stats && highResult.stats) {
    console.log(`Output sizes:`);
    console.log(`Low:      ${lowResult.stats.outputBytes} bytes`);
    console.log(`Balanced: ${balancedResult.stats.outputBytes} bytes`);
    console.log(`High:     ${highResult.stats.outputBytes} bytes`);

    // The ordering should be High <= Balanced <= Low, but it depends on the PDF.
    // For large-image.pdf, it should show differences or at least identical (if fallback happens).
  }
  
  await browser.close();
}

runModeTests().catch(console.error);
