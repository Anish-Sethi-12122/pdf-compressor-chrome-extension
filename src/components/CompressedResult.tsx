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
    // Determine file name
    const originalName = originalFile.name
    const nameParts = originalName.split('.')
    const ext = nameParts.pop()
    const base = nameParts.join('.') || 'document'
    const newName = `${base}-compressed.${ext}`

    // Create Blob
    const blob = new Blob([result.output as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    // Trigger download
    const a = document.createElement('a')
    a.href = url
    a.download = newName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Cleanup URL
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)
  }

  const originalSize = formatFileSize(result.inputBytes)
  const newSize = formatFileSize(result.outputBytes)
  
  return (
    <div className="selected-file" aria-live="polite">
      <div className="selected-file__icon" aria-hidden="true">
        <FileText strokeWidth={1.65} />
      </div>
      <div className="selected-file__details">
        {result.changed ? (
          <>
            <span className="selected-file__eyebrow">PDF compressed</span>
            <h2 title={originalFile.name}>{originalFile.name}</h2>
            <p>
              {originalSize} &rarr; {newSize}
            </p>
            <p>Saved {result.savedPercent.toFixed(1)}%</p>
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
      <div className="selected-file__actions" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
