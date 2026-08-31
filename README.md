# [BRAND NAME] PDF Compressor

A compact Chrome extension for private, client-side PDF processing. Supports local PDF selection, drag-and-drop, and structural lossless PDF compression using a Web Worker. No files leave the device.

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

- **qpdf-wasm**: Used exclusively for **lossless structural optimization**. It runs in a dedicated Web Worker to linearize, generate object streams, and recompress Flate streams.
- **pdf-lib**: Used exclusively for **PDF inspection** (page count, validity check) before and after compression.

**Important Note on Original-File Passthrough:** If qpdf's structural optimization does not reduce the file size (e.g., the PDF is already efficiently packed), the extension automatically retains and returns the original file unaltered.

### Current capabilities

| Capability | Status |
|---|---|
| Parse validity check | ✅ |
| Page count | ✅ |
| Lossless structural compression | ✅ |
| Web Worker offloading | ✅ |
| Image resampling / re-encoding | ❌ Not implemented (Phase 5B) |
| Output generation & Download | ✅ |

### Known limitations

- **No image optimization yet:** This phase implements structural compression only. Large, uncompressed images (the most common cause of bloated PDFs) are not yet downsampled or converted to JPEG. Phase 5B will investigate an image-processing layer (via Canvas/OffscreenCanvas).
- **Signed/Encrypted PDFs:** Digital signatures may be invalidated if the PDF structure is modified. Encrypted PDFs are currently detected and rejected during the inspection phase.
- **Memory footprint:** Large PDFs are processed in-memory within the WASM heap. Exceptionally large files may cause memory allocation failures.

### Privacy

The PDF never leaves the device:

- No `fetch()` calls contain file data
- No external processing services are contacted
- No analytics payloads include file information
- No file content is stored persistently
- No remote scripts are loaded (WASM bundle is local)
