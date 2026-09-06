<div align="center">
  <img src="Store Listing/Icons/icon-128.png" alt="PDF Compressor Logo" width="128" />
  
  # PDF Compressor
  
  **Fast, Private, 100% Local PDF Compression for Google Chrome**

  [![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](#)
  [![License](https://img.shields.io/badge/license-BSD--3--Clause-green.svg)](LICENSE)
  [![Privacy](https://img.shields.io/badge/privacy-local--only-success.svg)](#)
  [![Permissions](https://img.shields.io/badge/permissions-0-brightgreen.svg)](#)
  [![Platform](https://img.shields.io/badge/platform-Chrome_Extension-yellow.svg)](#)

  <p align="center">
    A client-side browser extension that shrinks your PDFs without the hassle and without compromising your privacy. Built with React, TypeScript, and a custom WebAssembly compilation of qpdf.
  </p>
</div>

---

## 🌟 Why PDF Compressor?

Most PDF compression tools require you to upload your sensitive documents to a remote server. **PDF Compressor is different.** 

Using a highly-optimized WebAssembly engine, it processes your files entirely locally inside your browser. No data harvesting, no cloud servers, and no permissions required.

- **🔒 100% Private**: Your files never leave your device.
- **⚡ Lightning Fast**: Desktop-grade compression speeds in the browser.
- **🛡️ Zero Permissions**: Requests exactly `0` permissions in its manifest.
- **🎯 Smart Validation**: Automatically ensures the compressed PDF is structurally valid and actually smaller.

## 📸 Screenshots

| Uploading | Compression Complete |
| :---: | :---: |
| <img src="Store Listing/Screenshots/1_Initial.png" width="400" /> | <img src="Store Listing/Screenshots/2_Completed.png" width="400" /> |

## 🚀 Features

*   **Three Compression Modes:**
    *   **Balanced (Default):** The optimal mix of size reduction and visual clarity (JPEG quality 0.82, downsampled to 2400px longest edge).
    *   **Low:** Minimal compression for excellent quality (JPEG quality 0.90, downsampled to 3000px longest edge).
    *   **High:** Aggressive compression for maximum space savings (JPEG quality 0.60, downsampled to 1600px longest edge).
*   **Intelligent Replacement:** Extracts eligible large image streams, re-encodes them as lossy JPEGs, and replaces them while preserving native document structure.
*   **Original File Fallback:** If compression isn't worthwhile or the output is invalid, the original file is safely retained.
*   **Accessibility First:** Fully navigable via keyboard (`Tab` / `Shift+Tab`) with correct ARIA live regions for screen readers.

## 🛠️ Architecture

**Core Libraries:**
*   **Custom qpdf WebAssembly (`qpdf_wrapper.wasm`)**: Compiled specifically for this project. Performs structural optimization, linearization, and stream extraction/replacement.
*   **pdf-lib (1.17.1)**: Used exclusively for lightweight, fast PDF inspection (page count, validity check) before and after compression.

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

### Loading in Chrome
1. Navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the `dist` directory.

> **Note:** The extension requires the `wasm-unsafe-eval` CSP directive for the WebWorker to execute the qpdf WASM module, but it requests **0 permissions** from the browser.

## 🧪 Testing

Run the full suite of regression, UI, accessibility, and lifecycle tests:

```bash
node test-extension.mjs
node test-modes.mjs
node test-mode-ui.mjs
node test-accessibility.mjs
node test-hardening.mjs
node test-analytics.mjs
node test-attribution.mjs
node test-ga4.mjs
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

## 🛡️ Security

Please read our [SECURITY.md](SECURITY.md) for security policies and vulnerability reporting guidelines.

## 💖 Support the Project

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
