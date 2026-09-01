/**
 * Image metadata and classification types — Phase 7A
 *
 * These types describe image XObjects as returned by the qpdf WASM module,
 * and the classified outcome after applying eligibility rules.
 *
 * Nothing here leaks qpdf C++ types.
 */

// ---------------------------------------------------------------------------
// Raw metadata from qpdf inspectImages()
// ---------------------------------------------------------------------------

export type ImageMetadata = {
  objectId: number;
  generation: number;
  width: number;
  height: number;
  /** /BitsPerComponent — typically 8 for JPEG */
  bitsPerComponent: number;
  /** Raw string from /ColorSpace dict key, e.g. "/DeviceRGB" */
  colorSpace: string;
  /** Raw string from /Filter dict key, e.g. "/DCTDecode" */
  filter: string;
  /** true if /SMask or /Mask is present */
  hasMask: boolean;
  /** /Length value from the image dictionary (compressed stream bytes) */
  streamLength: number;
  /** true if /Filter was a PDF array rather than a single name */
  filterIsArray: boolean;
};

// ---------------------------------------------------------------------------
// Classification output
// ---------------------------------------------------------------------------

export type SkipReason =
  | 'wrong_filter'            // not /DCTDecode
  | 'has_mask'                // /SMask or /Mask present
  | 'unsupported_colorspace'  // CMYK, ICCBased, Indexed, Lab, etc.
  | 'too_small'               // stream < MIN_STREAM_BYTES
  | 'unsupported_bits'        // not 8 bpc
  | 'multi_filter'            // filter chain array — too risky
  | 'zero_dimensions';        // width or height is 0

export type ImageCandidate = ImageMetadata & {
  eligible: true;
};

export type ImageSkipped = ImageMetadata & {
  eligible: false;
  reason: SkipReason;
};

export type ClassifiedImage = ImageCandidate | ImageSkipped;

// ---------------------------------------------------------------------------
// Processing outcome (after decode → encode → compare)
// ---------------------------------------------------------------------------

export type ImageProcessingResult =
  | {
      accepted: true;
      objectId: number;
      generation: number;
      originalBytes: number;
      candidateBytes: number;
      originalWidth: number;
      originalHeight: number;
      outputWidth: number;
      outputHeight: number;
      quality: number;
      resized: boolean;
      jpegData: Uint8Array;
    }
  | {
      accepted: false;
      objectId: number;
      generation: number;
      reason: 'encode_failed' | 'not_smaller' | 'decode_failed' | 'canvas_failed';
    };
