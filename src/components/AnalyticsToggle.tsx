import { setConsentState, type ConsentState } from '../lib/analytics/analyticsConsent';
import { analytics } from '../lib/analytics/analytics';

interface AnalyticsToggleProps {
  consentState: ConsentState;
  onConsentChange: (state: ConsentState) => void;
}

export function AnalyticsToggle({ consentState, onConsentChange }: AnalyticsToggleProps) {
  // If unset, the banner is handling it; don't show the toggle yet to avoid confusion.
  if (consentState === 'unset') return null;

  const isGranted = consentState === 'granted';

  const toggleConsent = async () => {
    const newState = isGranted ? 'denied' : 'granted';
    await setConsentState(newState);
    onConsentChange(newState);
    
    // Fire the corresponding event (or drop if denied)
    if (newState === 'granted') {
      analytics.consentGranted();
    } else {
      analytics.consentDenied();
    }
  };

  return (
    <button 
      className={`analytics-toggle ${isGranted ? 'analytics-toggle--on' : 'analytics-toggle--off'}`}
      onClick={toggleConsent}
      aria-label={isGranted ? "Disable analytics" : "Enable analytics"}
      title={isGranted ? "Analytics are enabled. Click to disable." : "Analytics are disabled. Click to enable."}
    >
      <span className="analytics-toggle__indicator" aria-hidden="true"></span>
      Analytics: {isGranted ? 'On' : 'Off'}
    </button>
  );
}
