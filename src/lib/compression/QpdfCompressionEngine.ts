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
import createQpdfModule from '../../../qpdf_wrapper.js';
// @ts-ignore
import wasmUrlRaw from '../../../qpdf_wrapper.wasm?url';

// ---------------------------------------------------------------------------
// WASM module loader (lazy singleton)
// ---------------------------------------------------------------------------

let modulePromise: Promise<any> | null = null;

async function getQpdfModule(): Promise<any> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // Resolve the WASM URL using the hashed asset URL from Vite
      const wasmUrl = new URL(wasmUrlRaw, self.location.href).href;

      const mod = await createQpdfModule({
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

import { COMPRESSION_PROFILES, resolveCompressionMode } from './compressionConfig';

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class QpdfCompressionEngine implements CompressionEngine {
  async compress(input: Uint8Array, options?: CompressionOptions): Promise<CompressionResult> {
    const t0 = performance.now();
    
    // Resolve mode from options
    const mode = resolveCompressionMode(options?.mode ?? options?.preset);
    const profile = options?.benchmarkProfile || COMPRESSION_PROFILES[mode];

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
          hasCustomDecode: !!img.hasCustomDecode,
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
    const { candidates, skipped } = selectCandidates(rawImages, profile.minEligibleStreamSize);

    const imagesDetected = rawImages.length;
    let imagesModified = 0;
    let imagesSkipped = skipped.length + (rawImages.length - candidates.length - skipped.length);

    // Initialize telemetry
    const imageLogs: any[] = [];

    // Log skipped images right away
    for (const s of skipped) {
      imageLogs.push({
        objectId: s.objectId,
        filter: s.filter,
        dimensions: `${s.width}x${s.height}`,
        colorspace: s.colorSpace,
        bpc: s.bitsPerComponent,
        streamLength: s.streamLength,
        accepted: false,
        reason: s.reason,
        resize: false,
        outDims: '',
        quality: 0
      });
    }

    // -----------------------------------------------------------------------
    // Step 6 — Process candidates sequentially (one at a time to control memory)
    // -----------------------------------------------------------------------
    const processedObjectIds = new Set<number>();

    if (candidates.length > 0 && compressor2) {
      for (const candidate of candidates) {
        // Skip duplicates (shared XObjects already processed)
        if (processedObjectIds.has(candidate.objectId)) {
           // Dedup log
           imageLogs.push({
              objectId: candidate.objectId,
              filter: candidate.filter,
              dimensions: `${candidate.width}x${candidate.height}`,
              colorspace: candidate.colorSpace,
              bpc: candidate.bitsPerComponent,
              streamLength: candidate.streamLength,
              accepted: false,
              reason: 'duplicate_shared_xobject',
              resize: false, outDims: '', quality: 0
           });
           continue;
        }
        processedObjectIds.add(candidate.objectId);

        // Extract stream bytes from the WASM compressor
        let imageBytes: Uint8Array | null = null;
        try {
          if (candidate.filter === '/FlateDecode') {
            imageBytes = await extractDecodedStream(mod, pass1Bytes, candidate.objectId, candidate.generation);
          } else {
            imageBytes = await extractImageStream(mod, pass1Bytes, candidate.objectId, candidate.generation);
          }
        } catch (err: unknown) {
          console.warn(`[QpdfEngine] Failed to extract stream for obj ${candidate.objectId}:`, err);
          imagesSkipped++;
          imageLogs.push({ objectId: candidate.objectId, accepted: false, reason: 'extract_failed' });
          continue;
        }

        if (!imageBytes || imageBytes.length === 0) {
          imagesSkipped++;
          imageLogs.push({ objectId: candidate.objectId, accepted: false, reason: 'empty_stream' });
          continue;
        }

        // Process (decode → optional resize → JPEG encode → compare)
        let result;
        try {
          result = await processImage(imageBytes, candidate, {
            jpegQuality: profile.jpegQuality,
            maxImageDimension: profile.maxImageDimension,
            replacementThreshold: profile.replacementThreshold,
            // Add area threshold support for Hypothesis B
            maxImageArea: profile.maxImageArea
          } as any);
        } catch (err: unknown) {
          console.warn(`[QpdfEngine] Image processing error on obj ${candidate.objectId}:`, err);
          imagesSkipped++;
          imageLogs.push({ objectId: candidate.objectId, accepted: false, reason: 'process_exception' });
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
            
            imageLogs.push({
               objectId: candidate.objectId,
               filter: candidate.filter,
               dimensions: `${result.originalWidth}x${result.originalHeight}`,
               colorspace: candidate.colorSpace,
               bpc: candidate.bitsPerComponent,
               streamLength: candidate.streamLength,
               accepted: true,
               reason: 'smaller',
               resize: result.resized,
               outDims: `${result.outputWidth}x${result.outputHeight}`,
               quality: result.quality,
               originalBytes: result.originalBytes,
               candidateBytes: result.candidateBytes
            });
            
            console.debug(
              `[QpdfEngine] Replaced obj ${candidate.objectId}: ` +
              `bytes: ${(result.originalBytes / 1024).toFixed(1)}KB → ${(result.candidateBytes / 1024).toFixed(1)}KB | ` +
              `dim: ${result.originalWidth}x${result.originalHeight} → ${result.outputWidth}x${result.outputHeight} | ` +
              `quality: ${result.quality} | threshold: 10% | ACCEPTED`
            );
          } catch (err: unknown) {
            console.warn(`[QpdfEngine] replaceImage failed for obj ${candidate.objectId}:`, err);
            imagesSkipped++;
            imageLogs.push({ objectId: candidate.objectId, accepted: false, reason: 'replace_failed' });
          }
        } else {
          imagesSkipped++;
          imageLogs.push({
             objectId: candidate.objectId,
             filter: candidate.filter,
             dimensions: `${candidate.width}x${candidate.height}`,
             colorspace: candidate.colorSpace,
             bpc: candidate.bitsPerComponent,
             streamLength: candidate.streamLength,
             accepted: false,
             reason: result.reason,
             resize: false, outDims: '', quality: 0
          });
          console.debug(`[QpdfEngine] Skipped obj ${candidate.objectId}: ${result.reason}`);
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
        imageLogs
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
      imageLogs
    };

    return {
      ok: true,
      output: pass2Bytes,
      stats,
      changed: true,
      skipReasons: skipped.map(s => s.reason).join(',') + " imagesModified=" + imagesModified
    } as any;
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

async function extractDecodedStream(
  mod: any,
  pdfBytes: Uint8Array,
  objectId: number,
  generation: number,
): Promise<Uint8Array | null> {
  let compressor: any;
  try {
    compressor = new mod.PDFCompressor(pdfBytes);
    const data = compressor.getDecodedStreamData(objectId, generation);
    if (!data) return null;
    return new Uint8Array(data);
  } catch (err) {
    console.warn(`[QpdfEngine] Failed to extract decoded stream for obj ${objectId}:`, err);
    return null;
  } finally {
    if (compressor) compressor.delete?.();
  }
}
