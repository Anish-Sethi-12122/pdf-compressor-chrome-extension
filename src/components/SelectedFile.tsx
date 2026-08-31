import { CheckCircle2, FileText, RotateCcw, X } from 'lucide-react'
import { formatFileSize } from '../lib/pdfFile'

type SelectedFileProps = {
  file: File
  onChangeFile: () => void
  onRemoveFile: () => void
}

export function SelectedFile({ file, onChangeFile, onRemoveFile }: SelectedFileProps) {
  return (
    <div className="selected-file" aria-live="polite">
      <div className="selected-file__icon" aria-hidden="true">
        <FileText strokeWidth={1.65} />
      </div>
      <div className="selected-file__details">
        <span className="selected-file__eyebrow">PDF selected</span>
        <h2 title={file.name}>{file.name}</h2>
        <p>{formatFileSize(file.size)}</p>
      </div>
      <div className="selected-file__ready">
        <CheckCircle2 aria-hidden="true" size={15} strokeWidth={2} />
        Ready to compress
      </div>
      <div className="selected-file__actions">
        <button className="secondary-button" type="button" onClick={onChangeFile}>
          <RotateCcw aria-hidden="true" size={14} strokeWidth={2} />
          Change file
        </button>
        <button className="text-button" type="button" onClick={onRemoveFile} aria-label={`Remove ${file.name}`}>
          <X aria-hidden="true" size={15} strokeWidth={2.2} />
          Remove
        </button>
      </div>
    </div>
  )
}
