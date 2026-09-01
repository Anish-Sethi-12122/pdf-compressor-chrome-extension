/**
 * Phase 7A — Production Compression Contract
 *
 * These types define the stable public API for the compression engine.
 * qpdf / WASM internals must NOT leak past this boundary.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Currently only 'balanced'. Additional presets are reserved for future phases. */
export type CompressionPreset = 'balanced';

export type CompressionOptions = {
  preset: CompressionPreset;
};

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export type CompressionStats = {
  inputBytes: number;
  outputBytes: number;
  savedBytes: number;
  /** Exact value — round only for display. */
  savedPercent: number;
  processingTimeMs: number;
  imagesDetected: number;
  imagesModified: number;
  imagesSkipped: number;
};

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type CompressionResult =
  | {
      ok: true;
      output: Uint8Array;
      stats: CompressionStats;
      /** true  = output is smaller than original and was substituted.
       *  false = original is returned unchanged (output === original bytes). */
      changed: boolean;
    }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'initialization_error'
        | 'compression_error'
        | 'invalid_output'
        | 'memory_error';
      message: string;
      stats?: Partial<CompressionStats>;
    };

// ---------------------------------------------------------------------------
// Engine interface
// ---------------------------------------------------------------------------

export interface CompressionEngine {
  compress(input: Uint8Array, options: CompressionOptions): Promise<CompressionResult>;
}
