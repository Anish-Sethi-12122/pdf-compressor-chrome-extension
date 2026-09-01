import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const extensionPath = path.join(__dirname, 'dist');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const dummyPdfPath = path.join(__dirname, 'test_fixture.pdf');
  
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  
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
  console.log('Navigating to', popupUrl);
  await page.goto(popupUrl);
  
  // Set up download behavior
  const downloadPath = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);
  
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath,
  });
  
  await page.waitForSelector('.upload-dropzone');
  
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(dummyPdfPath);
  
  await page.waitForSelector('.selected-file__ready', { timeout: 5000 });
  console.log('File ready for compression');
  
  const compressBtn = await page.$('button[aria-label="Compress PDF"]');
  const startTime = Date.now();
  await compressBtn.click();
  
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('pdf compressed') || text.includes('no further compression needed') || text.includes('went wrong');
    }, { timeout: 30000 });
  } catch(e) {
    console.log("Wait failed.");
    console.log("Current body:", await page.evaluate(() => document.body.innerText));
    throw e;
  }
  
  const elapsedTime = Date.now() - startTime;
  
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Result text:');
  console.log(text);
  console.log(`Elapsed time: ${elapsedTime}ms`);
  
  // Try to click download button
  try {
    const downloadBtn = await page.$('button[aria-label="Download PDF"]');
    if (downloadBtn) {
      await downloadBtn.click();
      console.log('Download button clicked, waiting for download...');
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch(e) {
    console.log('No download button or error clicking it:', e);
  }
  
  await browser.close();
})();
