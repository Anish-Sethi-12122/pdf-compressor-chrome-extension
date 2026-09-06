# PDF Compressor

A compact Chrome extension for private, client-side PDF processing. Supports local PDF selection, drag-and-drop, and a hybrid compression engine using a Web Worker. No files leave the device.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Development

Install dependencies and start Vite's development server:

```bash
npm install
npm run dev
```

Build the unpacked extension:

```bash
npm run build
```

The Chrome-ready build is created in `dist/`.

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose this project's `dist` directory.
6. Pin **PDF Compressor** from the extensions menu, then click its toolbar icon to open the popup.

The extension requires `wasm-unsafe-eval` CSP for execution but requests **0 permissions**.

---

## PDF Processing Architecture

### Selected libraries

**@jspawn/qpdf-wasm 0.0.2** - Apache-2.0 License
**pdf-lib 1.17.1** - MIT License

### Role in this project

- **qpdf-wasm**: Custom compiled WASM module for both **lossless structural optimization** and **image stream extraction/replacement**. It runs in a dedicated Web Worker to linearize, optimize streams, and replace eligible large images with re-encoded lossy JPEGs.
- **pdf-lib**: Used for **PDF inspection** (page count, validity check) before and after compression.

**Important Note on Original-File Fallback:** If the engine's optimization does not yield a meaningfully smaller file, or if output validation fails, the extension automatically retains and returns the original file unaltered.

### Current capabilities

| Capability | Status |
|---|---|
| Parse validity check | ✅ |
| Page count | ✅ |
| Lossless structural optimization | ✅ |
| Lossy JPEG recompression | ✅ (Balanced preset) |
| Web Worker offloading | ✅ |
| Output generation & Download | ✅ |

### Known limitations

- **Lossy Image Compression:** Currently uses a "Balanced" preset (JPEG quality 0.82, downsample to 2400px longest edge) to compress images. Text and vector content remain losslessly preserved.
- **Signed/Encrypted PDFs:** Digital signatures may be invalidated if the PDF structure is modified. Encrypted PDFs are detected and rejected during the inspection phase.
- **Memory footprint:** Processed sequentially, but exceptionally large PDFs may still cause memory allocation failures.

### Privacy

The PDF never leaves the device:

- No `fetch()` calls contain file data
- No external processing services are contacted
- No analytics payloads include file information
- No file content is stored persistently
- No remote scripts are loaded (WASM bundle is local)
