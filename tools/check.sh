#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run format:check
npm run lint
npm test
npm run build
npm run analysis:build
npm run docs:ts
npm run components:check
npm run check:tauri
node scripts/prepare-engine.mjs
transfer_engine_triple="$(rustc -vV | sed -n 's/^host: //p')"
transfer_engine_suffix=""
if [[ "$transfer_engine_triple" == *-windows-* ]]; then transfer_engine_suffix=".exe"; fi
export PHEMIOS_TRANSFER_ENGINE="$PWD/src-tauri/binaries/phemios-aede-$transfer_engine_triple$transfer_engine_suffix"
cargo fmt --all -- --check
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
    export PHEMIOS_REQUIRE_FFMPEG=1
fi
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps --locked
node scripts/build-site.mjs --reuse-technical
cargo build --workspace --locked
