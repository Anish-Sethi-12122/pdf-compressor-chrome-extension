/**
 * Analytics Consent Banner
 *
 * Shown on first launch when consent is 'unset'.
 * Tells the user exactly what is collected, why, and what happens when declined.
 *
 * Design rules (from Phase 18):
 * - Both Accept and Decline controls are equally prominent.
 * - No pre-selected consent.
 * - Plain language — no dark patterns.
 * - Shown only when consent is 'unset'.
 * - Dismissed permanently once a choice is made.
 */

import { useState, useEffect } from 'react';
import { getConsentState, setConsentState } from '../lib/analytics/analyticsConsent';
import type { ConsentState } from '../lib/analytics/analyticsConsent';
import { analytics } from '../lib/analytics/analytics';

interface ConsentBannerProps {
  /** Called after user makes a consent decision, with the resolved state. */
  onConsentResolved: (state: ConsentState) => void;
}

export function ConsentBanner({ onConsentResolved }: ConsentBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    getConsentState().then((state) => {
      if (state === 'unset') {
        setVisible(true);
      } else {
        onConsentResolved(state);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGrant = async () => {
    await setConsentState('granted');
    analytics.consentGranted();
    setVisible(false);
    onConsentResolved('granted');
  };

  const handleDeny = async () => {
    await setConsentState('denied');
    analytics.consentDenied();
    setVisible(false);
    onConsentResolved('denied');
  };

  if (!visible) return null;

  return (
    <div className="consent-banner" role="dialog" aria-modal="false" aria-label="Analytics consent">
      <div className="consent-banner__content">
        <p className="consent-banner__text">
          Help improve this extension by sharing anonymous usage events
          (e.g. "compression completed"). <strong>No PDF content, filenames, or personal
          information is ever collected.</strong> Analytics are optional and you can
          change this setting at any time.
        </p>
        <div className="consent-banner__actions">
          <button
            className="consent-btn consent-btn--deny"
            onClick={handleDeny}
            aria-label="Decline anonymous analytics"
          >
            No thanks
          </button>
          <button
            className="consent-btn consent-btn--grant"
            onClick={handleGrant}
            aria-label="Accept anonymous analytics"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
