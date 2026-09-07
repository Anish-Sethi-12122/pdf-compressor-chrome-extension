# Phase 20 CAPTCHA Feasibility Research & Implementation Report

## A. Repository Baseline
The repository baseline is a completely local Chrome Extension that uses WebAssembly (qpdf) to compress PDFs in a Web Worker. 
*   **Permissions:** None. (The manifest relies on implicit permissions and local storage).
*   **Content Security Policy:** script-src 'self' 'wasm-unsafe-eval'; object-src 'self'.
*   **Network:** The only outbound network activity is an explicit, fire-and-forget Google Analytics 4 (GA4) etch payload, isolated from the core PDF processing, and strictly governed by user consent.
*   **Tests:** All baseline tests (Lifecycle, Matrix, Analytics, UI, Accessibility) are 100% passing.

## B. Current Architecture Relevant to CAPTCHA
The product has **no backend**, **no user authentication**, **no form submissions**, and **no cloud processing**. All PDF compression occurs on the user's local hardware. The extension is purely a client-side utility.

## C. Current Authoritative Google/reCAPTCHA Findings
1.  **Backend Requirement:** Google's authoritative documentation states that verifying a reCAPTCHA response requires a backend server to securely transmit the Secret Key and user token to Google's verification endpoint (https://www.google.com/recaptcha/api/siteverify). 
2.  **Secret Key Safety:** The Secret Key must never be exposed in client-side code (frontend/extension).
3.  **Client Library:** reCAPTCHA requires injecting an external JavaScript library (https://www.google.com/recaptcha/api.js).

## D. Chrome/MV3 Policy Findings
1.  **Manifest V3 Restrictions:** MV3 strictly prohibits the execution of remotely hosted code. Developers cannot inject the external reCAPTCHA JavaScript file into an extension page or background script. The extension must be entirely self-contained.
2.  **Workarounds (Iframes):** While sandboxed iframes can sometimes be used to load external pages that house a CAPTCHA, doing so without a legitimate need risks violating Chrome Web Store policies against deceptive behavior, and still requires a backend for actual verification.

## E. Data/Network/Privacy Analysis
Implementing reCAPTCHA would require Google's scripts to execute and profile the user's browser, IP, and behavior to calculate a risk score. This introduces an opaque tracking vector that fundamentally conflicts with the extension's advertised "Privacy-first, 100% local" architecture.

## F. Permissions/CSP/Remote-Code Analysis
To properly implement reCAPTCHA, we would be forced to:
*   Attempt to weaken the CSP to allow remote scripts (which is disallowed by MV3).
*   Add a backend verification server.
*   Add new host permissions to communicate with Google's reCAPTCHA servers.
*   Expose a Secret Key in the extension bundle if a backend is not built, rendering the CAPTCHA completely insecure and trivial to bypass.

## G. Whether CAPTCHA Provides Meaningful Value for This Product
**No.** CAPTCHA is designed to protect public server resources from automated abuse (e.g., spam submissions, brute-forcing, scraping). Because this extension operates entirely locally, there are no server endpoints to protect. If a bot automates the extension, it is only consuming the user's local CPU, which CAPTCHA is not meant to police. CAPTCHA provides zero security value in a fully local utility.

## H. Architectural Options Considered
*   **reCAPTCHA in the extension popup:** Blocked by MV3 (no remote code).
*   **reCAPTCHA in a sandboxed iframe:** Technically possible, but violates the privacy model, degrades UX, and still requires a backend to verify the token.
*   **Backend verification architecture:** Would require fundamentally redesigning the product from a local utility into a cloud service, violating a core architectural invariant.

## I. IMPLEMENT / DEFER / REJECT Decision
**REJECT.**

## J. Exact Implementation Changes
None. No code was added or modified. The repository remains completely clean.

## K. Tests Run and Actual Results
*   	est-extension.mjs: PASSED
*   	est-modes.mjs: PASSED
*   	est-mode-ui.mjs: PASSED
*   	est-accessibility.mjs: PASSED
*   	est-hardening.mjs: PASSED
*   	est-analytics.mjs: PASSED
*   	est-attribution.mjs: PASSED
*   	est-ga4.mjs: PASSED
All tests successfully pass in the current state. 

## L. Regression Status
Zero regressions. The extension remains functionally identical to the end of Phase 18 and Phase 19.

## M. Security/Privacy Impact
By rejecting CAPTCHA, we preserve the extension's privacy invariants. A manual review of the source code confirms no insecure APIs (val, innerHTML, remote <script>, iframe) exist. The GA4 secret is safely used only for outbound telemetry.

## N. Remaining Risks or Uncertainties
None. 

## O. Final Recommendation
Do not attempt to integrate server-protection mechanisms (like CAPTCHA or Rate Limiting) into a purely client-side local application. 

## P. Readiness for Phase 21
The project is completely stable, rigorously tested, and ready for Phase 21.

---
PHASE 20 — COMPLETE / REJECTED
