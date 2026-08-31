export type PdfFileValidation =
  | { valid: true }
  | { valid: false; message: string }

const PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf'])

export function validatePdfFile(file: File): PdfFileValidation {
  const hasPdfExtension = file.name.trim().toLowerCase().endsWith('.pdf')
  const normalizedMimeType = file.type.toLowerCase().split(';', 1)[0].trim()
  const hasKnownMimeType = normalizedMimeType.length > 0
  const hasPdfMimeType = PDF_MIME_TYPES.has(normalizedMimeType)

  if (!hasPdfExtension || (hasKnownMimeType && !hasPdfMimeType)) {
    return {
      valid: false,
      message: "That doesn't look like a PDF. Please choose a PDF file to continue.",
    }
  }

  if (file.size === 0) {
    return {
      valid: false,
      message: 'This PDF is empty. Please choose a PDF with content to continue.',
    }
  }

  return { valid: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1)
  const value = bytes / 1024 ** (unitIndex + 1)
  const precision = value >= 10 ? 0 : 1

  return `${value.toFixed(precision)} ${units[unitIndex]}`
}
