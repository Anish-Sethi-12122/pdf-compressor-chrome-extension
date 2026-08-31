import { FileText } from 'lucide-react'

/**
 * Shown while pdf-lib is asynchronously parsing the selected file.
 * The file name and size come from the File object, which is already known
 * before inspection completes.
 */
export function InspectingFile({ file }: { file: File }) {
  return (
    <div className="selected-file" aria-live="polite">
      <div className="selected-file__icon selected-file__icon--inspecting" aria-hidden="true">
        <FileText strokeWidth={1.65} />
      </div>
      <div className="selected-file__details">
        <span className="selected-file__eyebrow">PDF selected</span>
        <h2 title={file.name}>{file.name}</h2>
      </div>
      <div className="selected-file__inspecting">
        <span className="spinner" aria-hidden="true" />
        Inspecting…
      </div>
    </div>
  )
}
