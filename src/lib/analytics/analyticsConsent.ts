/**
 * Analytics Consent — manages the user's analytics opt-in/opt-out preference.
 *
 * Default state: 'unset' (analytics disabled until explicit consent).
 * Persistence: chrome.storage.local (if available) or localStorage as fallback
 *              for environments without the Chrome extension API (dev/test).
 *
 * Valid states:
 *   'granted' — user has explicitly consented to analytics
 *   'denied'  — user has explicitly declined analytics
 *   'unset'   — no decision has been made; analytics is disabled
 *
 * Any stored value outside this set is treated as 'unset' (safe default).
 */

export type ConsentState = 'granted' | 'denied' | 'unset';

const CONSENT_KEY = 'analyticsConsent';
const VALID_STATES: ConsentState[] = ['granted', 'denied', 'unset'];

function isValidConsentState(value: unknown): value is ConsentState {
  return typeof value === 'string' && VALID_STATES.includes(value as ConsentState);
}

/**
 * Read the persisted consent state.
 * Returns 'unset' if storage is unavailable or the stored value is invalid.
 */
export async function getConsentState(): Promise<ConsentState> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(CONSENT_KEY);
      const value = result[CONSENT_KEY];
      return isValidConsentState(value) ? value : 'unset';
    }
    // Fallback for non-extension environments (dev/test)
    const raw = localStorage.getItem(CONSENT_KEY);
    return isValidConsentState(raw) ? raw : 'unset';
  } catch {
    return 'unset';
  }
}

/**
 * Persist the consent state.
 * Invalid values are rejected and treated as 'unset'.
 */
export async function setConsentState(state: ConsentState): Promise<void> {
  if (!isValidConsentState(state)) return;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [CONSENT_KEY]: state });
      return;
    }
    localStorage.setItem(CONSENT_KEY, state);
  } catch {
    // Silently ignore storage errors — consent state is best-effort.
  }
}

/**
 * Synchronously check whether analytics is currently permitted.
 * This is a lightweight check for use in the hot path; use getConsentState()
 * for authoritative persistence reads.
 */
export function isAnalyticsPermitted(state: ConsentState): boolean {
  return state === 'granted';
}
