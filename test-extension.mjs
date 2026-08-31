import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const extensionPath = path.join(__dirname, 'dist');
  
  const browser = await puppeteer.launch({
    headless: false, // extensions only work in headful mode usually
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const dummyPdfPath = path.join(__dirname, 'test-fixtures', 'real.pdf');
  
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  
  // We need to find the extension ID
  // Puppeteer doesn't have a direct way to get it, so we can go to chrome://extensions
  await page.goto('chrome://extensions');
  // Wait a sec for the extension to load in the list
  await new Promise(r => setTimeout(r, 1000));
  
  const extensionId = await page.evaluate(() => {
    // This is a bit hacky, normally one would extract it from the DOM of chrome://extensions
    // or use Chrome DevTools Protocol
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
  
  // Wait for the UI to be ready
  await page.waitForSelector('.upload-dropzone');
  
  // Upload a file
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(dummyPdfPath);
  
  // Wait for Ready state
  await page.waitForSelector('.selected-file__ready', { timeout: 5000 });
  console.log('File ready for compression');
  
  // Click Compress
  const compressBtn = await page.$('button[aria-label="Compress PDF"]');
  const startTime = Date.now();
  await compressBtn.click();
  
  // Wait for Compress result
  // The result has "PDF compressed" or "No further compression needed" or "went wrong" or "Error"
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('PDF compressed') || text.includes('No further compression needed') || text.includes('went wrong');
    }, { timeout: 15000 });
  } catch(e) {
    console.log("Wait failed. Current body:");
    console.log(await page.evaluate(() => document.body.innerText));
    throw e;
  }
  
  const elapsedTime = Date.now() - startTime;
  
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Result text:');
  console.log(text);
  console.log(`Elapsed time: ${elapsedTime}ms`);
  
  await browser.close();
})();
