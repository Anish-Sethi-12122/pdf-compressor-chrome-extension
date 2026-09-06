import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAttributionTests() {
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
  
  console.log('--- RUNNING ATTRIBUTION & SUPPORT TESTS ---');
  await page.goto(popupUrl);
  await page.waitForSelector('.attribution');

  // Check Attribution text and link
  const attributionLink = await page.$('.attribution-link');
  if (!attributionLink) throw new Error('Attribution link not found');
  
  const href = await page.evaluate(el => el.getAttribute('href'), attributionLink);
  if (href !== 'https://linkedin.com/in/anish-sethi-dtu-cse') {
    throw new Error('LinkedIn link is incorrect: ' + href);
  }

  const text = await page.evaluate(el => el.textContent, attributionLink);
  if (text !== 'Anish Sethi') {
    throw new Error('Attribution link text is incorrect: ' + text);
  }

  const parentText = await page.evaluate(() => document.querySelector('.attribution').textContent);
  if (!parentText.includes('By') || !parentText.includes('❤️') || !parentText.includes('Anish Sethi')) {
    throw new Error('Attribution text is incorrect: ' + parentText);
  }
  console.log('Attribution text and link are correct');

  // Check Buy Me a Coffee
  const supportCta = await page.$('.support-cta');
  if (!supportCta) throw new Error('Support CTA not found');

  const ctaHref = await page.evaluate(el => el.getAttribute('href'), supportCta);
  const isUnconfigured = await page.evaluate(el => el.classList.contains('support-cta--unconfigured'), supportCta);
  
  if (isUnconfigured) {
    throw new Error('Support CTA should not be marked unconfigured since a URL was provided');
  }
  
  if (ctaHref !== 'https://buymeacoffee.com/anishsethi') {
    throw new Error('Support CTA href is incorrect: ' + ctaHref);
  }
  console.log('Buy Me a Coffee CTA is correctly configured');

  // Tab order test
  console.log('Testing Tab Order');
  await page.keyboard.press('Tab'); // mode selector
  await page.keyboard.press('Tab'); // upload button
  await page.keyboard.press('Tab'); // attribution link
  
  let activeElement = await page.evaluate(() => document.activeElement.className);
  if (activeElement !== 'attribution-link') {
    throw new Error('Tab order did not reach attribution link, reached: ' + activeElement);
  }
  
  await page.keyboard.press('Tab'); // support cta
  activeElement = await page.evaluate(() => document.activeElement.className);
  if (!activeElement.includes('support-cta')) {
    throw new Error('Tab order did not reach support cta, reached: ' + activeElement);
  }
  
  console.log('Tab order is correct');
  await browser.close();
  console.log('All attribution tests passed.');
}

runAttributionTests().catch(err => {
  console.error(err);
  process.exit(1);
});
