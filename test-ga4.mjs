import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.join(__dirname, 'dist');
const TEST_PDF = path.join(__dirname, 'test-fixtures', 'large-image.pdf');

async function testGA4() {
  console.log('Launching extension...');
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${DIST_PATH}`,
      `--load-extension=${DIST_PATH}`,
    ],
  });
  const page = await browser.newPage();
  await page.goto('chrome://extensions');
  await new Promise(r => setTimeout(r, 1000));

  const extensionId = await page.evaluate(() => {
    const elements = document.querySelector('extensions-manager').shadowRoot
      .querySelector('extensions-item-list').shadowRoot
      .querySelectorAll('extensions-item');
    for (const el of elements) {
      if (el.getAttribute('id')) return el.getAttribute('id');
    }
    return null;
  });

  console.log(`Extension ID: ${extensionId}`);
  const popupUrl = `chrome-extension://${extensionId}/index.html`;

  const gaRequests = [];
  page.on('request', req => {
    if (req.url().includes('google-analytics') || req.url().includes('mp/collect')) {
      gaRequests.push({ url: req.url(), postData: req.postData() });
      console.log(`GA Request captured: ${req.url()}`);
      console.log(`Payload: ${req.postData()}`);
    }
  });

  console.log('Navigating to popup...');
  await page.goto(popupUrl);
  await new Promise(r => setTimeout(r, 1500));

  console.log('Clicking Accept...');
  const grantBtn = await page.$('.consent-btn--grant');
  if (grantBtn) {
    await grantBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Uploading PDF...');
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(TEST_PDF);

  console.log('Waiting for compression to finish...');
  await page.waitForFunction(() =>
    document.querySelector('.selected-file__ready') !== null ||
    document.querySelector('.file-error') !== null,
    { timeout: 5000 }
  ).catch(() => {});
  
  await new Promise(r => setTimeout(r, 1000));

  console.log('Total GA Requests sent:', gaRequests.length);
  await browser.close();
}

testGA4().catch(console.error);
