import { Brand } from './components/Brand'
import { UploadDropzone } from './components/UploadDropzone'

export function App() {
  return (
    <main className="popup-shell">
      <div className="ambient-orb" aria-hidden="true" />
      <div className="ambient-shape" aria-hidden="true" />
      <div className="content">
        <header className="intro">
          <Brand />
          <h1>PDF Compressor</h1>
          <p>Shrink your PDFs without the hassle.</p>
        </header>

        <UploadDropzone />

        <footer className="benefits" aria-label="Product benefits">
          <span>Fast</span>
          <i aria-hidden="true" />
          <span>Private</span>
          <i aria-hidden="true" />
          <span>Simple</span>
        </footer>
      </div>
    </main>
  )
}
