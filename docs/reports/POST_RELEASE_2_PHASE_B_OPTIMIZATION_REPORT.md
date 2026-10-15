# Post-Release 2: Phase B Implementation & Optimization Report

## 1. Executive Summary

Phase B successfully implemented the three high-ROI optimizations identified in Phase A, addressing the primary architectural causes of the compression gap between PDF Compressor V1 and commercial tools.

All changes were implemented natively inside the client-side pipeline without violating architectural invariants.

### Key Implemented Capabilities
1. **JPEG Quality Calibration:** Adopted an evidence-based 3-tier quality profile (`Low = 0.90`, `Balanced = 0.72`, `High = 0.60`).
2. **Dual-Constraint Pixel-Area Downsampling:** Added a total pixel-area budget constraint (`Low = 4.0 MP`, `Balanced = 2.0 MP`, `High = 1.0 MP`) working in conjunction with edge limits.
3. **FlateDecode / PNG Support with C++ Predictor Reversal:** Extended `qpdf_wrapper.cpp` with `getDecodedStreamData()` using QPDF's native `getStreamData(qpdf_dl_all)` to decompress zlib streams and reverse PNG filters in C++. Decoded pixels are converted to `ImageData`, scaled, re-encoded as JPEGs, and accepted only when achieving at least 30% savings.

---

## 2. Implementation Architecture

### 2.1 C++ WebAssembly Bridge (`qpdf_wrapper.cpp`)
Added `getDecodedStreamData(int obj_id, int gen)`:
```cpp
val getDecodedStreamData(int obj_id, int gen) {
    QPDFObjectHandle obj = pdf.getObjectByID(obj_id, gen);
    if (!obj.isStream()) return val::null();

    std::shared_ptr<Buffer> buf = obj.getStreamData(qpdf_dl_all);
    if (!buf) return val::null();

    return val(typed_memory_view(buf->getSize(), buf->getBuffer()));
}
```
*Compiled using Emscripten `-O3 --bind -s USE_LIBJPEG=1 -s DYNAMIC_EXECUTION=0` into `qpdf_wrapper.wasm`.*

### 2.2 Dual-Constraint Downsampling (`imageProcessor.ts`)
```typescript
let scale = 1.0;
if (Math.max(originalWidth, originalHeight) > config.maxImageDimension) {
  scale = config.maxImageDimension / Math.max(originalWidth, originalHeight);
}
if (config.maxImageArea && (originalWidth * originalHeight) > config.maxImageArea) {
  const areaScale = Math.sqrt(config.maxImageArea / (originalWidth * originalHeight));
  scale = Math.min(scale, areaScale);
}

if (scale < 1.0) {
  targetWidth = Math.max(1, Math.round(originalWidth * scale));
  targetHeight = Math.max(1, Math.round(originalHeight * scale));
  resized = true;
}
```

### 2.3 FlateDecode Pixel Packing & Strict Threshold
- Decompressed raw 8-bit RGB or Grayscale bytes are mapped to a `Uint8ClampedArray` (RGBA) to build `ImageData`, which is decoded via `createImageBitmap()`.
- Lossy conversion threshold:
```typescript
let requiredThreshold = config.replacementThreshold; // default 0.10 (10%)
if (candidate.filter === '/FlateDecode') {
  // Demand at least 30% savings to justify lossy format conversion
  requiredThreshold = Math.max(requiredThreshold, 0.30);
}
```

---

## 3. Before vs After Benchmark Evidence

Automated headless Puppeteer benchmark results across the full test corpus:

| Fixture File | Original Size | Baseline V1 (Balanced) | Phase B Low | Phase B Balanced | Phase B High | Key Impact |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `alpha-photo-heavy.pdf` | 437.3 KB | 84.2% saved | 79.6% | **87.8%** | **93.4%** | Balanced saved 23% more retained bytes; High reached 93.4%. |
| `alpha-scanned.pdf` | 210.4 KB | 84.4% saved | 80.8% | **87.6%** | **93.1%** | Text sharpness maintained while reducing file size. |
| `alpha-presentation.pdf` | 211.8 KB | 83.9% saved | 80.3% | **87.1%** | **92.5%** | Vector elements preserved, slides compressed. |
| `large-image.pdf` | 1,027.7 KB | 14.0% saved | 14.0% | **34.9%** | **57.9%** | Area budget downsampled 1429×1429 square crop. |
| `large-png.pdf` | 2,931.5 KB | 0.0% (skipped) | **72.4%** | **81.8%** | **85.1%** | PNG stream decoded and compressed over 80%. |
| `1_text_only.pdf` | 0.9 KB | 0.0% (preserved) | 0.0% | 0.0% | 0.0% | Invariants preserved; non-raster files untouched. |

---

## 4. Architectural Invariants Verification

All protected invariants were verified post-implementation:
- **Zero Network Activity:** All processing occurs via WebAssembly and Canvas in the Web Worker.
- **Sequential In-Document Processing:** Images are decompressed, processed, and replaced one at a time.
- **WorkerPool Integrity:** Batch processing coordinates up to 4 parallel Web Workers without memory leaks.
- **Fail-Safe Fallbacks:** Secondary `pdf-lib` parse check and byte economy checks (`output < input`) remain active.
- **Protected Formats:** `/SMask` (transparent alpha masks), `/Mask`, DeviceCMYK, and multi-filter chains remain safely excluded.

---

## 5. Test Suite Verification

All automated regression and batch tests passed:
- `test-modes.mjs`: PASSED (Low: 140,777 B, Balanced: 81,900 B, High: 43,890 B)
- `test-extension.mjs`: PASSED (End-to-end popup compression and download)
- `test-batch.mjs`: PASSED (Multi-file upload, collision naming, cancellation)

---

## 6. Recommendations for Next Stage (Phase C)

1. **WebP Image Format Support:** Evaluate Canvas `image/webp` encoding for photographic and screenshot content, providing cleaner edges for text and diagrams.
2. **Structural Object Pruning:** Identify and remove unreferenced PDF objects and metadata streams.
3. **Monochrome Document Optimization:** Investigate client-side 1-bit monochrome image compression (CCITTFaxDecode) for black-and-white scanned documents.
