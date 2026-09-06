import puppeteer from 'puppeteer';
import http from 'http';
import serveStatic from 'serve-static';
import finalhandler from 'finalhandler';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serve = serveStatic(path.join(__dirname, 'dist'), { index: ['index.html'] });
const server = http.createServer((req, res) => {
  serve(req, res, finalhandler(req, res));
});

server.listen(3000, async () => {
  console.log('Server running on 3000');
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // High quality screenshots 1280x800 as required by Chrome Web Store
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  
  // Custom CSS to center the extension UI nicely on a larger page for the screenshot
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: 'body { display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6; } #root { box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden; transform: scale(1.5); }' });

  // Screenshot 1: Initial state
  await page.screenshot({ path: 'Store Listing/Screenshots/1_Initial.png' });
  
  // Upload a file
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(path.join(__dirname, 'test_fixture.pdf'));
  
  // Wait for the compression to finish
  await new Promise(r => setTimeout(r, 3000));
  
  // Screenshot 2: Completed state
  await page.screenshot({ path: 'Store Listing/Screenshots/2_Completed.png' });
  
  await browser.close();
  server.close();
  console.log('Screenshots captured');
});
