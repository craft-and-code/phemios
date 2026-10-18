#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run format:check
npm run lint
npm test
npm run build
npm run docs:ts
npm run components:check
npm run check:tauri
node scripts/prepare-engine.mjs
cargo fmt --all -- --check
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
    export PHEMIOS_REQUIRE_FFMPEG=1
fi
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps --locked
cargo build --workspace --locked
