#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run format:check
npm run lint
npm test
npm run build
npm run check:tauri
cargo fmt --all -- --check
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps --locked
cargo build --workspace --locked
