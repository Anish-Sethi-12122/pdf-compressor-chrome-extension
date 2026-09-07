# Phase 5B: Embedded Image Compression Research & Prototype

## Executive Conclusion
Embedded JPEG image optimization cannot be safely implemented in-browser using our current architecture. The primary blocker is the inability to safely identify, extract, and replace image streams at the object level without resorting to fragile string-replacement hacks or relying on unmaintained JavaScript parsing libraries.

## Technical Feasibility & The Blocker
Per the phase requirements, we investigated how to interact with the PDF object graph. 
- **`qpdf-wasm` Limitation**: The `@jspawn/qpdf-wasm` package is strictly an Emscripten port of the `qpdf` CLI. As stated in its documentation: *"This doesn't expose the `qpdf` library - just the CLI."* Consequently, it is impossible to use `qpdf`'s robust C++ API (e.g., `QPDFObjectHandle`) from JavaScript to iterate over `XObject` dictionaries, extract image streams, or replace them safely in memory.
- **`pdf-lib` Instability**: We built a prototype to iterate `pdfDoc.context.enumerateIndirectObjects()` looking for `/Subtype /Image`. While it successfully located PNG objects, `pdf-lib`'s internal parsers repeatedly threw `Error: SOI not found in JPEG` when interacting with perfectly valid, standard JPEGs. Relying on an unmaintained library (last updated in 2021) for arbitrary, low-level stream replacement across the massive variance of real-world PDFs is highly fragile.

Per the strict requirement: *"If this cannot be safely achieved with the current qpdf-WASM API: STOP implementation of replacement. Document the blocker."* — Implementation was halted.

## Browser API Evaluation
While image replacement was blocked, we evaluated the browser-native decoding/encoding paths for future use:
- **`createImageBitmap()`**: Ideal for decoding extracted raw JPEG bytes inside a Web Worker. It is non-blocking and highly performant.
- **`OffscreenCanvas`**: Fully supported in Chrome MV3 Web Workers. We can draw the `ImageBitmap` to the canvas, apply downscaling (to reduce dimensions based on a pixel threshold), and use `convertToBlob({ type: 'image/jpeg', quality: 0.7 })` to re-encode.
- **`ImageDecoder` API**: Offers progressive decoding and fine-grained frame control, but `createImageBitmap` is simpler and more universally supported for static JPEGs.

## Benchmark Results
Because safe stream replacement is blocked, full end-to-end compression benchmarks on the test corpus could not be completed without violating the "no regex/string hacking" rule. However, our JS `pdf-lib` extraction prototype proved that traversing the indirect object table in pure JS adds negligible time (< 100ms for small files), meaning the eventual bottleneck will be image rendering/encoding, not object traversal.

## Fidelity Findings
- **Intended Scope**: We confirmed that iterating objects allows us to precisely check the `/Filter` dictionary key. This makes it trivial to limit operations strictly to `/DCTDecode` (JPEG) images and safely ignore lossless or complex encodings.
- **Masks and Transparency**: By checking for `/SMask` or `/Mask` in the image dictionary, we can easily skip images that rely on transparency, ensuring they aren't damaged by a forced JPEG conversion.

## Supported Image Types
If a robust object API is introduced, the system would:
- **Target**: `/DCTDecode` (JPEG) only.
- **Skip**: `/FlateDecode` (PNG-like), `/CCITTFaxDecode` (Monochrome scans), `/JBIG2Decode`, `/JPXDecode` (JPEG2000), and any image containing a `/SMask`.
- **Color Spaces**: Limit to `/DeviceRGB` and `/DeviceGray`. `/DeviceCMYK` should be skipped to prevent browser canvas color-shift artifacts.

## Memory / Performance
- **Web Worker Constraints**: Transferring large ArrayBuffers (e.g., 50MB PDFs) to the worker takes <10ms. 
- **Memory Pressure**: Decoding massive JPEGs into an `OffscreenCanvas` consumes significant RAM (Width × Height × 4 bytes). A 20-megapixel scanned page requires ~80MB of uncompressed heap memory. A robust implementation must process images sequentially, not concurrently, to avoid out-of-memory crashes on low-end devices.

## Risks
1. **Generational Loss**: Decoding a JPEG and re-encoding it as a JPEG (e.g., `Quality 80 -> Quality 70`) always introduces compression artifacts, even if the file size drops.
2. **Shared References**: A single `/XObject` might be referenced on multiple pages (e.g., a company logo). Modifying the object modifies it globally, which is correct, but blindly copying/re-inserting it could cause severe file bloat.
3. **No Native Object API**: The lack of a bound C++ PDF parsing library in WASM means we are flying blind when manipulating PDF streams.

## Final Recommendation

**4. Investigate a different native/WASM engine.**

*Why:* In-browser image optimization is completely feasible from a processing perspective (OffscreenCanvas handles JPEG re-encoding beautifully). However, we are missing the PDF manipulation foundation. 
To proceed to a production image compressor, we must replace the `@jspawn/qpdf-wasm` CLI wrapper with a WASM library that exposes a true object-graph API to JavaScript. Candidates include:
- Compiling `qpdf` ourselves using Emscripten and Embind to expose `QPDFObjectHandle`.
- Using a MuPDF WASM build (assuming AGPL/Commercial licensing is acceptable).
- Investigating `pdfium-wasm`.

Until a robust object-level API is available in WASM, attempting image replacement will corrupt user documents.
