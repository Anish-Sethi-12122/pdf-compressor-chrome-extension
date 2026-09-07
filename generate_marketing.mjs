import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  
  // Screenshots
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const fileUrl = 'file://' + path.join(__dirname, 'marketing.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  for (let i = 1; i <= 5; i++) {
    const element = await page.$(`#slide${i}`);
    await element.screenshot({ path: `Store Listing/Screenshots/Marketing_${i}.png` });
    console.log(`Saved Marketing_${i}.png`);
  }

  // Promo Small (440x280)
  const promoSmallPage = await browser.newPage();
  await promoSmallPage.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
  await promoSmallPage.goto(fileUrl, { waitUntil: 'networkidle0' });
  const promoSmallElement = await promoSmallPage.$('#promo-small');
  await promoSmallElement.screenshot({ path: `Store Listing/PromoTile_Small_440x280.png` });
  console.log(`Saved PromoTile_Small_440x280.png`);

  // Promo Marquee (1400x560)
  const promoMarqueePage = await browser.newPage();
  await promoMarqueePage.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });
  await promoMarqueePage.goto(fileUrl, { waitUntil: 'networkidle0' });
  const promoMarqueeElement = await promoMarqueePage.$('#promo-marquee');
  await promoMarqueeElement.screenshot({ path: `Store Listing/PromoTile_Marquee_1400x560.png` });
  console.log(`Saved PromoTile_Marquee_1400x560.png`);

  await browser.close();
})();
