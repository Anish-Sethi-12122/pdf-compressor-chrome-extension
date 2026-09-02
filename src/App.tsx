import { Brand } from './components/Brand'
import { UploadDropzone } from './components/UploadDropzone'

export function App() {
  return (
    <main className="popup-shell">
      <div className="bg-shape shape-1" aria-hidden="true" />
      <div className="bg-shape shape-2" aria-hidden="true" />
      <div className="bg-shape shape-3" aria-hidden="true" />
      <div className="bg-shape shape-4" aria-hidden="true" />
      
      <div className="content">
        <header className="intro">
          <Brand />
          <h1>PDF Compressor</h1>
          <p>Shrink your PDFs without the hassle. <br/><span className="highlight-text">Works 100% locally on your device.</span></p>
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
