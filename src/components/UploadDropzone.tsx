import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { FileUp, Upload } from 'lucide-react'
import { validatePdfFile } from '../lib/pdfFile'
import { inspectPdf } from '../lib/pdfInspector'
import type { PdfInspectionResult } from '../lib/pdfInspector'
import { FileError } from './FileError'
import { InspectingFile } from './InspectingFile'
import { PrimaryButton } from './PrimaryButton'
import { ReadyFile } from './ReadyFile'

// ---------------------------------------------------------------------------
// State machine
//
//   idle ──────────────────────────────────────────────────────────┐
//   dragging ──► (drop) ──► inspecting ──► ready                  │
//   error ─────────────────────────────────────────────────────────┘
//                                    └──► error
//
// The `file` is held inside the inspecting/ready states so it is accessible
// during async inspection and remains the single source of truth for the
// currently selected document.
// ---------------------------------------------------------------------------

type AppState =
  | { stage: 'idle' }
  | { stage: 'dragging'; returnTo: 'idle' | 'error'; errorMessage?: string; errorReason?: string }
  | { stage: 'inspecting'; file: File }
  | { stage: 'ready'; file: File; inspection: Extract<PdfInspectionResult, { ok: true }> }
  | { stage: 'error'; message: string; reason?: 'encrypted' | 'malformed' | 'parse_error' | 'invalid' }

function hasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

export function UploadDropzone() {
  const [state, setState] = useState<AppState>({ stage: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  // Stale-result protection: each file selection increments a token.
  // The async inspection captures the token at its start; if the token has
  // changed by the time it resolves, the result is discarded silently.
  const inspectionToken = useRef(0)

  const isDragging = state.stage === 'dragging'

  const openFilePicker = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.click()
    }
  }

  const reset = () => {
    setState({ stage: 'idle' })
  }

  const beginInspection = (file: File) => {
    const token = ++inspectionToken.current

    setState({ stage: 'inspecting', file })

    inspectPdf(file).then((result) => {
      // If the user selected a different file while we were parsing,
      // discard this result — do not overwrite the newer UI state.
      if (inspectionToken.current !== token) return

      if (result.ok) {
        setState({ stage: 'ready', file, inspection: result })
      } else {
        setState({ stage: 'error', message: result.message, reason: result.reason })
      }
    })
  }

  const acceptFiles = (files: File[]) => {
    const selectedFile = files.find((f) => validatePdfFile(f).valid)

    if (selectedFile) {
      beginInspection(selectedFile)
      return
    }

    const validation = files[0] ? validatePdfFile(files[0]) : undefined
    setState({
      stage: 'error',
      reason: 'invalid',
      message:
        validation && !validation.valid
          ? validation.message
          : 'Please choose a PDF file to continue.',
    })
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) acceptFiles(files)
    event.target.value = ''
    event.target.blur()

    const popup = event.currentTarget.closest<HTMLElement>('.popup-shell')
    requestAnimationFrame(() => popup?.scrollTo({ top: 0 }))
  }

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setState((current) => {
      if (current.stage === 'dragging') return current
      if (current.stage === 'error') {
        return {
          stage: 'dragging',
          returnTo: 'error',
          errorMessage: current.message,
          errorReason: current.reason,
        }
      }
      return { stage: 'dragging', returnTo: 'idle' }
    })
  }

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) {
      setState((current) => {
        if (current.stage !== 'dragging') return current
        if (current.returnTo === 'error') {
          return {
            stage: 'error' as const,
            message: current.errorMessage ?? 'Please choose a PDF file to continue.',
            reason: current.errorReason as Extract<AppState, { stage: 'error' }>['reason'],
          }
        }
        return { stage: 'idle' }
      })
    }
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    acceptFiles(Array.from(event.dataTransfer.files))
  }

  const renderContent = () => {
    if (isDragging) {
      return (
        <div className="dragging-state" aria-live="polite">
          <div className="document-icon" aria-hidden="true">
            <FileUp strokeWidth={1.65} />
          </div>
          <div className="dropzone-copy">
            <h2>Drop your PDF to add it</h2>
            <p>Your file stays on this device.</p>
          </div>
        </div>
      )
    }

    if (state.stage === 'inspecting') {
      return <InspectingFile file={state.file} />
    }

    if (state.stage === 'ready') {
      return (
        <ReadyFile
          file={state.file}
          inspection={state.inspection}
          onChangeFile={openFilePicker}
          onRemoveFile={reset}
        />
      )
    }

    if (state.stage === 'error') {
      return (
        <FileError
          message={state.message}
          reason={state.reason}
          onChooseAnotherFile={openFilePicker}
        />
      )
    }

    // idle
    return (
      <div className="empty-state">
        <div className="document-icon" aria-hidden="true">
          <FileUp strokeWidth={1.65} />
        </div>
        <div className="dropzone-copy">
          <h2>Drop your PDF here</h2>
          <p id="upload-guidance">or click to browse</p>
        </div>
        <PrimaryButton onClick={openFilePicker} aria-label="Upload PDF">
          <Upload aria-hidden="true" size={16} strokeWidth={2.1} />
          Upload PDF
        </PrimaryButton>
      </div>
    )
  }

  return (
    <section
      className={`upload-dropzone ${isDragging ? 'upload-dropzone--dragging' : ''}`}
      aria-describedby={state.stage === 'idle' ? 'upload-guidance' : undefined}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        aria-label="Choose a PDF file"
      />

      {renderContent()}
    </section>
  )
}
