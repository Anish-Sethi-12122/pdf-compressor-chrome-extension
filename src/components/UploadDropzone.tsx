import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { FileUp, Upload } from 'lucide-react'
import { validatePdfFile } from '../lib/pdfFile'
import { inspectPdf } from '../lib/pdfInspector'
import type { PdfInspectionResult } from '../lib/pdfInspector'
import { CompressionClient } from '../lib/compression/CompressionClient'
import type { CompressionResult } from '../lib/compression/CompressionEngine'
import { FileError } from './FileError'
import { InspectingFile } from './InspectingFile'
import { PrimaryButton } from './PrimaryButton'
import { ReadyFile } from './ReadyFile'
import { CompressingFile } from './CompressingFile'
import { CompressedResult } from './CompressedResult'

type AppState =
  | { stage: 'idle' }
  | { stage: 'dragging'; returnTo: 'idle' | 'error'; errorMessage?: string; errorReason?: string }
  | { stage: 'inspecting'; file: File }
  | { stage: 'ready'; file: File; inspection: Extract<PdfInspectionResult, { ok: true }> }
  | { stage: 'error'; message: string; reason?: 'encrypted' | 'malformed' | 'parse_error' | 'invalid' }
  | { stage: 'compressing'; file: File; inspection: Extract<PdfInspectionResult, { ok: true }> }
  | { stage: 'compressed'; file: File; inspection: Extract<PdfInspectionResult, { ok: true }>; result: Extract<CompressionResult, { ok: true }> }
  | { stage: 'compressionError'; file: File; inspection: Extract<PdfInspectionResult, { ok: true }>; message: string }

function hasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

export function UploadDropzone() {
  const [state, setState] = useState<AppState>({ stage: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  
  // Compression client instance
  const clientRef = useRef<CompressionClient | null>(null)

  useEffect(() => {
    // Initialise worker immediately so it's warm
    clientRef.current = new CompressionClient()
    // @ts-ignore - Expose for test suite
    window.__TEST_COMPRESSION_CLIENT = clientRef.current;
    
    return () => {
      clientRef.current?.terminate()
    }
  }, [])

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
      if (inspectionToken.current !== token) return

      if (result.ok) {
        setState({ stage: 'ready', file, inspection: result })
      } else {
        setState({ stage: 'error', message: result.message, reason: result.reason })
      }
    })
  }

  const handleCompress = async () => {
    if (state.stage !== 'ready') return

    const { file, inspection } = state
    setState({ stage: 'compressing', file, inspection })

    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const result = await clientRef.current!.compress(uint8Array, { preset: 'balanced' })

      if (result.ok) {
        setState({ stage: 'compressed', file, inspection, result })
      } else {
        setState({ stage: 'compressionError', file, inspection, message: result.message })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.'
      setState({ stage: 'compressionError', file, inspection, message })
    }
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
      if (current.stage === 'error' || current.stage === 'compressionError') {
        return {
          stage: 'dragging',
          returnTo: 'error',
          errorMessage: 'message' in current ? current.message : undefined,
          errorReason: 'reason' in current ? current.reason : undefined,
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
          onCompress={handleCompress}
        />
      )
    }

    if (state.stage === 'compressing') {
      return <CompressingFile file={state.file} />
    }

    if (state.stage === 'compressed') {
      return (
        <CompressedResult
          originalFile={state.file}
          result={state.result}
          onStartOver={reset}
        />
      )
    }

    if (state.stage === 'error' || state.stage === 'compressionError') {
      return (
        <FileError
          message={state.message}
          reason={'reason' in state ? state.reason : undefined}
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
