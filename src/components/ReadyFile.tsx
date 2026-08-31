import { CheckCircle2, FileText, RotateCcw, X, Minimize2 } from 'lucide-react'
import { formatFileSize } from '../lib/pdfFile'
import type { PdfInspectionResult } from '../lib/pdfInspector'
import { PrimaryButton } from './PrimaryButton'

type ReadyFileProps = {
  file: File
  /** Must be the successful inspection result — `ok: true`. */
  inspection: Extract<PdfInspectionResult, { ok: true }>
  onChangeFile: () => void
  onRemoveFile: () => void
  onCompress: () => void
}

/**
 * Stable state shown after a PDF has been successfully inspected.
 * Displays only values that were actually measured — page count and file size.
 * No estimated compression ratios or fake statistics.
 */
export function ReadyFile({ file, inspection, onChangeFile, onRemoveFile, onCompress }: ReadyFileProps) {
  const pageLabel = inspection.pageCount === 1 ? '1 page' : `${inspection.pageCount} pages`
  const sizeLabel = formatFileSize(inspection.fileSizeBytes)

  return (
    <div className="selected-file" aria-live="polite">
      <div className="selected-file__icon" aria-hidden="true">
        <FileText strokeWidth={1.65} />
      </div>
      <div className="selected-file__details">
        <span className="selected-file__eyebrow">PDF ready</span>
        <h2 title={file.name}>{file.name}</h2>
        <p>{pageLabel} · {sizeLabel}</p>
      </div>
      <div className="selected-file__ready" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <CheckCircle2 aria-hidden="true" size={15} strokeWidth={2} />
        Ready to compress
      </div>
      <PrimaryButton onClick={onCompress} aria-label="Compress PDF">
        <Minimize2 aria-hidden="true" size={16} strokeWidth={2.1} />
        Compress PDF
      </PrimaryButton>
      <div className="selected-file__actions" style={{ marginTop: '0.5rem' }}>
        <button className="secondary-button" type="button" onClick={onChangeFile}>
          <RotateCcw aria-hidden="true" size={14} strokeWidth={2} />
          Change file
        </button>
        <button
          className="text-button"
          type="button"
          onClick={onRemoveFile}
          aria-label={`Remove ${file.name}`}
        >
          <X aria-hidden="true" size={15} strokeWidth={2.2} />
          Remove
        </button>
      </div>
    </div>
  )
}
