import { FileText, Loader2 } from 'lucide-react'

type CompressingFileProps = {
  file: File
}

export function CompressingFile({ file }: CompressingFileProps) {
  return (
    <div className="selected-file" aria-live="polite">
      <div className="selected-file__icon" aria-hidden="true">
        <FileText strokeWidth={1.65} />
      </div>
      <div className="selected-file__details">
        <span className="selected-file__eyebrow">Compressing PDF...</span>
        <h2 title={file.name}>{file.name}</h2>
      </div>
      <div className="selected-file__inspecting">
        <Loader2 className="spinner" aria-hidden="true" size={16} strokeWidth={2} />
        Optimizing...
      </div>
    </div>
  )
}
