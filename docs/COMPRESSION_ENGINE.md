# PDF Compressor — Compression Engine Technical Reference

## 1. Architectural Philosophy

PDF Compressor is an entirely client-side, privacy-first PDF optimization engine designed to run inside Google Chrome (Manifest V3).

### Key Architectural Invariants
* **100% Local Processing:** All operations run locally inside browser Web Workers using a custom WebAssembly build of `qpdf` and standard HTML5 Canvas APIs. Zero document bytes are transmitted across a network.
* **Non-Destructive & Fail-Safe:** Compression candidates must pass strict structural validation. If compression produces a file equal to or larger than the input, or if post-compression structural parsing fails, the engine falls back to the original file (`changed: false`).
* **Sequential Image Processing per PDF:** To maintain bounded memory usage, images within a document are processed sequentially rather than concurrently.
* **Worker Thread Isolation:** The engine runs completely off the main UI thread. Batch processing dispatches files to a bounded pool of persistent Web Workers (max 4).
* **Format & Transparency Safety:** Transparent images (`/SMask` or `/Mask`), unsupported color spaces (DeviceCMYK, ICCBased, Indexed), multi-filter chains, and non-8-bit streams are safely excluded to guarantee visual and structural fidelity.

---

## 2. End-to-End Compression Pipeline

The compression pipeline executes a 10-step sequence:

```
[Input PDF Uint8Array]
         │
         ▼
[Step 1: Structural Pre-Check] (pdf-lib: page count, unencrypted verification)
         │
         ▼
[Step 2: Pass 1 Structural Optimization] (qpdf: object streams, flate recompression)
         │
         ▼
[Step 3: Image Stream Inspection] (qpdf inspectImages: dimensions, filters, colorspaces)
         │
         ▼
[Step 4: Image Eligibility Classification] (imageClassifier: filter, bpc, size, mask checks)
         │
         ▼
[Step 5: Stream Extraction & Decompression]
   ├── /DCTDecode   → qpdf.getStreamData() (raw bytes)
   └── /FlateDecode → qpdf.getDecodedStreamData() (C++ zlib decode + PNG predictor reversal)
         │
         ▼
[Step 6: OffscreenCanvas Processing & Re-encoding]
   ├── Dual-constraint downsampling (longest-edge + pixel-area budget)
   ├── OffscreenCanvas / createImageBitmap decode & render
   ├── JPEG re-encoding at profile quality (Q=0.90 / Q=0.72 / Q=0.60)
   └── Threshold evaluation (10% threshold for JPEG; 30% threshold for FlateDecode)
         │
         ▼
[Step 7: In-Place Stream Replacement] (qpdf.replaceImage: stream bytes, filter, width, height)
         │
         ▼
[Step 8: Intermediate State Save] (qpdf.save with stream-data=preserve)
         │
         ▼
[Step 9: Pass 2 Structural Re-Optimization] (qpdf.structuralOptimize on modified PDF)
         │
         ▼
[Step 10: Validation & Selection] (validateOutputPdf: page count, pdf-lib parse, size check)
         │
         ├── Succeeded & Smaller ──► [Optimized PDF Uint8Array (changed: true)]
         └── Failed or Larger     ──► [Original PDF Uint8Array (changed: false)]
```

---

## 3. Compression Modes & Profiles

The engine provides three tuned presets defined in `src/lib/compression/compressionConfig.ts`:

| Mode | Label | JPEG Quality | Max Dimension | Max Area Budget | Min Stream Size | Threshold | Typical Use Case |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Low** | Low Compression | `0.90` | 3,000 px | 4.0 Megapixels | 32 KB | 10% | Archival, printing, presentation documents |
| **Balanced** *(Default)* | Balanced Compression | `0.72` | 2,400 px | 2.0 Megapixels | 32 KB | 10% | Everyday documents, web uploads, scans |
| **High** | High Compression | `0.60` | 1,600 px | 1.0 Megapixels | 16 KB | 10% | Strict email limits (e.g. <25MB), mobile sharing |

*Note: For lossy `/FlateDecode` (PNG to JPEG) conversions, the replacement threshold is dynamically raised to **30%** regardless of profile to ensure that hard-edged vector text, screenshots, and diagrams are not degraded for marginal size benefits.*

---

## 4. Image Pipeline Details

