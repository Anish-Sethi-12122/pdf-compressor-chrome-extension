# Contributing to PDF Compressor

First off, thank you for considering contributing to PDF Compressor! It's people like you that make the open-source community such a fantastic place to learn, inspire, and create.

## 🧭 Core Architectural Invariants

Before proposing changes, please ensure they respect the fundamental design of this extension:

1.  **100% Local Processing:** PDFs must *never* be uploaded to a backend or processed via cloud services.
2.  **Privacy-First:** Do not add hidden telemetry, tracking, or mandatory data collection.
3.  **No Remote Code:** Manifest V3 strictly prohibits remote code execution. All code must be bundled within the extension.
4.  **Zero Permissions:** Do not request unnecessary host permissions. We currently operate with 0 permissions.
5.  **Security & Consent:** Any external network requests (like opt-in Analytics) must be strictly isolated from the core PDF workflow and governed by explicit, clear user consent.

## 💻 Development Workflow

1.  **Fork & Clone:** Fork the repository and clone it locally.
2.  **Install Dependencies:** Run `npm install` to grab the required packages.
3.  **Local UI Testing:** Run `npm run dev` for rapid local UI development using Vite.
4.  **Build Extension:** Run `npm run build` to compile the WASM and React code into the `dist/` folder. You can load this directory directly into Chrome as an *unpacked extension* (via `chrome://extensions`).
5.  **Run Tests:** Before submitting a Pull Request, ensure all regression and accessibility tests pass flawlessly:
    ```bash
    node test-extension.mjs
    node test-modes.mjs
    node test-mode-ui.mjs
    node test-accessibility.mjs
    node test-hardening.mjs
    ```
6.  **Submit a Pull Request:** Describe your changes clearly, referencing any related issues. Provide screenshots if you altered the UI.

## 🐛 Bug Reports

If you discover a bug, please use the GitHub Issues tab. When opening an issue, please include:
*   Your Chrome version and Operating System.
*   The exact steps to reproduce the issue.
*   If possible, an **anonymised version** of the PDF that triggered the bug (ensure it contains absolutely no sensitive data).

We build in public! All feedback, issues, and discussions are welcome in the issues tab.
