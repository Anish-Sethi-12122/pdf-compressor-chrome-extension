/**
 * PDF inspection abstraction.
 *
 * This module is the ONLY place in the codebase that imports pdf-lib.
 * All other modules depend solely on the types and function exported here.
 *
 * Current implementation: pdf-lib 1.17.1 (MIT).
 * Role: inspection only — page count, parse validity, file size.
 *
 * NOTE: pdf-lib is NOT the compression engine. The compression engine
 * architecture has not been decided. This abstraction exists precisely so
 * that the underlying implementation can be replaced without changing the
 * application layer.
 */

import { PDFDocument } from 'pdf-lib'

// ---------------------------------------------------------------------------
// Public types — no pdf-lib types leak past this boundary
// ---------------------------------------------------------------------------

export type PdfInspectionResult =
  | {
      ok: true
      pageCount: number
      fileSizeBytes: number
    }
  | {
      ok: false
      reason: 'encrypted' | 'malformed' | 'parse_error'
      /** Concise, user-readable message. No raw library stack trace. */
      message: string
    }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inspect a local PDF File without uploading it or storing it.
 *
 * Reads the file once as an ArrayBuffer, attempts to parse it with the
 * configured inspection library, and returns a structured result.
 *
 * The File object is not retained after this function returns.
 *
 * @throws Never — all errors are returned as `{ ok: false, ... }`.
 */
export async function inspectPdf(file: File): Promise<PdfInspectionResult> {
  let bytes: ArrayBuffer

  try {
    bytes = await file.arrayBuffer()
  } catch {
    return {
      ok: false,
      reason: 'parse_error',
      message: 'The file could not be read. It may have been moved or deleted.',
    }
  }

  try {
    const doc = await PDFDocument.load(bytes, {
      // Do not silently ignore encryption — let the EncryptedPDFError throw
      // so we can detect and surface it to the user with a clear message.
      ignoreEncryption: false,
    })

    return {
      ok: true,
      pageCount: doc.getPageCount(),
      fileSizeBytes: file.size,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name : ''

    // pdf-lib throws a named EncryptedPDFError for password-protected documents.
    const isEncrypted =
      name === 'EncryptedPDFError' ||
      message.toLowerCase().includes('encrypt') ||
      message.toLowerCase().includes('password')

    if (isEncrypted) {
      console.debug('[pdfInspector] Encrypted PDF detected:', name, message)
      return {
        ok: false,
        reason: 'encrypted',
        message: 'This PDF is password-protected and cannot be processed.',
      }
    }

    // Distinguish structural corruption from other unexpected failures.
    const isMalformed =
      message.toLowerCase().includes('invalid') ||
      message.toLowerCase().includes('corrupt') ||
      message.toLowerCase().includes('malformed') ||
      message.toLowerCase().includes('unexpected') ||
      message.toLowerCase().includes('failed to parse') ||
      message.toLowerCase().includes('not a pdf')

    console.debug('[pdfInspector] Parse failure:', name, message)

    if (isMalformed) {
      return {
        ok: false,
        reason: 'malformed',
        message: 'This PDF appears to be damaged or unreadable.',
      }
    }

    return {
      ok: false,
      reason: 'parse_error',
      message: 'Something went wrong reading this PDF. Try another file.',
    }
  }
}
