/**
 * QpdfCompressionEngine — Phase 7A Production Implementation
 *
 * Implements the Balanced compression preset using:
 *   • Custom qpdf library WASM (PDFCompressor Embind class)
 *   • createImageBitmap + OffscreenCanvas for JPEG decode/re-encode
 *   • Multi-layer output validation
 *
 * All heavy work runs in the Web Worker. This file must NOT be imported
 * from React components.
 *
 * Pipeline:
 *   original → validate → qpdf structural pass 1
 *     → enumerate images → classify candidates
 *     → [sequential] decode → optionally downsample → JPEG encode
 *     → replace if materially smaller
 *   → qpdf structural pass 2 → validate output
 *   → compare candidates: return smallest valid vs original
 *
 * Falls back to original on ANY validation failure.
 */

import type { CompressionEngine, CompressionOptions, CompressionResult, CompressionStats } from './CompressionEngine';
import { selectCandidates } from './imageClassifier';
import { processImage } from './imageProcessor';
import { validateOutputPdf, structuralPreCheck } from './pdfValidator';
import type { ImageMetadata } from './imageTypes';

// @ts-ignore
import qpdfUrl from '/qpdf_wrapper.js?url';
// @ts-ignore
import wasmUrlRaw from '/qpdf_wrapper.wasm?url';

// ---------------------------------------------------------------------------
// WASM module loader (lazy singleton)
// ---------------------------------------------------------------------------

// The WASM module lives at the project root and is served as a static asset.
// Vite handles bundling/URL resolution via assetsInclude + ?url import.
let modulePromise: Promise<any> | null = null;

