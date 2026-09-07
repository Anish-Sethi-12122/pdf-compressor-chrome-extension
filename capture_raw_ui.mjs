import puppeteer from 'puppeteer';
import http from 'http';
import serveStatic from 'serve-static';
import finalhandler from 'finalhandler';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serve = serveStatic(path.join(__dirname, 'dist'), { index: ['index.html'] });
const server = http.createServer((req, res) => {
  serve(req, res, finalhandler(req, res));
});

server.listen(3000, async () => {
  console.log('Server running on 3000');
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 600, height: 800, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  // Make body transparent so we only get the UI
  await page.evaluate(() => {
    document.body.style.background = 'transparent';
    document.getElementById('root').style.borderRadius = '16px';
    document.getElementById('root').style.boxShadow = '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)';
  });

  const rootElement = await page.$('#root');

  // Screenshot 1: Dropzone
  await rootElement.screenshot({ path: 'Store Listing/Screenshots/raw_ui_1.png' });
  
  // Upload a file
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(path.join(__dirname, 'test_fixture.pdf'));
  
  // Wait for the compression to finish
  await new Promise(r => setTimeout(r, 4000));
  
  // Screenshot 2: Completed state
  await rootElement.screenshot({ path: 'Store Listing/Screenshots/raw_ui_2.png' });
  
  await browser.close();
  server.close();
  console.log('Raw UI screenshots captured');
});
