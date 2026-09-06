/**
 * Google Analytics 4 — Measurement Protocol Configuration
 *
 * HOW TO ACTIVATE ANALYTICS:
 * 1. Create a GA4 property at https://analytics.google.com/
 * 2. Add a Web data stream (use any placeholder URL, e.g. https://extension)
 * 3. Copy the Measurement ID (G-XXXXXXXXXX) from the stream details page
 * 4. Generate a Measurement Protocol API secret:
 *    Admin → Data Streams → [Your stream] → Measurement Protocol API secrets → Create
 * 5. Replace the placeholder values below with your real values
 *
 * SECURITY NOTE:
 * The measurement_id (G-XXXXXXXXXX) is a public identifier — safe to distribute.
 *
 * The api_secret is required by Measurement Protocol. Because this extension has
 * no backend, the secret will be present in the bundled extension package and is
 * therefore inspectable by the user. This is an accepted, documented pattern for
 * Chrome extensions (see developer.chrome.com/docs/extensions/how-to/integrate/
 * google-analytics-4/). The secret's only power is the ability to send events to
 * YOUR property. It does not grant access to your GA account, dashboards, or data.
 * Exposure risk: data pollution via spam events. Mitigate by rotating the secret
 * periodically in the GA4 Admin console.
 *
 * BEFORE COMMITTING: Ensure no real api_secret value is present in version control.
 * Keep MEASUREMENT_ID and API_SECRET as placeholders in the public repository.
 */

/** GA4 Measurement Protocol endpoint. */
export const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

/**
 * GA4 Web data stream Measurement ID (e.g. "G-XXXXXXXXXX").
 * This is a public identifier — safe to include in the distributed extension.
 *
 * Replace with your real Measurement ID to activate analytics.
 */
export const MEASUREMENT_ID = 'G-GMSYMN1H6B';

/**
 * GA4 Measurement Protocol API secret.
 * Generated in: GA4 Admin → Data Streams → [stream] → Measurement Protocol API secrets.
 *
 * Replace with your real API secret to activate analytics.
 * DO NOT commit a real secret to version control.
 */
export const API_SECRET = 'YOUR_MEASUREMENT_PROTOCOL_API_SECRET';

/**
 * Whether the analytics configuration is activated (non-placeholder values).
 * Analytics events are silently dropped when this is false.
 */
export const ANALYTICS_CONFIGURED =
  (API_SECRET as string) !== 'YOUR_MEASUREMENT_PROTOCOL_API_SECRET';

/** Default engagement time sent with each event (milliseconds). */
export const DEFAULT_ENGAGEMENT_TIME_MS = 100;

/** Session expiration after inactivity (minutes). */
export const SESSION_EXPIRATION_MIN = 30;
