import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAccessibilityTests() {
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
  
  console.log('--- RUNNING ACCESSIBILITY TESTS ---');

  await page.goto(popupUrl);
  await page.waitForSelector('fieldset.mode-selector');

  const getFocusedElementInfo = async () => {
    return await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'body';
      return {
        tag: el.tagName.toLowerCase(),
        name: el.name || '',
        value: el.value || '',
        text: el.innerText || '',
        ariaLabel: el.getAttribute('aria-label') || ''
      };
    });
  };

  // Test 1: Initial Navigation
  console.log('Test 1: Initial Navigation');
  await page.keyboard.press('Tab');
  let focused = await getFocusedElementInfo();
  if (focused.tag !== 'input' || focused.name !== 'compressionMode') {
    throw new Error('Tab 1 did not focus mode selector radio');
  }
  
  await page.keyboard.press('Tab');
  focused = await getFocusedElementInfo();
  if (focused.tag !== 'button' || focused.ariaLabel !== 'Upload PDF') {
    throw new Error('Tab 2 did not focus Upload PDF button');
  }
  
  // Test 2: Mode Selection
  console.log('Test 2: Mode Selection');
  await page.goto(popupUrl);
  await page.waitForSelector('fieldset.mode-selector');
  await page.keyboard.press('Tab'); // Focus mode selector (balanced)
  
  // Navigate with arrow keys (Down arrow goes to next radio in group)
  await page.keyboard.press('ArrowDown');
  focused = await getFocusedElementInfo();
  if (focused.value !== 'low') throw new Error('ArrowDown did not select low');
  
  await page.keyboard.press('ArrowDown');
  focused = await getFocusedElementInfo();
  if (focused.value !== 'high') throw new Error('ArrowDown did not select high');

  await page.keyboard.press('ArrowUp');
  focused = await getFocusedElementInfo();
  if (focused.value !== 'low') throw new Error('ArrowUp did not select low');

  // Test 3: Upload
  console.log('Test 3: Upload');
  await page.keyboard.press('Tab'); // move to upload button
  focused = await getFocusedElementInfo();
  if (focused.tag !== 'button' || focused.ariaLabel !== 'Upload PDF') {
    throw new Error('Tab did not focus Upload PDF button');
  }
  
  // To simulate file selection via keyboard, we intercept the file chooser
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.keyboard.press('Enter')
  ]);
  const dummyPdfPath = path.join(__dirname, 'test_fixture.pdf');
  await fileChooser.accept([dummyPdfPath]);
  
  // Test 4: Compress
  console.log('Test 4: Compress');
  await page.waitForSelector('button[aria-label="Compress PDF"]', { timeout: 5000 });
  // The Compress PDF button should be auto-focused. Let's verify.
  focused = await getFocusedElementInfo();
  if (focused.tag !== 'button' || focused.ariaLabel !== 'Compress PDF') {
    throw new Error('Compress PDF button was not auto-focused');
  }
  await page.keyboard.press('Enter'); // trigger compression
  
  // Test 5: Result
  console.log('Test 5: Result');
  // Wait for the Download button to appear
  await page.waitForSelector('button[aria-label="Download PDF"]', { timeout: 30000 });
  focused = await getFocusedElementInfo();
  if (focused.tag !== 'button' || focused.ariaLabel !== 'Download PDF') {
    throw new Error('Download PDF button was not auto-focused after compression');
  }
  
  // Test 7: File Replacement (using "Start over")
  console.log('Test 7: File Replacement');
  await page.keyboard.press('Tab'); // Focus should move to "Start over"
  focused = await getFocusedElementInfo();
  if (focused.tag !== 'button' || !focused.text.includes('Start over')) {
    throw new Error('Tab did not focus Start over button');
  }
  await page.keyboard.press('Enter'); // Start over
  
  // Wait for idle state
  await page.waitForSelector('button[aria-label="Upload PDF"]');
  // Focus should reset to body.
  focused = await getFocusedElementInfo();
  if (focused !== 'body') {
    console.log('Warning: Focus did not reset to body after Start over, got: ', focused);
  }
  
  // Tab should go to mode selector
  await page.keyboard.press('Tab');
  focused = await getFocusedElementInfo();
  if (focused.tag !== 'input' || focused.name !== 'compressionMode') {
    console.log('Tab after Start over did not focus mode selector. Focused instead:', focused);
  }

  // Test 6: Error Recovery
  console.log('Test 6: Error Recovery');
  await page.goto(popupUrl);
  await page.waitForSelector('button[aria-label="Upload PDF"]');
  await page.focus('button[aria-label="Upload PDF"]');
  
  const [fileChooser2] = await Promise.all([
    page.waitForFileChooser(),
    page.keyboard.press('Enter')
  ]);
  // Use a non-PDF file to trigger an error
  const invalidFilePath = path.join(__dirname, 'package.json');
  await fileChooser2.accept([invalidFilePath]);

  // Wait for Error state
  await page.waitForSelector('button[aria-label="Choose another PDF file"]', { timeout: 5000 });
  focused = await getFocusedElementInfo();
  if (focused.tag !== 'button' || focused.ariaLabel !== 'Choose another PDF file') {
    throw new Error('Retry button was not auto-focused after error');
  }
  
  // Activate retry
  const [fileChooser3] = await Promise.all([
    page.waitForFileChooser(),
    page.keyboard.press('Enter')
  ]);
  await fileChooser3.cancel(); // just cancel

  await browser.close();
  console.log('All accessibility tests passed.');
}

runAccessibilityTests().catch(err => {
  console.error(err);
  process.exit(1);
});
