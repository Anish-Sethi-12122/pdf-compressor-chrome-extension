# Security Policy

## Supported Versions
Only the latest released version of the PDF Compressor extension is actively supported for security updates. 

## Reporting a Vulnerability
If you discover a security vulnerability, please do NOT report it in the public issue tracker.
Please email the project owner/maintainer directly with a detailed description of the vulnerability and steps to reproduce it.

## Security Architecture Overview
This extension is designed with a strict "local-first" privacy and security model:

1.  **Manifest V3 & CSP:** The extension fully complies with Chrome's Manifest V3. The Content Security Policy (script-src 'self' 'wasm-unsafe-eval') strictly prohibits remote script execution.
2.  **Web Worker Isolation:** All PDF parsing, manipulation, and compression operations are isolated within a dedicated Web Worker. This prevents heavy processing tasks from blocking the main UI thread and isolates the WebAssembly execution environment.
3.  **Local Processing:** No PDF document is ever uploaded to a remote server. The entire compression pipeline (structural optimization via qpdf and image re-compression) runs entirely on the local device.
4.  **No Extracted Secrets:** The project mandates that no sensitive API keys, database credentials, or backend tokens are bundled in the extension. 
5.  **Analytics Isolation:** Analytics are entirely optional, consent-gated, and architected as fire-and-forget etch requests. A network failure, AdBlocker interference, or missing API secret will *never* break the core PDF functionality. No PDF content or metadata is sent in these analytics payloads.
