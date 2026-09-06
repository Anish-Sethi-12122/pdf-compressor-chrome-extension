/**
 * Analytics — Core Transport Layer
 *
 * This module handles all GA4 Measurement Protocol communication.
 * It is the single point of contact with Google Analytics infrastructure.
 *
 * Architecture:
 *   Application code  →  trackEvent()  →  this module  →  GA4 Measurement Protocol
 *
 * Guarantees:
 * - Analytics never affects core functionality. Every network operation is
 *   fire-and-forget; errors are silently caught and logged only in development.
 * - No event is sent unless consent is 'granted' AND configuration is active.
 * - No PDF data, filenames, paths, or personal information is sent.
 * - Only events from the allowlist (analyticsEvents.ts) can be dispatched.
 * - The client_id is a random per-install identifier stored in chrome.storage.local.
 *   It is NOT linked to any user identity, PDF content, or external account.
 * - Session is tracked in-memory only (no persistent cross-session identifier).
 */

import {
  GA_ENDPOINT,
  MEASUREMENT_ID,
  API_SECRET,
  ANALYTICS_CONFIGURED,
  DEFAULT_ENGAGEMENT_TIME_MS,
  SESSION_EXPIRATION_MIN,
} from './analyticsConfig';
import { getConsentState, isAnalyticsPermitted } from './analyticsConsent';
import type { AnalyticsEventName } from './analyticsEvents';

// ── Client ID (per-install random identifier) ────────────────────────────────

const CLIENT_ID_KEY = 'analyticsClientId';

function generateClientId(): string {
  // Format: <10 random digits>.<unix timestamp seconds>
  // This matches the GA-typical client ID format as recommended in Chrome docs.
  const randomPart = Array.from({ length: 10 }, () =>
    Math.floor(Math.random() * 9 + 1).toString()
  ).join('');
  const timestampPart = Math.floor(Date.now() / 1000).toString();
  return `${randomPart}.${timestampPart}`;
}

async function getOrCreateClientId(): Promise<string> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(CLIENT_ID_KEY);
      let clientId: string = result[CLIENT_ID_KEY] as string;
      if (!clientId) {
        clientId = generateClientId();
        await chrome.storage.local.set({ [CLIENT_ID_KEY]: clientId });
      }
      return clientId;
    }
    // Fallback for non-extension environments (dev/test)
    let clientId = localStorage.getItem(CLIENT_ID_KEY);
    if (!clientId) {
      clientId = generateClientId();
      localStorage.setItem(CLIENT_ID_KEY, clientId);
    }
    return clientId;
  } catch {
    return generateClientId(); // Use ephemeral ID if storage fails
  }
}

// ── Session ID (in-memory, per-browser-session) ──────────────────────────────

interface SessionData {
  session_id: string;
  timestamp: number;
}

let _sessionData: SessionData | null = null;

function getOrCreateSessionId(): string {
  const nowMs = Date.now();
  const expirationMs = SESSION_EXPIRATION_MIN * 60 * 1000;

  if (_sessionData && nowMs - _sessionData.timestamp <= expirationMs) {
    _sessionData.timestamp = nowMs;
    return _sessionData.session_id;
  }

  // Create a new session
  _sessionData = {
    session_id: nowMs.toString(),
    timestamp: nowMs,
  };
  return _sessionData.session_id;
}

// ── Transport ────────────────────────────────────────────────────────────────

/**
 * Send a single event to Google Analytics via Measurement Protocol.
 *
 * This function is fire-and-forget:
 * - It never throws.
 * - It never returns a meaningful value.
 * - Network failures, GA rejections, and misconfigurations are swallowed.
 * - Core PDF functionality is NEVER blocked by this call.
 */
async function sendEvent(
  eventName: AnalyticsEventName,
  eventParams: Record<string, string | number | boolean>
): Promise<void> {
  try {
    if (!ANALYTICS_CONFIGURED) return; // Placeholders — do nothing

    const consentState = await getConsentState();
    if (!isAnalyticsPermitted(consentState)) return;

    const clientId = await getOrCreateClientId();
    const sessionId = getOrCreateSessionId();

    const payload = {
      client_id: clientId,
      events: [
        {
          name: eventName,
          params: {
            session_id: sessionId,
            engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_MS,
            ...eventParams,
          },
        },
      ],
    };

    await fetch(
      `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  } catch {
    // Silently swallow all errors. Analytics must never affect core functionality.
    if (import.meta.env?.DEV) {
      // Development-only logging — not present in production builds
      // eslint-disable-next-line no-console
      console.debug('[Analytics] Event send failed (non-critical):', eventName);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
// These are the only functions the rest of the application should call.
// They accept only the allowlisted parameters defined in analyticsEvents.ts.

export const analytics = {
  extensionOpened: (): void => { void sendEvent('extension_opened', {}); },
  pdfSelected: (): void => { void sendEvent('pdf_selected', {}); },
  inspectionCompleted: (): void => { void sendEvent('inspection_completed', {}); },
  compressionStarted: (mode: string): void => { void sendEvent('compression_started', { compression_mode: mode }); },
  compressionCompleted: (mode: string): void => { void sendEvent('compression_completed', { compression_mode: mode }); },
  compressionSkipped: (mode: string): void => { void sendEvent('compression_skipped', { compression_mode: mode }); },
  compressionFailed: (mode: string, category: 'worker_error' | 'timeout' | 'unknown' = 'unknown'): void => {
    void sendEvent('compression_failed', { compression_mode: mode, failure_category: category });
  },
  downloadClicked: (): void => { void sendEvent('download_clicked', {}); },
  compressionModeSelected: (mode: string): void => { void sendEvent('compression_mode_selected', { compression_mode: mode }); },
  consentGranted: (): void => { void sendEvent('consent_granted', {}); },
  consentDenied: (): void => { void sendEvent('consent_denied', {}); },
};
