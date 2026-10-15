<div align="center">
  <img src="https://raw.githubusercontent.com/Anish-Sethi-12122/pdf-compressor-chrome-extension/2aa5c60213f39809378906a2744abbadd6c49c91/Store%20Listing/PromoTile_Marquee_1400x560.png" alt="PDF Compressor Promo" width="100%" />
  
  # PDF Compressor
  
  **Fast, Private, 100% Local PDF Compression for Google Chrome**

  [![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](#)
  [![License](https://img.shields.io/badge/license-BSD--3--Clause-green.svg)](LICENSE)
  [![Privacy](https://img.shields.io/badge/privacy-local--only-success.svg)](#)
  [![Permissions](https://img.shields.io/badge/permissions-0-brightgreen.svg)](#)
  [![Platform](https://img.shields.io/badge/platform-Chrome_Extension-yellow.svg)](#)

  <p align="center">
    A client-side browser extension that shrinks your PDFs without the hassle and without compromising your privacy. Built with React, TypeScript, and a custom WebAssembly compilation of qpdf.
  </p>
</div>

---

## 🚀 Why PDF Compressor?

Most PDF compression tools require you to upload your sensitive documents to a remote server. **PDF Compressor is different.** 

Using a highly-optimized WebAssembly engine, it processes your files entirely locally inside your browser. No data harvesting, no cloud servers, and no permissions required.

- **🔒 100% Private**: Your files never leave your device.
- **⚡ Lightning Fast**: Desktop-grade compression speeds in the browser.
- **🛡️ Zero Permissions**: Requests exactly `0` permissions in its manifest.
- **✅ Smart Validation**: Automatically ensures the compressed PDF is structurally valid and actually smaller.

## 📥 Installation

### Option 1: Install via Chrome Web Store (Recommended)

The easiest and most secure way to install PDF Compressor is directly through the official Google Chrome Web Store. 

1. Visit the public listing of [PDF Compressor on Chrome Web Store](https://chromewebstore.google.com/detail/pdf-compressor/mpgmhonjnchjjgbofkjkghmgmnpkfomn)
2. Click **"Add to Chrome"**.
3. Pin the extension to your toolbar for easy access!

### Option 2: Manual Installation (Developer Mode)

If you prefer to load the extension manually from a downloaded release:

1. Download the latest `PDF_Compressor_Release_v2.0.0.zip` from the [Releases page](https://github.com/Anish-Sethi-12122/pdf-compressor-chrome-extension/releases).
2. Extract the ZIP file to a folder on your computer.
3. Open Chrome and navigate to `chrome://extensions`.
4. Turn on **Developer mode** in the top right corner.
5. Click **Load unpacked** and select the folder where you extracted the ZIP.

## 📸 In Action

### Marketing Assets
<div align="center">
  <img src="https://raw.githubusercontent.com/Anish-Sethi-12122/pdf-compressor-chrome-extension/2aa5c60213f39809378906a2744abbadd6c49c91/Store%20Listing/Screenshots/Marketing_1.png" width="48%" />
  <img src="https://raw.githubusercontent.com/Anish-Sethi-12122/pdf-compressor-chrome-extension/2aa5c60213f39809378906a2744abbadd6c49c91/Store%20Listing/Screenshots/Marketing_2.png" width="48%" />
  <img src="https://raw.githubusercontent.com/Anish-Sethi-12122/pdf-compressor-chrome-extension/2aa5c60213f39809378906a2744abbadd6c49c91/Store%20Listing/Screenshots/Marketing_4.png" width="48%" />
  <img src="https://raw.githubusercontent.com/Anish-Sethi-12122/pdf-compressor-chrome-extension/2aa5c60213f39809378906a2744abbadd6c49c91/Store%20Listing/Screenshots/Marketing_5.png" width="48%" />
</div>

### Extension UI

| Initial Upload | Compression Complete |
| :---: | :---: |
| <img src="https://raw.githubusercontent.com/Anish-Sethi-12122/pdf-compressor-chrome-extension/0a4e2a3/Store%20Listing/Screenshots/1_Initial.png" width="400" /> | <img src="https://raw.githubusercontent.com/Anish-Sethi-12122/pdf-compressor-chrome-extension/0a4e2a3/Store%20Listing/Screenshots/2_Completed.png" width="400" /> |


## 🎛️ Features

*   **Three Calibrated Compression Modes:**
    *   **Balanced (Default):** The optimal mix of size reduction and visual clarity (JPEG quality 0.72, max 2400px longest edge or 2.0 Megapixel area budget).
    *   **Low:** Minimal compression for excellent print/presentation fidelity (JPEG quality 0.90, max 3000px longest edge or 4.0 Megapixel area budget).
    *   **High:** Aggressive compression for maximum space savings (JPEG quality 0.60, max 1600px longest edge or 1.0 Megapixel area budget).
*   **Dual-Constraint Downsampling:** Evaluates both longest-edge bounds and total pixel-area budgets, ensuring high-DPI square crops and non-standard aspect ratio images are intelligently downsampled without excessive shrinking or upscaling.
*   **Multi-Format Raster Optimization:** Supports both `/DCTDecode` (JPEG) and safe `/FlateDecode` (PNG / lossless raster) image streams. Decompresses raw image streams and reverses PNG predictors directly in C++ WASM before re-encoding. Automatically synchronizes PDF dictionaries (updating `/ColorSpace` to `/DeviceRGB` and stripping stale `/DecodeParms` / `/Decode` arrays).
*   **Strict Lossy Threshold Protection:** Recompressed JPEGs require at least a 10% size reduction, while lossy `/FlateDecode` conversions enforce a strict 30% reduction threshold to prevent generational artifacts on hard-edged diagrams and text.
*   **Format, Transparency & Decode Safeguards:** Protects transparent images (`/SMask` / `/Mask`), safely excludes non-default `/Decode` arrays (e.g. inverted scans), excludes complex or unsupported color spaces (DeviceCMYK, ICCBased), and rejects multi-filter chains to guarantee PDF visual integrity.
*   **Parallel Batch Processing:** Drop multiple PDFs at once. The extension intelligently utilizes bounded Web Workers based on your hardware concurrency (up to 4 parallel workers) to compress multiple files simultaneously while keeping memory footprints low.
*   **Original File Fallback:** If compression isn't worthwhile (output >= input) or secondary validation fails, the original file is safely retained (`changed: false`).
*   **Accessibility First:** Fully navigable via keyboard (`Tab` / `Shift+Tab`) with correct ARIA live regions for screen readers.

## 🏗️ Architecture

**Core Libraries:**
*   **Custom qpdf WebAssembly (`qpdf_wrapper.wasm`)**: Compiled specifically for this project with Emscripten. Performs structural optimization (object streams, cross-reference deduplication, Flate recompression), raw and decoded stream extraction with native PNG predictor reversal (`getDecodedStreamData`), and in-place image stream replacement.
*   **Browser Canvas / OffscreenCanvas API**: Hardware-accelerated decoding via `createImageBitmap`, high-quality bicubic downsampling, and JPEG re-encoding in isolated Web Workers.
*   **pdf-lib (1.17.1)**: Used exclusively for lightweight, fast PDF inspection (page count, structural integrity) before and after compression.

**Security & Monetization Decisions:**
*   **No Third-Party Ads:** Integrating third-party advertising was explicitly rejected. Ad networks require remote code execution (violating MV3 CSP) and introduce tracking vectors.
*   **No CAPTCHA:** Because this operates entirely locally without a backend, CAPTCHA provides no security value and was rejected.

## 💻 Development Setup

### Requirements
*   Node.js 20.19+ or 22.12+
*   npm

### Building from Source

1.  **Clone & Install**
    ```bash
    git clone https://github.com/Anish-Sethi-12122/pdf-compressor-chrome-extension.git
    cd pdf-compressor-chrome-extension
    npm install
    ```
2.  **Start Development Server** (for UI development)
    ```bash
    npm run dev
    ```
3.  **Build the Extension**
    ```bash
    npm run build
    ```
    *The Chrome-ready unpacked extension will be generated in the `dist/` directory.*

> **Note:** The extension requires the `wasm-unsafe-eval` CSP directive for the WebWorker to execute the qpdf WASM module, but it requests **0 permissions** from the browser.

## 🧪 Testing

Run the full suite of regression, UI, accessibility, and lifecycle tests:

```bash
node test-phase-c-units.mjs      # Fast unit tests (84 assertions: classifiers, validator, memory bridge)
node test-modes.mjs              # Compression mode size ordering verification
node test-mode-ui.mjs            # Mode selector UI interaction and persistence
node test-extension.mjs          # End-to-end browser compression lifecycle
node test-hardening.mjs          # Matrix hardening (corrupted, encrypted, empty, unsupported)
node test-batch.mjs              # Concurrent worker pool & name collision tests
node test-accessibility.mjs      # Keyboard navigation & ARIA compliance
node test-analytics.mjs          # Consent gating & privacy isolation tests
node test-attribution.mjs        # Creator attribution and support links
node test-ga4.mjs                # Telemetry dispatch protocol verification
node run-phase-c1-benchmark.mjs  # Real-world corpus & Chromium PDFium visual rendering benchmark
```

*Note on Test/Benchmark Infrastructure: The repository intentionally retains test fixtures (`test_fixture.pdf`), historical benchmarking scripts (`benchmark.mjs`), and WASM compilation dependencies (e.g., `qpdf_wrapper.cpp`, `build_wasm.bat`). These are preserved for reproducibility and regression testing.*

## 📊 Analytics Configuration

Analytics are strictly **opt-in** and collect no PDF data. The extension communicates directly with Google Analytics 4 via the Measurement Protocol. Because there is no backend, the API secret is bundled with the extension in production (an accepted Google-documented pattern).

To configure analytics for development or forks:
1. Copy `src/lib/analytics/analyticsConfig.example.ts` to `src/lib/analytics/analyticsConfig.ts`.
2. Replace `MEASUREMENT_ID` and `API_SECRET` with your GA4 credentials.
3. Do **NOT** commit `analyticsConfig.ts` to version control (it is ignored by default).

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to help out.

## 🔒 Security

Please read our [SECURITY.md](SECURITY.md) for security policies and vulnerability reporting guidelines.

## ❤️ Support the Project

If this extension saved you time, storage, or just made your life a little easier, please consider supporting its ongoing development!

<div align="center">
  <a href="https://github.com/Anish-Sethi-12122/pdf-compressor-chrome-extension">
    <img src="https://img.shields.io/github/stars/Anish-Sethi-12122/pdf-compressor-chrome-extension?style=for-the-badge&logo=github&color=ffb84d&label=Star%20this%20Repository" alt="Star on GitHub" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://www.buymeacoffee.com/anishsethi">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
  </a>
</div>

<br />

---

<div align="center">
  <i>Created with ❤️ by <a href="https://linkedin.com/in/anish-sethi">Anish Sethi</a></i>
</div>