### 4.1 Image Classifier (`imageClassifier.ts`)
Each image XObject stream discovered by `qpdf.inspectImages()` is evaluated against eligibility constraints:
1. **Dimensions:** `width > 0` and `height > 0`.
2. **Filter Chains:** Multi-filter arrays (e.g. `[/FlateDecode, /DCTDecode]`) are skipped (`reason: 'multi_filter'`).
3. **Supported Filters:** Must be `/DCTDecode` or `/FlateDecode` (`reason: 'wrong_filter'`).
4. **Transparency & Masks:** Any presence of `/Mask` or `/SMask` causes exclusion (`reason: 'has_mask'`).
5. **Color Spaces:** Only `/DeviceRGB` and `/DeviceGray` are accepted. `/DeviceCMYK`, `/ICCBased`, `/Indexed`, and `/Separation` are excluded (`reason: 'unsupported_colorspace'`).
6. **Bits Per Component:** Must equal `8`. 1-bit monochrome and 16-bit streams are excluded (`reason: 'unsupported_bits'`).
7. **Stream Size:** Compressed stream bytes (`/Length`) must meet `minEligibleStreamSize` (32 KB or 16 KB) (`reason: 'too_small'`).
8. **Decode Arrays:** Images with non-default `/Decode` arrays (e.g. `/Decode [1.0 0.0]` for black/white inverted scans) are excluded (`reason: 'custom_decode'`) to prevent color inversion.
9. **Deduplication:** Shared XObjects referenced across multiple pages are tracked by `objectId` and processed exactly once.

### 4.2 Stream Extraction & C++/WASM Memory Ownership Bridge
The QPDF wrapper exposes stream extraction methods via Embind:
* `getStreamData(objectId, generation)`: Returns raw compressed stream bytes via `QPDFObjectHandle::getRawStreamData()`. Used for existing `/DCTDecode` (JPEG) streams.
* `getDecodedStreamData(objectId, generation)`: Invokes `QPDFObjectHandle::getStreamData(qpdf_dl_all)`. This decompresses the zlib/Flate stream and natively reverses any PNG predictors (Sub, Up, Average, Paeth) in C++, returning contiguous decoded pixel buffers.

**Safe Memory Ownership Bridge (`makeSafeJsBuffer`):**
In Emscripten, `typed_memory_view` creates a non-owning pointer into WebAssembly linear memory (`HEAPU8.buffer`). Returning views over local stack-allocated C++ buffers (`std::shared_ptr<Buffer>`) causes dangling pointers and Use-After-Free hazards once the C++ stack frame unwinds.

To guarantee memory safety, `makeSafeJsBuffer` synchronously allocates a JavaScript-managed `Uint8Array` in V8 and copies the bytes while the C++ buffer is guaranteed to be alive on the stack:
```cpp
static val makeSafeJsBuffer(const uint8_t* data, size_t size) {
    val Uint8Array = val::global("Uint8Array");
    val view = val(typed_memory_view(size, data));
    return Uint8Array.new_(view);
}
```
All buffer return points (`getStreamData`, `getDecodedStreamData`, `structuralOptimize`, and `save`) use this bridge, ensuring that returned buffers are independently garbage-collected by the JavaScript engine and cannot be corrupted by subsequent WASM allocations.

### 4.3 Dual-Constraint Downsampling Heuristic
To prevent overdimensioned square or non-standard aspect ratio images from bypassing the resizer, downsampling calculates a composite scaling factor:

$$\text{scale}_{\text{dim}} = \frac{\text{maxImageDimension}}{\max(\text{width}, \text{height})}$$

$$\text{scale}_{\text{area}} = \sqrt{\frac{\text{maxImageArea}}{\text{width} \times \text{height}}}$$

$$\text{scale} = \min(1.0, \text{scale}_{\text{dim}}, \text{scale}_{\text{area}})$$

