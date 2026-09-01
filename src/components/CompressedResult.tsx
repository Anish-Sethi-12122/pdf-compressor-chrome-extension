import { Download, FileText, RotateCcw } from 'lucide-react'
import { formatFileSize } from '../lib/pdfFile'
import type { CompressionResult } from '../lib/compression/CompressionEngine'
import { PrimaryButton } from './PrimaryButton'

type CompressedResultProps = {
  originalFile: File
  result: Extract<CompressionResult, { ok: true }>
  onStartOver: () => void
}

export function CompressedResult({ originalFile, result, onStartOver }: CompressedResultProps) {
  const handleDownload = () => {
    // Derive filename: original.pdf → original-compressed.pdf
    const originalName = originalFile.name
    const lastDot = originalName.lastIndexOf('.')
    const base = lastDot > 0 ? originalName.slice(0, lastDot) : originalName
    const ext = lastDot > 0 ? originalName.slice(lastDot + 1) : 'pdf'
    const newName = `${base}-compressed.${ext}`

    // Native browser download — no `downloads` permission required
    const blob = new Blob([result.output as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = newName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Revoke after a short delay so the browser has time to initiate the download
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  const { stats, changed } = result
  const originalSize = formatFileSize(stats.inputBytes)
  const newSize = formatFileSize(stats.outputBytes)

  return (
    <div className="selected-file" aria-live="polite">
      <div className="selected-file__icon" aria-hidden="true">
        <FileText strokeWidth={1.65} />
      </div>
      <div className="selected-file__details">
        {changed ? (
          <>
            <span className="selected-file__eyebrow">PDF compressed</span>
            <h2 title={originalFile.name}>{originalFile.name}</h2>
            <p>
              {originalSize} &rarr; {newSize}
            </p>
            <p>Saved {stats.savedPercent.toFixed(1)}%</p>
          </>
        ) : (
          <>
            <span className="selected-file__eyebrow">No further compression needed</span>
            <h2 title={originalFile.name}>{originalFile.name}</h2>
            <p>This PDF is already efficiently compressed.</p>
            <p>Retaining original file ({originalSize}).</p>
          </>
        )}
      </div>
      <div
        className="selected-file__actions"
        style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
      >
        <PrimaryButton onClick={handleDownload} aria-label="Download PDF">
          <Download aria-hidden="true" size={16} strokeWidth={2.1} />
          Download PDF
        </PrimaryButton>
        <button className="secondary-button" type="button" onClick={onStartOver}>
          <RotateCcw aria-hidden="true" size={14} strokeWidth={2} />
          Start over
        </button>
      </div>
    </div>
  )
}
