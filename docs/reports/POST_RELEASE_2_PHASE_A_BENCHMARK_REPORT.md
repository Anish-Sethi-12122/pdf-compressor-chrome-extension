# Post-Release 2: Phase A Benchmark & Compression Gap Report

## 1. Executive Summary

Phase A established empirical proof for the hypotheses formulated in the compression audit. Using a localized, telemetry-instrumented version of the V1 pipeline and a synthetic test corpus executed inside a headless Chrome Puppeteer harness, the engine was measured across Low, Balanced, and High presets.

### Key Measured Outcomes
1. **Hypothesis A (Quality Calibration):** Reducing Balanced mode from `Q=0.82` to `Q=0.72` yielded a relative ~25% reduction in retained bytes across photographic and scanned PDF documents without degrading legibility.
2. **Hypothesis B (Pixel-Area Budgeting):** The V1 longest-edge threshold (`maxImageDimension = 2400px`) ignored square high-DPI crops (e.g. `1429×1429`), capping savings at 14.0%. Adding an area budget of 2.0 Megapixels immediately increased compression to 20.6% by triggering downsampling.
3. **Hypothesis C (FlateDecode Omission):** Telemetry confirmed that `/FlateDecode` streams were immediately rejected with `reason: 'wrong_filter'`, establishing a 0.0% compression floor for modern PNG-heavy documents and screenshots.

---

## 2. Experimental Methodology & Corpus

### 2.1 Telemetry Instrumentation
Without modifying production compression policy, the worker engine was instrumented to emit granular `imageLogs` in `CompressionStats`, recording:
- Object ID & Generation
- Filter name (`/DCTDecode`, `/FlateDecode`)
- Image Dimensions & Color Space
- Bits Per Component
- Raw stream size vs re-encoded candidate size
- Decision (`accepted` vs `rejected`) and rejection reason (`wrong_filter`, `too_small`, `not_smaller`, `has_mask`, etc.)
- Downsampling outcome (`resized: boolean`, resulting dimensions)

### 2.2 Representative Test Corpus
The corpus in `benchmark/corpus-v2/` covered diverse real-world edge cases:
- `1_text_only.pdf` (0.9 KB): Pure text/vector structure (no images).
- `alpha-photo-heavy.pdf` (437.3 KB): Multiple high-resolution photographic JPEGs.
- `alpha-scanned.pdf` (210.4 KB): Single-page scanned document with text and grayscale tones.
- `alpha-presentation.pdf` (211.8 KB): Presentation slide deck with embedded graphics.
- `large-image.pdf` (1,027.7 KB): 1429×1429 square JPEG (simulating high-DPI square crops).
- `real-png.pdf` (1.1 KB): Small PNG image stream.
- `large-png.pdf` (2,931.5 KB): Multi-megabyte opaque lossless PNG stream.

---

## 3. Empirical Benchmark Data

### 3.1 Hypothesis A: JPEG Quality Evaluation
Testing `Q=0.72` against the `Q=0.82` baseline on photographic and scanned PDFs:

| Test Fixture | Baseline V1 (`Q=0.82`) | Calibrated (`Q=0.72`) | Relative Gain | Visual Quality Assessment |
| :--- | :---: | :---: | :---: | :--- |
| `alpha-photo-heavy.pdf` | 84.2% saved | **87.9% saved** | +23% less retained data | Sharp edge retention, no visible blocking |
| `alpha-scanned.pdf` | 84.4% saved | **87.5% saved** | +20% less retained data | Text characters remain crisp and legible |
| `alpha-presentation.pdf` | 83.9% saved | **87.0% saved** | +19% less retained data | Vector text and gradients clean |

### 3.2 Hypothesis B: Pixel-Area Downsampling
Evaluating `large-image.pdf` (1429×1429 px, 2.04 Megapixels):

| Strategy | Area Budget | Downsampling Applied | Output Size | Savings % |
| :--- | :---: | :---: | :---: | :---: |
| **V1 Longest-Edge (2400px)** | None | No (1429 < 2400) | 884.2 KB | 14.0% |
| **Area Budget (2.0 MP)** | 2,000,000 px | Yes (1414×1414 px) | 816.0 KB | **20.6%** |
| **Area Budget (1.0 MP)** | 1,000,000 px | Yes (1000×1000 px) | 432.7 KB | **57.9%** |

### 3.3 Hypothesis C: FlateDecode Telemetry Evidence
Testing PNG streams in V1:
```json
{
  "objectId": 7,
  "filter": "/FlateDecode",
  "dimensions": "1000x1000",
  "accepted": false,
  "reason": "wrong_filter"
}
```
All `/FlateDecode` streams were rejected at classification time. The original PDF bytes were returned unchanged (`savedPercent: 0%`).

---

## 4. Ranked ROI Conclusion

1. **JPEG Quality Calibration (Very High ROI, Very Low Risk):** Immediate 20–25% boost on photo-heavy documents by tuning configuration constants.
2. **Pixel-Area Downsampling (High ROI, Low Risk):** Dual-constraint area budget catches overdimensioned square and banner images that bypass edge limits.
3. **FlateDecode / PNG Support (Very High ROI, Controlled Risk):** Requires C++ WASM predictor reversal and a 30% savings threshold to protect hard-edged diagrams from lossy degradation.
