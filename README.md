# Phémios

Phémios is the local-first desktop client for Aède, built with SolidJS, TypeScript and Tauri 2. The initial application is an offline foundation; it does not connect to a server or play music yet.

## Development

Use Node.js 22.12 or later and Rust 1.89 or later, plus the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run dev
npm run tauri dev
npm run check
npm run tauri build -- --bundles app
```

The browser preview reports that native capabilities are absent. The desktop bridge is typed and versioned. The webview has no shell, network or arbitrary filesystem permissions.

## Structure

- `src/`: SolidJS interface and centralized typed desktop calls.
- `core/`: framework-independent Rust client policies; no Aède domain duplication.
- `src-tauri/`: minimal desktop entry point, commands and capabilities.
- `scripts/`: lockfile bridge compatibility checks.

## Licensing

Project sources use MPL-2.0, matching Aède. The starter derives from the tauri-project-start template; its upstream FlacCompagnon MIT notice is retained under `licenses/`.
