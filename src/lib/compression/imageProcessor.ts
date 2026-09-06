/**
 * Image processor — Phase 7A (Worker context only)
 *
 * Decodes a JPEG byte stream via createImageBitmap(), optionally downsamples
 * via OffscreenCanvas, re-encodes as JPEG, and returns the candidate bytes
 * only if they are materially smaller than the original.
 *
 * NEVER called from the React thread. Only valid inside a Web Worker where
 * OffscreenCanvas and createImageBitmap are available.
 *
 * All ImageBitmap / Blob resources are released after each image.
 *
 * Policy constants documented in PHASE_7_REPORT.md.
 * These are benchmark-starting-points — measure and revise before shipping.
 */

import type { ImageCandidate, ImageProcessingResult } from './imageTypes';

// ---------------------------------------------------------------------------
// Balanced policy constants
// IMPORTANT: These are provisional — validate with Chrome benchmarks.
// ---------------------------------------------------------------------------

/**
 * JPEG re-encode quality for the Balanced preset.
 * Range: 0.0–1.0 (Canvas API).
 * Starting point: 0.82. Benchmark 0.85 / 0.80 / 0.75 / 0.70 before finalising.
 */
export const JPEG_QUALITY = 0.82;

/**
 * Longest edge (px) above which we consider downsampling.
 * Images whose longest dimension exceeds this are resized to fit.
 * Starting point: 2400 px. Benchmark nearby values before finalising.
 * Never upscales; never touches images already below this.
 */
export const DOWNSAMPLE_MAX_PX = 2400;

/**
 * Minimum proportional size reduction required to accept a replacement.
 * 0.10 = candidate must be ≥10% smaller than the original stream.
 * Exists to prevent generational JPEG loss on images that compress poorly.
 */
export const REPLACEMENT_THRESHOLD = 0.10;

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

/**
 * Process one eligible JPEG image.
 *
 * @param jpegBytes - The raw JPEG-encoded bytes extracted from the PDF stream.
 * @param candidate - Classification metadata (dimensions, color space, etc.).
 * @param config - Processing parameters (quality, thresholds, etc.).
 * @returns ImageProcessingResult — accepted with new JPEG bytes, or rejected.
 */
export async function processImage(
  jpegBytes: Uint8Array,
  candidate: ImageCandidate,
  config: {
    jpegQuality: number;
    maxImageDimension: number;
    replacementThreshold: number;
  } = {
    jpegQuality: JPEG_QUALITY,
    maxImageDimension: DOWNSAMPLE_MAX_PX,
    replacementThreshold: REPLACEMENT_THRESHOLD,
  }
): Promise<ImageProcessingResult> {
  const objectId = candidate.objectId;
  const generation = candidate.generation;
  const originalBytes = jpegBytes.byteLength;
  const originalWidth = candidate.width;
  const originalHeight = candidate.height;

  let bitmap: ImageBitmap | null = null;

  try {
    // -----------------------------------------------------------------------
    // Step 1 — Decode JPEG → ImageBitmap
    // -----------------------------------------------------------------------
    let decodeBlob: Blob;
    try {
      // Explicitly slice to ArrayBuffer to avoid SharedArrayBuffer type conflict
      const ab: ArrayBuffer = jpegBytes.buffer instanceof ArrayBuffer
        ? jpegBytes.buffer.slice(jpegBytes.byteOffset, jpegBytes.byteOffset + jpegBytes.byteLength) as ArrayBuffer
        : new Uint8Array(jpegBytes).buffer;
      decodeBlob = new Blob([ab], { type: 'image/jpeg' });
    } catch {
      return { accepted: false, objectId, generation, reason: 'decode_failed' };
    }

    try {
      bitmap = await createImageBitmap(decodeBlob);
    } catch {
      return { accepted: false, objectId, generation, reason: 'decode_failed' };
    }

    // -----------------------------------------------------------------------
    // Step 2 — Determine output dimensions
    // -----------------------------------------------------------------------
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    let outW = srcW;
    let outH = srcH;
    let resized = false;

    const longestEdge = Math.max(srcW, srcH);
    if (longestEdge > config.maxImageDimension) {
      const scale = config.maxImageDimension / longestEdge;
      outW = Math.round(srcW * scale);
      outH = Math.round(srcH * scale);
      // Ensure at least 1×1
      outW = Math.max(1, outW);
      outH = Math.max(1, outH);
      resized = true;
    }

    // -----------------------------------------------------------------------
    // Step 3 — Draw to OffscreenCanvas
    // -----------------------------------------------------------------------
    let canvas: OffscreenCanvas;
    let ctx: OffscreenCanvasRenderingContext2D | null;
    try {
      canvas = new OffscreenCanvas(outW, outH);
      ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      if (!ctx) {
        bitmap.close();
        return { accepted: false, objectId, generation, reason: 'canvas_failed' };
      }
    } catch {
      bitmap.close();
      return { accepted: false, objectId, generation, reason: 'canvas_failed' };
    }

    ctx.drawImage(bitmap, 0, 0, outW, outH);

    // Release the decoded bitmap immediately — largest memory consumer.
    bitmap.close();
    bitmap = null;

    // -----------------------------------------------------------------------
    // Step 4 — JPEG encode
    // -----------------------------------------------------------------------
    let candidateBlob: Blob;
    try {
      candidateBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: config.jpegQuality,
      });
    } catch {
      return { accepted: false, objectId, generation, reason: 'encode_failed' };
    }

    const candidateBytes = candidateBlob.size;

    // -----------------------------------------------------------------------
    // Step 5 — Accept or reject based on size threshold
    // -----------------------------------------------------------------------
    const threshold = originalBytes * (1 - config.replacementThreshold);
    if (candidateBytes >= threshold) {
      // Not materially smaller — keep original to avoid generational loss.
      console.debug(`[imageProcessor] Skipped obj ${objectId}: new ${candidateBytes} >= threshold ${threshold} (orig ${originalBytes})`);
      return { accepted: false, objectId, generation, reason: 'not_smaller' };
    }

    // Read the candidate blob into a Uint8Array.
    const candidateBuffer = await candidateBlob.arrayBuffer();
    const jpegData = new Uint8Array(candidateBuffer);

    return {
      accepted: true,
      objectId,
      generation,
      originalBytes,
      candidateBytes,
      originalWidth,
      originalHeight,
      outputWidth: outW,
      outputHeight: outH,
      quality: config.jpegQuality,
      resized,
      jpegData,
    };
  } catch (err: unknown) {
    // Safety net — catch anything unexpected.
    bitmap?.close();
    console.error('[imageProcessor] Unexpected error on object', objectId, err);
    return { accepted: false, objectId, generation, reason: 'encode_failed' };
  }
}
