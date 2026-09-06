/**
 * Analytics Event Allowlist
 *
 * This module defines the complete, finite set of events and their allowed
 * parameters. No component may call analytics with arbitrary event names or
 * arbitrary parameter objects.
 *
 * Rules enforced here:
 * - Event names are a closed union — TypeScript prevents unknown events.
 * - Parameters are typed per event — no arbitrary key/value pairs.
 * - No PDF data, filenames, paths, or personal information may appear in any event.
 * - All parameter values must be safe aggregate identifiers from a finite set.
 */

import type { CompressionMode } from '../compression/compressionConfig';

// ── Event name type (closed union) ──────────────────────────────────────────

export type AnalyticsEventName =
  | 'extension_opened'
  | 'pdf_selected'
  | 'inspection_completed'
  | 'compression_started'
  | 'compression_completed'
  | 'compression_skipped'
  | 'compression_failed'
  | 'download_clicked'
  | 'compression_mode_selected'
  | 'consent_granted'
  | 'consent_denied';

// ── Per-event parameter types ────────────────────────────────────────────────
// Each event carries ONLY the minimum parameters needed to answer product questions.
// No PDF data, filenames, or personal information may appear here.

export interface ExtensionOpenedParams {
  // No parameters — just a presence/usage signal.
}

export interface PdfSelectedParams {
  // No parameters — counts PDF selections without any file details.
}

export interface InspectionCompletedParams {
  // No parameters — counts successful inspections.
}

export interface CompressionStartedParams {
  /** One of the three defined compression modes. */
  compression_mode: CompressionMode;
}

export interface CompressionCompletedParams {
  /** One of the three defined compression modes. */
  compression_mode: CompressionMode;
}

export interface CompressionSkippedParams {
  /** One of the three defined compression modes. */
  compression_mode: CompressionMode;
}

export interface CompressionFailedParams {
  /** One of the three defined compression modes. */
  compression_mode: CompressionMode;
  /**
   * A controlled failure category. Only predefined values are sent.
   * Raw error messages, stack traces, and diagnostic output must NOT be used.
   */
  failure_category: 'worker_error' | 'timeout' | 'unknown';
}

export interface DownloadClickedParams {
  // No parameters — counts download actions.
}

export interface CompressionModeSelectedParams {
  /** One of the three defined compression modes. */
  compression_mode: CompressionMode;
}

export interface ConsentGrantedParams {
  // No parameters — records consent being given.
}

export interface ConsentDeniedParams {
  // No parameters — records consent being declined.
}

// ── Discriminated union of all supported events ──────────────────────────────

export type AnalyticsEvent =
  | { name: 'extension_opened'; params: ExtensionOpenedParams }
  | { name: 'pdf_selected'; params: PdfSelectedParams }
  | { name: 'inspection_completed'; params: InspectionCompletedParams }
  | { name: 'compression_started'; params: CompressionStartedParams }
  | { name: 'compression_completed'; params: CompressionCompletedParams }
  | { name: 'compression_skipped'; params: CompressionSkippedParams }
  | { name: 'compression_failed'; params: CompressionFailedParams }
  | { name: 'download_clicked'; params: DownloadClickedParams }
  | { name: 'compression_mode_selected'; params: CompressionModeSelectedParams }
  | { name: 'consent_granted'; params: ConsentGrantedParams }
  | { name: 'consent_denied'; params: ConsentDeniedParams };