```typescript
let targetWidth = originalWidth;
let targetHeight = originalHeight;
let resized = false;

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

### 4.4 Canvas Rendering & Re-encoding
1. **FlateDecode Pixels:** Decoded 8-bit RGB or Grayscale bytes are mapped into a `Uint8ClampedArray` (RGBA format) and wrapped into a native `ImageData` object, then converted to an `ImageBitmap`.
2. **DCTDecode Bytes:** Wrapped in a `Blob([imageBytes], { type: 'image/jpeg' })` and decoded via `createImageBitmap()`.
3. **Rendering:** Drawn onto an `OffscreenCanvas` scaled to `targetWidth` and `targetHeight`.
4. **Re-encoding:** Converted to JPEG via `canvas.convertToBlob({ type: 'image/jpeg', quality: config.jpegQuality })`.
5. **Threshold Verification:** The new JPEG byte size is compared against `originalBytes * (1 - threshold)`. If the candidate does not meet the required savings, it is rejected and the original stream remains untouched.

### 4.5 In-Place Stream Replacement & Dictionary Synchronization (`replaceImage`)
When an image candidate is accepted, `qpdf.replaceImage()` updates both the stream data and its enclosing dictionary:
* **Filter:** Set to `/DCTDecode` with `null` decode parameters.
* **Dimensions:** `/Width` and `/Height` are updated only when downsampled.
* **ColorSpace Correction:** Canvas `ImageData` always encodes as 3-channel RGB JPEG. When recompressing `/DeviceGray` images, leaving `/ColorSpace /DeviceGray` causes format mismatches in strict viewers. `replaceImage()` synchronizes `/ColorSpace` to `/DeviceRGB`.
* **Stale Parameter Stripping:** Any lingering `/DecodeParms` (carried over from FlateDecode predictors) or `/Decode` arrays (from the original stream) are stripped from the dictionary.

---

## 5. Structural Optimization & QPDF Flags

Both Pass 1 and Pass 2 utilize QPDF's C++ optimization facilities:
* **Object Stream Generation:** `writer.setObjectStreamMode(qpdf_o_generate)`. Groups non-stream objects (dictionaries, numbers, arrays, strings) into compressed object streams (`/ObjStm`), reducing PDF structural overhead by up to 80%.
* **Stream Compression:** `writer.setStreamDataMode(qpdf_s_compress)`. Compresses uncompressed content streams using Flate.
* **Flate Recompression:** `writer.setRecompressFlate(true)`. Recompresses existing Flate streams to ensure optimal zlib compression level.
* **Cross-Reference Normalization:** Converts traditional cross-reference tables into compact cross-reference streams (`/XRef`).

---

## 6. Output Validation & Safety Fallbacks

Every compressed PDF candidate undergoes a two-tier structural validation:
1. **Page Count Integrity:** The output page count is queried from QPDF (`compressor.getPageCount()`) and compared against the original page count determined by `pdf-lib` prior to compression. Any mismatch immediately invalidates the output.
2. **Structural Parse Integrity:** The output buffer is parsed using `PDFDocument.load(outputBytes)` in `pdf-lib`. If parsing throws (indicating corrupted xrefs, truncated dictionaries, or broken syntax), the candidate is rejected.
3. **Byte Economy Check:** The final output byte size must be strictly less than the original input byte size (`outputBytes.length < originalBytes.length`).

If validation fails or the output is not smaller, the worker returns:
```typescript
{
  ok: true,
  output: input,
  stats: {
    inputBytes: originalBytes,
    outputBytes: originalBytes,
    savedBytes: 0,
    savedPercent: 0,
    imagesDetected,
    imagesModified: 0,
    imagesSkipped: imagesDetected
  },
  changed: false
}
```

---

## 7. Performance & Empirical Benchmarks

Empirical measurements across synthetic and real-world benchmark corpora:

| Document Type | Original Size | Baseline V1 | Post-Calibration (Balanced) | Post-Calibration (High) | Key Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Photo-Heavy Document** | 437.3 KB | 84.2% saved | **87.8% saved** | **93.4% saved** | Quality tuning (0.72 / 0.60) + bicubic downsampling |
| **Scanned Document** | 210.4 KB | 84.4% saved | **87.6% saved** | **93.1% saved** | Quality calibration preserving text sharpness |
| **High-DPI Portrait Image** | 1,027.7 KB | 14.0% saved | **34.9% saved** | **57.9% saved** | Dual-constraint area budget downsampling |
| **Opaque RGB Flate PDF (3MB)** | 2,931.5 KB | 0.0% (skipped) | **81.8% saved** | **85.1% saved** | C++ FlateDecode stream extraction + JPEG re-encode |
| **DeviceGray Document Scan** | 92.8 KB | 0.0% (skipped) | **39.4% saved** | **47.4% saved** | FlateDecode Grayscale expansion + /DeviceRGB synchronization |
| **Slide Presentation (Deck)** | 203.8 KB | 0.0% | **20.7% saved** | **20.7% saved** | QPDF Pass 1 structural optimization (object streams) |
| **Text & Vector Manual** | 0.9 KB | 0.0% (preserved) | **0.0% (preserved)** | **0.0% (preserved)** | No eligible raster images; bit-for-bit fallback safety |

### Concurrent Batch Performance & Reconciled Memory
* **Batch Concurrency:** Up to 4 Web Workers running in parallel.
* **4-Worker Real-World Execution:** 4 large PDFs processed concurrently in **1,305 ms**.
* **Memory Boundedness:** Initial JS heap 27.1 MB; post-batch JS heap 46.0 MB (+18.9 MB net growth, zero memory leaks).

---

## 8. Development & WASM Build Commands

To recompile the QPDF C++ wrapper to WebAssembly:
```powershell
.\build_wasm.bat
```

To compile the TypeScript code and bundle the Chrome extension:
```powershell
npm run build
```

To run compression regression and benchmark test suites:
```powershell
node test-phase-c-units.mjs      # Unit tests (84 assertions: classifiers, validator, memory bridge)
node test-modes.mjs              # Compression mode size ordering verification
node test-hardening.mjs          # Matrix hardening (corrupted, encrypted, empty, unsupported)
node test-batch.mjs              # Concurrent worker pool & name collision tests
node run-phase-c1-benchmark.mjs  # Real-world corpus & Chromium PDFium visual rendering benchmark
```
