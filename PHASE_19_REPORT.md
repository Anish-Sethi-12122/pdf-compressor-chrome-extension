# Phase 19 Banner & Interstitial Ads Research and Monetization Report

## A. Policy Research
**Google AdSense Policy**
Google AdSense explicitly states that it is not permitted to serve ads within software applications, which strictly includes browser extensions, toolbars, and desktop apps. The current Google AdSense program policies strictly limit monetization to standard web pages and some specialized products, but not browser extensions.

**Google AdMob Policy**
Google AdMob is designed specifically for mobile applications (Android and iOS). It is not intended for, nor does it support, Chrome extensions or desktop browser environments. Attempting to use AdMob in a desktop extension violates its policies and risks account termination.

**Chrome Web Store & Manifest V3 (MV3)**
Manifest V3 prohibits the execution of remote code (e.g., <script src="..."></script>). Any ad network that requires fetching a remote SDK or injecting dynamic JavaScript at runtime violates MV3 CSP rules. Additionally, the Chrome Web Store Developer Program Policies require full transparency, prohibit deceptive behavior, and heavily scrutinize extensions that use broad permissions (e.g., <all_urls>) without a clear functional need. Loading ads via hidden iframes or popups to bypass these restrictions is considered malicious and deceptive.

## B. Advertising Providers Evaluated

| Provider | Extension support | Banner | Interstitial | Remote code | Permissions | Tracking | Consent | Risk | Recommendation |
| -------- | ----------------- | ------ | ------------ | ----------- | ----------- | -------- | ------- | ---- | -------------- |
| Google AdSense | NO | Yes | Yes | Yes (Prohibited) | Host | High | Yes | High | REJECT |
| Google AdMob | NO | Yes | Yes | Yes (Mobile SDKs)| N/A | High | Yes | High | REJECT |
| Adsterra | Unclear / No | Yes | Yes | Yes (Script) | Host | High | Yes | High (Malware risk) | REJECT |
| EthicalAds | NO | Yes | No | Yes / API | Host | Low | No | Low | REJECT (No Ext Support)|
| Carbon Ads | NO | Yes | No | Yes / API | Host | Low | No | Low | REJECT (No Ext Support)|
| Direct Sponsorship| YES | Yes | Yes | No | None | None | No | Low | DEFER (No provider) |

*Note: There are currently no mainstream API-only ad networks that explicitly support Chrome extensions without remote code or high malware/privacy risks.*

## C. Google AdSense
**Verdict: REJECT.**
Current Google policy explicitly prohibits distributing AdSense through browser extensions. Any workaround (iframe, hidden page, etc.) to circumvent this would violate both AdSense policies and Chrome Web Store policies, leading to extension takedown and potential account bans.

## D. Banner Decision
**Verdict: REJECT.**
No off-the-shelf ad provider can safely provide banner ads without violating MV3 (remote code execution), Chrome policies, or our strict privacy requirements (no tracking, no broad permissions). Direct sponsorships are the only compliant route, but we do not have a provider for this. Therefore, this is rejected/deferred.

## E. Interstitial Decision
**Verdict: REJECT.**
In addition to the issues with banner ads, interstitial ads provided by third-party networks often rely on aggressive popups, tracking, and workflow interruption. Without a compliant, safe provider that supports a purely native, remote-code-free API, implementing an interstitial is fundamentally unsafe.

## F. Privacy
*   **Data collected:** No new data collected (Ads rejected).
*   **Data not collected:** PDF contents, filenames, metadata, tracking data.
*   **Consent:** No new consent required since no ads are implemented. The Phase 18 Analytics consent remains fully intact.
*   **Targeting:** None.
*   **PDF isolation:** Maintained.

## G. Security
*   **Remote-code analysis:** All evaluated providers either require remote script execution (violating MV3) or lack official extension support.
*   **Permissions:** Implementing ads via these networks would require broad host permissions, which we are rejecting.
*   **Dependencies:** No new dependencies added.

## H. Implementation
**Decision: REJECT**
No code changes were made to the source code. The core workflow, privacy model, and Phase 18 Google Analytics integration remain completely intact. The extension remains 100% compliant with MV3 and the Chrome Web Store guidelines.

## I. Testing
Since the implementation was rejected to preserve the safety and compliance of the extension, no ad-specific tests were added.
*   **Phase 13-18 tests:** 100% Passing (No changes introduced)
*   **Lifecycle tests:** 100% Passing
*   **Browser/production tests:** 100% Passing

## J. Production Verification
Confirmed. The production build remains stable, fast, and fully local. The Buy Me a Coffee and LinkedIn attribution remain prominent in the UI.

## K. Known Issues
None.

## L. Verdict
**COMPLETE / REJECTED**
The addition of third-party ad networks (AdSense, AdMob, etc.) is **REJECTED**.
**Reason:** Adding these networks would require violating Manifest V3 restrictions (remote code), circumventing provider policies (AdSense prohibits extensions), and compromising the strict privacy and security model of this extension. A REJECT decision is taken to ensure the extension remains safe, policy-compliant, and functional.

## M. Readiness for Phase 20
The project is fully stable and ready for:
**Phase 20 — CAPTCHA Feasibility Research & Implementation**
