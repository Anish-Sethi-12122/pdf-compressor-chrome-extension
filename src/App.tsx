import { useEffect, useState } from 'react'
import { Brand } from './components/Brand'
import { UploadDropzone } from './components/UploadDropzone'
import { BackgroundShapes } from './components/BackgroundShapes'
import { ConsentBanner } from './components/ConsentBanner'
import { AnalyticsToggle } from './components/AnalyticsToggle'
import { EXTERNAL_LINKS } from './lib/constants'
import { analytics } from './lib/analytics/analytics'
import type { ConsentState } from './lib/analytics/analyticsConsent'

export function App() {
  // Track consent state so the ConsentBanner can notify us when resolved.
  // 'unset' until we know: the banner is rendering and will tell us.
  const [consentState, setConsentState] = useState<ConsentState>('unset')

  useEffect(() => {
    // Fire extension_opened on first mount (fire-and-forget, gated by consent inside analytics)
    analytics.extensionOpened()
  }, [])

  return (
    <main className="popup-shell">
      <BackgroundShapes />
      
      <div className="content">
        <header className="intro">
          <Brand />
          <h1>PDF Compressor</h1>
          <p>Shrink your PDFs without the hassle. <br/><span className="highlight-text">Works 100% locally on your device.</span></p>
        </header>

        <UploadDropzone />

        <footer className="footer-container">
          <div className="benefits" aria-label="Product benefits">
            <span>Fast</span>
            <i aria-hidden="true" />
            <span>Private</span>
            <i aria-hidden="true" />
            <span>Simple</span>
          </div>

          <div className="support-section">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
              <span className="attribution">
                By <a href={EXTERNAL_LINKS.linkedIn} target="_blank" rel="noopener noreferrer" className="attribution-link" aria-label="Anish Sethi on LinkedIn">Anish Sethi</a> <span aria-hidden="true">❤️</span>
              </span>
              <AnalyticsToggle consentState={consentState} onConsentChange={setConsentState} />
            </div>
            {EXTERNAL_LINKS.buyMeACoffee ? (
              <a href={EXTERNAL_LINKS.buyMeACoffee} target="_blank" rel="noopener noreferrer" className="support-cta">
                ☕ Buy Me a Coffee
              </a>
            ) : (
              <a href="#" aria-disabled="true" onClick={(e) => e.preventDefault()} className="support-cta support-cta--unconfigured" title="Support destination unconfigured">
                ☕ Buy Me a Coffee
              </a>
            )}
          </div>
        </footer>
      </div>

      {/* Consent banner — shown once on first launch, resolves itself */}
      <ConsentBanner onConsentResolved={setConsentState} />
    </main>
  )
}
