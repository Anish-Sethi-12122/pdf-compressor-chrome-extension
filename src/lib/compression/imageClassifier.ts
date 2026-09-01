/**
 * Image eligibility classifier — Phase 7A (Balanced preset)
 *
 * Pure function: no side effects, no WASM dependency, fully unit-testable.
 *
 * Policy documented in PHASE_7_REPORT.md.
 * These thresholds are benchmark-validated starting points — update after
 * Chrome benchmarks confirm or revise them.
 */

import type { ImageMetadata, ClassifiedImage } from './imageTypes';

// ---------------------------------------------------------------------------
// Balanced policy constants
// IMPORTANT: These are provisional. Run benchmarks and update before shipping.
// ---------------------------------------------------------------------------

/**
 * Minimum compressed stream size in bytes.
 * Images smaller than this are typically icons, logos, or decorations.
 * Not worth the generational JPEG loss.
 * Benchmark-tunable: start at 32 KB.
 */
export const MIN_STREAM_BYTES = 32_768; // 32 KB

/**
 * Supported PDF filter name. Only /DCTDecode (JPEG) is targeted in Phase 7A.
 */
const SUPPORTED_FILTER = '/DCTDecode';

/**
 * Supported color spaces. DeviceCMYK is explicitly excluded:
 * browsers convert CMYK→RGB incorrectly during canvas draw.
 */
const SUPPORTED_COLOR_SPACES = new Set(['/DeviceRGB', '/DeviceGray']);

/**
 * Supported bits-per-component. 8 bpc is standard JPEG.
 * 1 bpc = monochrome bitmap (CCITT territory), not JPEG.
 * 16 bpc = uncommon, not supported by standard JPEG.
 */
const SUPPORTED_BPC = new Set([8]);

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * Classify a single image XObject.
 * Returns either an eligible candidate or a skipped record with a reason.
 */
export function classifyImage(meta: ImageMetadata): ClassifiedImage {
  // Must have sane dimensions
  if (meta.width === 0 || meta.height === 0) {
    return { ...meta, eligible: false, reason: 'zero_dimensions' };
  }

  // Multi-filter chains (array of filters) are too risky in Phase 7A.
  // e.g. [/FlateDecode, /DCTDecode] — skip.
  if (meta.filterIsArray) {
    return { ...meta, eligible: false, reason: 'multi_filter' };
  }

  // Only JPEG/DCTDecode is targeted.
  if (meta.filter !== SUPPORTED_FILTER) {
    return { ...meta, eligible: false, reason: 'wrong_filter' };
  }

  // Transparency / masks must be skipped — cannot safely recompress.
  if (meta.hasMask) {
    return { ...meta, eligible: false, reason: 'has_mask' };
  }

  // Only DeviceRGB and DeviceGray are safe to round-trip through Canvas.
  if (!SUPPORTED_COLOR_SPACES.has(meta.colorSpace)) {
    return { ...meta, eligible: false, reason: 'unsupported_colorspace' };
  }

  // Standard JPEG is 8 bpc.
  if (!SUPPORTED_BPC.has(meta.bitsPerComponent)) {
    return { ...meta, eligible: false, reason: 'unsupported_bits' };
  }

  // Skip tiny images — generational loss outweighs any gain.
  if (meta.streamLength < MIN_STREAM_BYTES) {
    return { ...meta, eligible: false, reason: 'too_small' };
  }

  return { ...meta, eligible: true };
}

/**
 * Filter an array of image metadata to only eligible candidates.
 * Deduplicates by objectId so shared XObjects are processed exactly once.
 */
export function selectCandidates(images: ImageMetadata[]): {
  candidates: Array<ImageMetadata & { eligible: true }>;
  skipped: Array<ImageMetadata & { eligible: false; reason: string }>;
} {
  const seen = new Set<number>();
  const candidates: Array<ImageMetadata & { eligible: true }> = [];
  const skipped: Array<ImageMetadata & { eligible: false; reason: string }> = [];

  for (const img of images) {
    // Deduplicate shared XObjects — only process each object ID once.
    if (seen.has(img.objectId)) continue;
    seen.add(img.objectId);

    const result = classifyImage(img);
    if (result.eligible) {
      candidates.push(result as ImageMetadata & { eligible: true });
    } else {
      skipped.push(result as ImageMetadata & { eligible: false; reason: string });
    }
  }

  return { candidates, skipped };
}
