# Application icon

Editable SVG: a compact lowercase p, the shared off-white foreground and accent dot (#d8f36a), on a transparent-corner dark rounded tile. It remains distinct from the full header wordmark. No external bitmap, icon library or runtime request is required.

Generate platform resources directly from the SVG with the existing local Tauri CLI: `npm exec -- tauri icon assets/brand/phemios-icon.svg --output /tmp/phemios-icons`. Copy only the desktop root PNG/ICNS/ICO files into `src-tauri/icons/`; mobile output is not part of the desktop app. Inspect 16/32/128 px and the macOS Dock. The source has a 48 px transparent outer margin; rounding is baked into every platform resource instead of assumed from an OS mask.
