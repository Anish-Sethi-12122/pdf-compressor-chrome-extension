# PDF Compressor

A private, client-side PDF compression utility for Google Chrome. Supports local PDF selection, drag-and-drop, and a hybrid compression engine using a Web Worker. No files leave the device.

## Core Features
*   **100% Local Processing:** Compression happens directly in your browser using a custom WebAssembly build of qpdf. No PDFs are uploaded to any server.
*   **Compression Modes:**
    *   **Balanced (Default):** Good compression and good quality (JPEG quality 0.82, downsampled to 2400px longest edge).
    *   **Low:** Low compression, excellent quality (JPEG quality 0.90, downsampled to 3000px longest edge).
    *   **High:** High compression, average quality (JPEG quality 0.60, downsampled to 1600px longest edge).
*   **Candidate Validation:** Ensures the compressed PDF is structurally valid and actually smaller than the original. If not, the original file is safely retained.
*   **Privacy-First:** Zero tracking without explicit consent. Analytics (GA4) are fully opt-in and collect no PDF data.
*   **Zero Permissions Required:** The extension does not ask for <all_urls>, storage, or any other host permissions.

## Requirements
*   Node.js 20.19+ or 22.12+
*   npm

## Development Setup

1.  Install dependencies:
    `ash
    npm install
    `
2.  Start Vite's development server (for UI development):
    `ash
    npm run dev
    `
3.  Build the unpacked extension:
    `ash
    npm run build
    `
    The Chrome-ready build is created in the dist/ directory.

## Testing

Run the full suite of regression, UI, accessibility, and lifecycle tests:

`ash
node test-extension.mjs
node test-modes.mjs
node test-mode-ui.mjs
node test-accessibility.mjs
node test-hardening.mjs
node test-analytics.mjs
node test-attribution.mjs
node test-ga4.mjs
`

**Note on Test/Benchmark Infrastructure:** The repository intentionally retains test fixtures (	est_fixture.pdf), historical benchmarking scripts (enchmark.mjs, enchmark/), and WASM compilation dependencies (.venv, msdk, jpeg, zlib, qpdf, qpdf_wrapper.cpp, uild_wasm.bat). These are preserved for reproducibility, development, diagnostics, and regression testing.

## Analytics Configuration
Analytics are strictly opt-in. The extension communicates directly with Google Analytics 4 via the Measurement Protocol.
Because there is no backend, the API secret is bundled with the extension in production.

To configure analytics for development/forks:
1.  Copy src/lib/analytics/analyticsConfig.example.ts to src/lib/analytics/analyticsConfig.ts.
2.  Replace the placeholder values (MEASUREMENT_ID and API_SECRET) with your own GA4 credentials.
3.  Do **NOT** commit nalyticsConfig.ts to version control (it is ignored by default).

## PDF Processing Architecture

**Libraries Used:**
*   **Custom qpdf WebAssembly (qpdf_wrapper.wasm)**: Compiled specifically for this project. Performs structural optimization, linearisation, and stream extraction/replacement.
*   **pdf-lib (1.17.1)**: Used exclusively for lightweight, fast PDF inspection (page count, validity check) before and after compression.

**Workflow:**
The engine extracts eligible large image streams from the PDF, re-encodes them as lossy JPEGs using the selected preset, and replaces them in the document. Finally, it performs a structural optimisation pass. If the resulting file is valid and smaller, it is offered for download.

### Monetization and Security Decisions
*   **No Third-Party Ads:** After thorough research, integrating third-party advertising (AdSense, Adsterra, etc.) was explicitly rejected. Ad networks require remote code execution which violates Manifest V3 CSP, and often introduce opaque tracking vectors that compromise this extension's strict privacy invariants.
*   **No CAPTCHA:** Implementing CAPTCHA was researched and rejected. Because this extension operates entirely locally without a backend, CAPTCHA provides no meaningful security value and would require invasive tracking or unacceptable architectural changes (like adding a backend server).

## Loading in Chrome
1.  Run 
pm run build.
2.  Open chrome://extensions in Chrome.
3.  Enable **Developer mode**.
4.  Select **Load unpacked**.
5.  Choose this project's dist directory.

The extension requires the wasm-unsafe-eval CSP directive for the WebWorker to execute the qpdf WASM module, but it requests **0 permissions** from the browser.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Security
See [SECURITY.md](SECURITY.md) for security policies and reporting guidelines.