async function getQpdfModule(): Promise<any> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // Dynamic import of the local WASM JS loader.
      // Path is relative to THIS file's location in the compiled bundle.
      // Vite's worker bundler resolves this to the correct asset URL.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const factory = (await import(/* @vite-ignore */ qpdfUrl)).default;
      // Resolve the WASM URL using the hashed asset URL from Vite
      const wasmUrl = new URL(wasmUrlRaw, self.location.href).href;

      const mod = await factory({
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) return wasmUrl;
          return path;
        },
      });
      return mod;
    })();
  }
  return modulePromise;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class QpdfCompressionEngine implements CompressionEngine {
  async compress(input: Uint8Array, _options?: CompressionOptions): Promise<CompressionResult> {
    const t0 = performance.now();

    // -----------------------------------------------------------------------
    // Step 0 — Basic input validation
    // -----------------------------------------------------------------------
    if (!input || input.length === 0) {
      return {
        ok: false,
        reason: 'invalid_input',
        message: 'Input PDF is empty.',
      };
    }

    if (!structuralPreCheck(input)) {
      return {
        ok: false,
        reason: 'invalid_input',
        message: 'Input does not appear to be a valid PDF (missing %PDF header or %%EOF).',
      };
    }

    const originalBytes = input.length;
    let originalPageCount = 0;

    // -----------------------------------------------------------------------
    // Step 1 — Initialize WASM
    // -----------------------------------------------------------------------
    let mod: any;
    try {
      mod = await getQpdfModule();
    } catch (err: unknown) {
      return {
        ok: false,
        reason: 'initialization_error',
        message: `Failed to initialize qpdf WASM: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // -----------------------------------------------------------------------
    // Step 2 — Load original PDF and get page count
    // -----------------------------------------------------------------------
    let compressor1: any;
    try {
      compressor1 = new mod.PDFCompressor(input);
      originalPageCount = compressor1.getPageCount();
    } catch (err: unknown) {
      return {
        ok: false,
        reason: 'invalid_input',
        message: `qpdf could not open the PDF: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // -----------------------------------------------------------------------
    // Step 3 — qpdf structural optimisation pass 1
    // -----------------------------------------------------------------------
    let pass1Bytes: Uint8Array;
    try {
      const pass1View: Uint8Array = compressor1.structuralOptimize();
      // typed_memory_view returns a view into WASM heap — must copy before compressor1 is GC'd
      pass1Bytes = new Uint8Array(pass1View);
    } catch (err: unknown) {
      return {
        ok: false,
        reason: 'compression_error',
        message: `qpdf structural optimisation failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // -----------------------------------------------------------------------
    // Step 4 — Enumerate images from the optimised PDF
    // -----------------------------------------------------------------------
    let rawImages: ImageMetadata[] = [];
    let compressor2: any;
    try {
      compressor2 = new mod.PDFCompressor(pass1Bytes);
      const jsImages = compressor2.inspectImages();
      // Convert from Emscripten JS proxy array to plain JS objects
      const count = jsImages.length;
      for (let i = 0; i < count; i++) {
        const img = jsImages[i];
        rawImages.push({
          objectId:        img.objectId,
          generation:      img.generation,
          width:           img.width,
          height:          img.height,
          bitsPerComponent: img.bitsPerComponent,
          colorSpace:      img.colorSpace,
          filter:          img.filter,
          hasMask:         img.hasMask,
          streamLength:    img.streamLength,
          filterIsArray:   img.filterIsArray,
        });
      }
    } catch (err: unknown) {
      // If we can't inspect images, fall back to qpdf-only result
      console.warn('[QpdfEngine] Image inspection failed, using qpdf-only result:', err);
      rawImages = [];
    }

    // -----------------------------------------------------------------------
    // Step 5 — Classify image candidates
    // -----------------------------------------------------------------------
    const { candidates, skipped } = selectCandidates(rawImages);

    const imagesDetected = rawImages.length;
    let imagesModified = 0;
    let imagesSkipped = skipped.length + (rawImages.length - candidates.length - skipped.length);

    // -----------------------------------------------------------------------
    // Step 6 — Process candidates sequentially (one at a time to control memory)
    // -----------------------------------------------------------------------
    const processedObjectIds = new Set<number>();

    if (candidates.length > 0 && compressor2) {
      for (const candidate of candidates) {
        // Skip duplicates (shared XObjects already processed)
        if (processedObjectIds.has(candidate.objectId)) continue;
        processedObjectIds.add(candidate.objectId);

        // Extract the current JPEG stream bytes from the WASM compressor
        let jpegBytes: Uint8Array | null = null;
        try {
          // Extract the JPEG stream bytes for this object from the optimised PDF bytes.
          // If extraction fails, the image is skipped (failure isolation per spec §25).
          jpegBytes = await extractImageStream(mod, pass1Bytes, candidate.objectId, candidate.generation);
        } catch (err: unknown) {
          console.warn(`[QpdfEngine] Failed to extract stream for obj ${candidate.objectId}:`, err);
          imagesSkipped++;
          continue;
        }

        if (!jpegBytes || jpegBytes.length === 0) {
          imagesSkipped++;
          continue;
        }

        // Process (decode → optional resize → JPEG encode → compare)
        let result;
        try {
          result = await processImage(jpegBytes, candidate);
        } catch (err: unknown) {
          console.warn(`[QpdfEngine] Image processing error on obj ${candidate.objectId}:`, err);
          imagesSkipped++;
          continue;
        }

        if (result.accepted) {
          // Replace stream in the compressor
          try {
            compressor2.replaceImage(
              candidate.objectId,
              candidate.generation,
              result.jpegData,
              result.outputWidth,
              result.outputHeight,
            );
            imagesModified++;
            console.log(
              `[QpdfEngine] Replaced obj ${candidate.objectId}: ` +
              `${(result.originalBytes / 1024).toFixed(1)}KB → ${(result.candidateBytes / 1024).toFixed(1)}KB ` +
              `(${result.resized ? `resized ${result.originalWidth}×${result.originalHeight}→${result.outputWidth}×${result.outputHeight}, ` : ''}q=${result.quality})`
            );
          } catch (err: unknown) {
            console.warn(`[QpdfEngine] replaceImage failed for obj ${candidate.objectId}:`, err);
            imagesSkipped++;
          }
        } else {
          imagesSkipped++;
          console.log(`[QpdfEngine] Skipped obj ${candidate.objectId}: ${result.reason}`);
        }
      }
    } else {
      imagesSkipped += candidates.length;
    }

    // -----------------------------------------------------------------------
    // Step 7 — qpdf structural optimisation pass 2 (after image replacements)
    // -----------------------------------------------------------------------
    let pass2Bytes: Uint8Array;
    try {
      if (imagesModified > 0 && compressor2) {
        // Save with image modifications first, then re-optimize
        const savedView: Uint8Array = compressor2.save();
        const savedBytes = new Uint8Array(savedView);

        // Re-load and structurally optimize
        const compressor3 = new mod.PDFCompressor(savedBytes);
        const pass2View: Uint8Array = compressor3.structuralOptimize();
        pass2Bytes = new Uint8Array(pass2View);
      } else {
        // No images were modified — pass1 is our best structural result
        pass2Bytes = pass1Bytes;
      }
    } catch (err: unknown) {
      // If final optimisation fails, fall back to pass1 result
      console.warn('[QpdfEngine] Pass 2 optimisation failed, using pass1:', err);
      pass2Bytes = pass1Bytes;
    }

    // -----------------------------------------------------------------------
    // Step 8 — Validate candidate output
    // -----------------------------------------------------------------------
    const processingTimeMs = performance.now() - t0;

    let candidateValid = false;
    try {
      const validationResult = await validateOutputPdf(pass2Bytes, originalPageCount);
      candidateValid = validationResult.valid;
      if (!candidateValid) {
        console.warn('[QpdfEngine] Output validation failed:', validationResult.reason);
      }
    } catch (err: unknown) {
      console.warn('[QpdfEngine] Validation threw:', err);
      candidateValid = false;
    }

    // -----------------------------------------------------------------------
    // Step 9 — Select smallest valid candidate vs original
    // -----------------------------------------------------------------------
    if (!candidateValid || pass2Bytes.length >= originalBytes) {
      // Either invalid, or not smaller — return original unchanged
      const stats: CompressionStats = {
        inputBytes: originalBytes,
        outputBytes: originalBytes,
        savedBytes: 0,
        savedPercent: 0,
        processingTimeMs,
        imagesDetected,
        imagesModified: 0,
        imagesSkipped: imagesDetected,
      };
      return {
        ok: true,
        output: input,
        stats,
        changed: false,
      };
    }

    const savedBytes = originalBytes - pass2Bytes.length;
    const savedPercent = (savedBytes / originalBytes) * 100;

    const stats: CompressionStats = {
      inputBytes: originalBytes,
      outputBytes: pass2Bytes.length,
      savedBytes,
      savedPercent,
      processingTimeMs,
      imagesDetected,
      imagesModified,
      imagesSkipped,
    };

    return {
      ok: true,
      output: pass2Bytes,
      stats,
      changed: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Stream extraction helper
// ---------------------------------------------------------------------------

/**
 * Extracts the raw encoded bytes of an image stream from a PDF.
 * Uses exact extraction via the C++ `getStreamData` method.
 */
async function extractImageStream(
  mod: any,
  pdfBytes: Uint8Array,
  objectId: number,
  generation: number,
): Promise<Uint8Array | null> {
  let compressor: any;
  try {
    compressor = new mod.PDFCompressor(pdfBytes);
    const data = compressor.getStreamData(objectId, generation);
    if (!data) return null;
    return new Uint8Array(data);
  } catch (err) {
    console.warn(`[QpdfEngine] Failed to extract stream for obj ${objectId}:`, err);
    return null;
  } finally {
    if (compressor) compressor.delete?.();
  }
}
