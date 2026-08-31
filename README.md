# [BRAND NAME] PDF Compressor

A compact Chrome extension for private, client-side PDF processing. Currently supports local PDF selection, drag-and-drop, and PDF inspection (page count, parse validity). No compression is implemented yet; no files leave the device.

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

No permissions, host permissions, content scripts, or background service worker are used. When several files are dropped, the popup accepts the first valid PDF only.

---

## PDF Processing

### Selected library

**pdf-lib 1.17.1** — MIT License

Source: <https://github.com/Hopding/pdf-lib>

### Role in this project

pdf-lib is used **exclusively for PDF inspection**. When a user selects a file, the extension reads it locally as an `ArrayBuffer` and passes it to `pdf-lib`'s parser to determine:

- whether the document can be successfully parsed
- the page count
- the original file size (sourced directly from the `File` object)

**pdf-lib is not the compression engine.** No compression of any kind is performed in this version.

### Abstraction boundary

All pdf-lib usage is isolated in `src/lib/pdfInspector.ts`. The rest of the application depends only on the `PdfInspectionResult` type and the `inspectPdf(file)` function exported from that module. pdf-lib types do not leak into other components.

This boundary exists so that the underlying inspection or compression implementation can be replaced without changing the application or UI architecture.

### Current capabilities

| Capability | Status |
|---|---|
| Parse validity check | ✅ |
| Page count | ✅ |
| Original file size | ✅ |
| Encrypted PDF detection | ✅ (detected, not bypassed) |
| Compression | ❌ Not implemented |
| Output generation | ❌ Not implemented |

### Known limitations

- **pdf-lib 1.17.1 is unmaintained.** The last npm release was in 2021. It remains functionally stable for inspection use, but will not receive security patches or compatibility updates. This is an accepted tradeoff for this phase.
- **No image re-compression.** pdf-lib cannot extract, re-encode, and replace embedded images with changed quality settings. Any compression in a future phase will require either a different implementation or a hybrid approach.
- **No WASM.** The current implementation is pure JavaScript. Higher-fidelity compression (e.g., Ghostscript-class) would require a WASM-based engine and a corresponding license review.
- **Memory**: Very large PDFs (hundreds of MB) are parsed in-memory. There is no streaming parse path in pdf-lib.

### Future compression architecture — open decision

The final compression engine has **not been selected**. Candidates under consideration for a future phase include:

- **Hybrid JS approach**: pdf-lib for structural rewriting + Canvas API for targeted image re-encoding. Preserves text/vector fidelity.
- **WASM engine (e.g., MuPDF)**: Ghostscript-class compression quality. Requires resolving AGPL / commercial license before use in a potentially commercial extension.
- **Image-reconstruction mode**: Render pages to canvas, re-encode as JPEG, rebuild PDF. High compression ratio but destroys text layer, accessibility, and copy/paste. Considered only as a fallback mode.

This decision will be made in Phase 4 based on tested compression quality and license compliance.

### Privacy

The PDF never leaves the device:

- No `fetch()` calls contain file data
- No external processing services are contacted
- No analytics payloads include file information
- No file content is stored persistently
- No remote scripts are loaded
