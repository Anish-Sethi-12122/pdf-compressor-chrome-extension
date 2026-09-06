# Contributing to PDF Compressor

Thank you for your interest in contributing to PDF Compressor! As an open-source project, we welcome community contributions that align with our core goals.

## Core Architectural Invariants
Before proposing changes, please ensure they respect the fundamental design of this extension:
*   **100% Local Processing:** PDFs must never be uploaded to a backend or processed via cloud services.
*   **Privacy-First:** Do not add hidden telemetry, tracking, or mandatory data collection.
*   **No Remote Code:** Manifest V3 strictly prohibits remote code execution. All code must be bundled.
*   **Zero Permissions (where possible):** Do not request unnecessary host permissions.
*   **Security & Consent:** Any external network requests (like Analytics) must be strictly isolated from the core PDF workflow and governed by explicit user consent.

## Development Workflow
1.  **Fork & Clone:** Fork the repository and clone it locally.
2.  **Install Dependencies:** Run 
pm install.
3.  **Local Testing:** Run 
pm run dev for local UI development. Run 
pm run build to generate the dist/ folder, which can be loaded into Chrome as an unpacked extension.
4.  **Run Tests:** Before submitting a PR, ensure all regression and accessibility tests pass:
    `ash
    node test-extension.mjs
    node test-modes.mjs
    node test-mode-ui.mjs
    node test-accessibility.mjs
    node test-hardening.mjs
    node test-analytics.mjs
    `
5.  **Submit a Pull Request:** Describe your changes clearly, referencing any related issues.

## Bug Reports
When opening an issue, please include:
*   Your Chrome version and OS.
*   The exact steps to reproduce the issue.
*   If possible, an anonymised version of the PDF that triggered the bug (ensure it contains no sensitive data).
