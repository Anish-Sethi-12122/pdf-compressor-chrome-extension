/**
 * Compression mode configurations — Phase 14
 *
 * Defines the supported compression modes and their specific parameters.
 */

export type CompressionMode = 'low' | 'balanced' | 'high';

export interface CompressionProfile {
  mode: CompressionMode;
  label: string;
  description: string;
  /** JPEG re-encode quality. Range: 0.0-1.0 */
  jpegQuality: number;
  /** Maximum dimension (px). Images exceeding this on their longest edge will be downsampled. */
  maxImageDimension: number;
  /** Minimum compressed stream size (bytes) for an image to be considered for compression. */
  minEligibleStreamSize: number;
  /** Minimum proportional size reduction required to accept a replacement (e.g. 0.10 = 10% smaller). */
  replacementThreshold: number;
}

export const COMPRESSION_PROFILES: Record<CompressionMode, CompressionProfile> = {
  low: {
    mode: 'low',
    label: 'Low Compression',
    description: 'Prioritizes visual quality over file size reduction.',
    jpegQuality: 0.90, // Higher quality than balanced
    maxImageDimension: 3000, // Keep larger images
    minEligibleStreamSize: 32_768, // 32 KB, same as balanced
    replacementThreshold: 0.10, // Baseline (10%)
  },
  balanced: {
    mode: 'balanced',
    label: 'Balanced Compression',
    description: 'Good compression, good quality. The default setting.',
    jpegQuality: 0.82, // Baseline
    maxImageDimension: 2400, // Baseline
    minEligibleStreamSize: 32_768, // Baseline (32 KB)
    replacementThreshold: 0.10, // Baseline (10%)
  },
  high: {
    mode: 'high',
    label: 'High Compression',
    description: 'Prioritizes file size reduction. May visibly reduce image quality.',
    jpegQuality: 0.60, // Lower quality
    maxImageDimension: 1600, // More aggressive downsampling
    minEligibleStreamSize: 16_384, // 16 KB, compress smaller images too
    replacementThreshold: 0.10, // Baseline (10%)
  },
};

export const DEFAULT_COMPRESSION_MODE: CompressionMode = 'balanced';

/**
 * Safely resolves a mode string to a valid CompressionMode, falling back to balanced.
 */
export function resolveCompressionMode(mode: string | undefined | null): CompressionMode {
  if (mode === 'low' || mode === 'balanced' || mode === 'high') {
    return mode as CompressionMode;
  }
  return DEFAULT_COMPRESSION_MODE;
}
