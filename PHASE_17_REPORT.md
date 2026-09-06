# Phase 17 Buy Me a Coffee + Anish Sethi Attribution Report

## A. Changes Made
- `src/lib/constants.ts`: Created to hold `EXTERNAL_LINKS` object with the LinkedIn profile URL.
- `src/App.tsx`: Updated to replace the simple benefits footer with a new combined `footer.footer-container` containing the benefits, attribution, and a Buy Me a Coffee support CTA.
- `src/styles.css`: Added styles for the footer container, attribution text, link, and Buy Me a Coffee button, along with styling for an unconfigured state.
- `test-attribution.mjs`: Added new puppeteer tests to verify the attribution text, URLs, keyboard focus order, and the correct handling of the unconfigured state.

## B. Attribution
- **Exact displayed text:** "By Anish Sethi ❤️"
- **LinkedIn URL:** `https://linkedin.com/in/anish-sethi-dtu-cse`
- **Placement:** Bottom of the popup/application, inside the footer area.
- **Accessibility implementation:** The link "Anish Sethi" is a native `<a>` tag with `target="_blank"`, `rel="noopener noreferrer"`, an explicit `aria-label="Anish Sethi on LinkedIn"`, keyboard reachable (tabbable natively in normal document flow), visible focus indicator, and does not rely on hover. The heart emoji is marked with `aria-hidden="true"`.

## C. Buy Me a Coffee
- **UI implementation:** Added a "☕ Buy Me a Coffee" button below the attribution.
- **Destination URL:** Unconfigured.
- **Implementation Mechanism:** A plain native `<a>` tag styled as a button.
- **Why this approach:** A native link ensures no 3rd-party widgets, no extra network requests, and complies strictly with the privacy-first architecture requirement.
- **Explicit Statement:** **The Buy Me a Coffee account URL was not available in the repository.** Following the instructions not to fabricate one, the destination remains unconfigured. The support CTA is rendered with an `aria-disabled="true"` attribute, an `onClick` that prevents default navigation, a `title="Support destination unconfigured"`, and disabled-state styling (grayscale).

## D. Accessibility
- **Tab order:** Natural DOM order: Compression Mode → Upload Button / Dropzone → Action Buttons (Compress / Retry / Start over / Download) → Attribution Link ("Anish Sethi") → Buy Me a Coffee CTA.
- **Focus visibility:** Achieved via `:focus-visible` styling (`outline: 2px solid #d62828`).
- **Accessible names:** Meaningful names via native link text and `aria-label="Anish Sethi on LinkedIn"`.
- **Keyboard activation:** Native `<a>` activation via Enter.
- **Screen-reader semantics:** Heart character is hidden via `aria-hidden="true"`, links use native semantics without redundant ARIA.

## E. Privacy / Security
- **No PDF data leaves the extension:** Confirmed.
- **No tracking:** Confirmed.
- **No telemetry:** Confirmed.
- **No analytics:** Confirmed.
- **No runtime third-party scripts:** Confirmed.
- **No new permissions:** Confirmed.
- **No secrets:** Confirmed.
- **CSP status:** Valid (no external scripts or inline scripts added).

## F. Tests
- **Build/type checking:** Passed. (`npm install && npx tsc -b && npx vite build`)
- **Phase 13 tests:** Passed. (`test-hardening.mjs`)
- **Phase 14 tests:** Passed. (`test-modes.mjs`)
- **Phase 15 tests:** Passed. (`test-mode-ui.mjs`)
- **Phase 16 accessibility tests:** Passed. (`test-accessibility.mjs`)
- **New Phase 17 tests:** Passed. (`test-attribution.mjs` successfully verifies attribution text, link, and Buy Me a Coffee unconfigured state)
- **Lifecycle tests:** Passed. (In `test-hardening.mjs`)
- **Production browser tests:** Passed. (Puppeteer loads the `dist` folder identically to Chrome production).

## G. Production Verification
The production build was loaded and verified. The attribution is properly placed, the text matches exactly, the LinkedIn hyperlink works, the Buy Me a Coffee button displays correctly (in disabled/unconfigured state), and existing workflows are unbroken without overflow.

## H. Known Issues
- **Missing/unknown Buy Me a Coffee destination:** The Buy Me a Coffee account URL is missing from the repository. The support CTA has been implemented safely but remains unconfigured and non-functional until a URL is provided.

## I. Phase Verdict
**COMPLETE**

## J. Readiness for Phase 18
The project is ready for **Phase 18 — Google Analytics Research, Privacy/Consent Architecture & Implementation**.
