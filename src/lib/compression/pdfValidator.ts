/**
 * PDF byte-level validator — Phase 7A
 *
 * Provides lightweight structural checks on raw PDF bytes.
 * Intentionally avoids sole reliance on pdf-lib for validation:
 * a PDF can technically parse while containing corrupt image streams.
 *
 * Validation hierarchy (per Phase 7A requirements):
 *   1. qpdf successfully writes the candidate         — in QpdfCompressionEngine
 *   2. qpdf can reopen the candidate                  — via reopenAndValidate() in WASM
 *   3. Page count matches original                    — in QpdfCompressionEngine
 *   4. Magic bytes and EOF marker present             — this module
 *   5. pdf-lib can parse it                           — secondary, via validateWithPdfLib()
 *   6. Manual visual inspection of representative PDFs — documented in PHASE_7_REPORT.md
 *
 * Only if ALL checks pass is the candidate returned to the user.
 */

// ---------------------------------------------------------------------------
// Magic-byte / structural checks (no dependency)
// ---------------------------------------------------------------------------

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
const PDF_EOF_MARKER = '%%EOF';

/**
 * Check whether bytes begin with the %PDF magic header.
 */
export function hasPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (bytes[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Check whether bytes contain %%EOF somewhere near the end.
 * Looks in the last 1 KB (spec allows whitespace after %%EOF).
 */
export function hasPdfEof(bytes: Uint8Array): boolean {
  const tail = Math.max(0, bytes.length - 1024);
  const slice = bytes.slice(tail);
  const text = new TextDecoder('latin1').decode(slice);
  return text.includes(PDF_EOF_MARKER);
}

/**
 * Fast structural pre-check. Returns false immediately if either marker
 * is missing — no need to spend time on pdf-lib parsing.
 */
export function structuralPreCheck(bytes: Uint8Array): boolean {
  return bytes.length > 0 && hasPdfMagic(bytes) && hasPdfEof(bytes);
}

// ---------------------------------------------------------------------------
// Secondary: pdf-lib validation
// ---------------------------------------------------------------------------

/**
 * Attempt to load the PDF with pdf-lib to catch parse errors.
 * This is a SECONDARY check. Do not treat a pdf-lib success as the sole
 * authority on document correctness.
 *
 * Returns true if pdf-lib can load it without throwing, false otherwise.
 */
export async function validateWithPdfLib(
  bytes: Uint8Array,
  expectedPageCount: number,
): Promise<{ ok: boolean; pageCount?: number; reason?: string }> {
  try {
    // Dynamic import keeps pdf-lib out of the critical path if unused.
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pageCount = doc.getPageCount();
    if (pageCount !== expectedPageCount) {
      return {
        ok: false,
        pageCount,
        reason: `Page count mismatch: expected ${expectedPageCount}, got ${pageCount}`,
      };
    }
    return { ok: true, pageCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `pdf-lib parse error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Combined validation gate
// ---------------------------------------------------------------------------

/**
 * Full output validation pipeline.
 *
 * Runs structural pre-check first (fast), then pdf-lib page-count validation.
 * The qpdf reopen check is performed at the WASM layer before this is called.
 *
 * @param bytes - Candidate PDF bytes
 * @param expectedPageCount - Page count of the original input PDF
 * @returns { valid: true } or { valid: false, reason: string }
 */
export async function validateOutputPdf(
  bytes: Uint8Array,
  expectedPageCount: number,
): Promise<{ valid: boolean; reason?: string }> {
  if (!structuralPreCheck(bytes)) {
    return { valid: false, reason: 'Missing %PDF header or %%EOF marker' };
  }

  const libResult = await validateWithPdfLib(bytes, expectedPageCount);
  if (!libResult.ok) {
    return { valid: false, reason: libResult.reason };
  }

  return { valid: true };
}
