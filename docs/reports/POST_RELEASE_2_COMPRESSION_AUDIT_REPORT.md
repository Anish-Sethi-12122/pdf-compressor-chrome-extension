# Post-Release 2: Compression Engine Deep Forensic Audit & Optimization Strategy

## 1. Executive Summary & Objective

This audit investigates the performance of PDF Compressor V1 against mature commercial tools (such as iLovePDF and Adobe Acrobat). The primary goal is to determine why V1 output sizes can remain larger than commercial outputs, establish an evidence-based accounting of where compression actually originates, and construct a concrete, non-destructive implementation plan to close the gap while strictly preserving the extension's 100% local, privacy-first, and zero-permission architecture.

---

## 2. Forensic Analysis of Compression Contributions

The investigation evaluated how much compression is provided by each possible mechanism, categorizing them into:
- **A:** Currently implemented in V1
- **B:** Handled automatically by QPDF
- **C:** Supported by QPDF but not leveraged by V1
- **D:** Fundamentally unsupported by QPDF
- **E:** Requiring alternative client-side libraries/encoders
- **F:** Proprietary cloud/commercial pipelines

| Mechanism | Status | Category | Impact & Findings |
| :--- | :--- | :---: | :--- |
| **Object Streams** | Implemented | B | Handled via `qpdf_o_generate`. Consolidates non-stream objects into compressed object streams (`/ObjStm`), saving up to 80% of structural metadata overhead. |
| **Stream Compression** | Implemented | B | Handled via `qpdf_s_compress` and `--recompress-flate`. Content streams are optimally Flate-compressed. |
| **Duplicate Object Elimination** | Unused | C | QPDF supports xref deduplication, but image XObjects are only deduplicated in JS by `objectId`, not content hash. |
| **JPEG Re-encoding** | Implemented | A | Re-encodes `/DCTDecode` streams using HTML5 Canvas (`toBlob` / `convertToBlob`). V1 used a conservative baseline of `Q=0.82` for Balanced. |
| **Image Downsampling** | Implemented | A | Evaluated solely via longest-edge (`maxImageDimension = 2400px`). Misses high-DPI square images and non-standard aspect ratios. |
| **PNG / FlateDecode Images** | Previously Skipped | E | V1 skipped all non-`/DCTDecode` filters. Modern PDFs with screenshots or PNGs received **0.0%** image compression. |
| **Monochrome (CCITT/JBIG2)** | Excluded | D/E | 1-bit scanned documents are not handled by Canvas or QPDF and require specialized JBIG2/CCITT codecs. |
| **Color Space Conversion** | Excluded | E | CMYK and ICCBased color spaces are rejected due to incorrect browser Canvas color translation. |
| **Transparency / SMask** | Protected | A | Images with `/SMask` or `/Mask` are strictly bypassed to prevent rendering corruption. |
| **Font Subsetting / Pruning** | Unused | D | QPDF does not subset or de-duplicate fonts. Requires font parsing engines (e.g., HarfBuzz or fontkit). |
| **Metadata Removal** | Unused | C | XMP and document info dictionaries are preserved for document integrity. |

---

## 3. Identification of the Primary Compression Gaps

The forensic audit identified three primary causes for the size gap between V1 and commercial tools:

### Gap 1: Overly Conservative JPEG Quality Defaults (Hypothesis A)
V1 used `Q=0.82` for Balanced mode. In image compression, the size-to-quality curve drops precipitously between 0.85 and 0.70. Commercial compressors typically default to qualities in the 0.68–0.74 range for balanced output, saving 20–35% more bytes without discernible visual degradation on scanned text or photographs.

### Gap 2: Longest-Edge-Only Downsampling Heuristic (Hypothesis B)
The heuristic `Math.max(w, h) > maxImageDimension` failed on square images (e.g., `1429×1429 = 2.04 MP`), which have short edges despite exceeding standard screen or print resolutions. Downsampling must evaluate total pixel-area budgets alongside dimensional constraints.

### Gap 3: Total Omission of `/FlateDecode` (PNG) Image Streams (Hypothesis C)
Modern PDF exports from macOS Preview, Google Docs, and Microsoft Word embed screenshots and lossless raster graphics using `/FlateDecode`. V1 classified all non-DCTDecode filters as `wrong_filter` and skipped them entirely, yielding a 0% compression floor for screenshot-heavy documents.

---

## 4. Architectural Invariants Protected

Any optimization must preserve the following non-negotiable invariants:
1. **100% Local Processing:** Zero cloud reliance; all code runs in the browser Web Worker.
2. **Worker Isolation:** Bounded pool of up to 4 persistent Web Workers for batch processing.
3. **Sequential Image Processing per PDF:** Prevents browser tab out-of-memory (OOM) crashes.
4. **Non-Destructive Fallback:** Any validation failure or size inflation triggers a clean fallback to the original file.
5. **Transparency & Color Safety:** Transparent masks (`/SMask`) and complex color spaces (CMYK) remain protected.

---

## 5. Phased Implementation Roadmap

- **Phase A (Benchmarking & Baseline Telemetry):**
  - Instrument engine to collect granular per-image telemetry.
  - Construct diverse, representative corpus.
  - Empirically validate Hypotheses A, B, and C.
- **Phase B (High-ROI Engine Improvements):**
  - Calibrate JPEG quality profiles (Balanced ~0.72, Low ~0.90, High ~0.60).
  - Implement dual-constraint pixel-area budgeting.
  - Implement C++ WASM Flate stream decoding and Canvas re-encoding with a 30% savings threshold.
- **Phase C (Future Advanced Opportunities):**
  - WebP encoding for screenshot/diagram compression.
  - Font subsetting and unreferenced object cleanup.
  - JBIG2/CCITTFaxDecode support for 1-bit monochrome scans.
