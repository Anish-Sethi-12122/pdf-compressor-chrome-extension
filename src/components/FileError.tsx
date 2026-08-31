import { AlertCircle, Lock, Upload } from 'lucide-react'
import { PrimaryButton } from './PrimaryButton'

type FileErrorProps = {
  message: string
  /**
   * Optional classification used to select an appropriate icon.
   * 'encrypted' shows a lock icon; all other reasons use the alert icon.
   */
  reason?: 'encrypted' | 'malformed' | 'parse_error' | 'invalid'
  onChooseAnotherFile: () => void
}

function titleForReason(reason: FileErrorProps['reason']): string {
  switch (reason) {
    case 'encrypted':
      return 'PDF is password-protected'
    case 'malformed':
      return 'PDF appears to be damaged'
    case 'parse_error':
      return 'Could not read this PDF'
    default:
      return "That doesn't look like a PDF"
  }
}

export function FileError({ message, reason, onChooseAnotherFile }: FileErrorProps) {
  const isEncrypted = reason === 'encrypted'
  const Icon = isEncrypted ? Lock : AlertCircle

  return (
    <div className="file-error" role="alert" aria-live="assertive">
      <div className="file-error__icon" aria-hidden="true">
        <Icon strokeWidth={1.65} />
      </div>
      <div className="dropzone-copy">
        <h2>{titleForReason(reason)}</h2>
        <p>{message}</p>
      </div>
      <PrimaryButton onClick={onChooseAnotherFile} aria-label="Choose another PDF file">
        <Upload aria-hidden="true" size={16} strokeWidth={2.1} />
        Choose another file
      </PrimaryButton>
    </div>
  )
}
