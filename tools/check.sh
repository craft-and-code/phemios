#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
no_native_build=0
web=0
for option in "$@"; do
    case "$option" in
        --no-native-build) no_native_build=1 ;;
        --web) web=1 ;;
        *) echo "Usage: tools/check.sh [--no-native-build] [--web]" >&2; exit 2 ;;
    esac
done
if [[ "$web" == 1 ]]; then
    npm run web:build:demo
    npm run web:test
    if [[ -z "${AEDE_AUDIO_RELEASE:-}" ]]; then
        export AEDE_AUDIO_RELEASE="$(node -e 'process.stdout.write(require("node:fs").readFileSync(".audio-source/selection.json","utf8").trim())')"
    fi
fi
npm run format:check
npm run lint
npm run check:vendor
if [[ "$(uname -s)" == Linux ]]; then
    node scripts/keepawake-regression.mjs --fetch
fi
npm test
npm run build
npm run analysis:build
npm run docs:ts
npm run components:check
npm run check:tauri
if [[ "$no_native_build" == 0 ]]; then
    node scripts/prepare-engine.mjs
else
    echo "Checking against the existing embedded engine; no engine/App executable build."
fi
if [[ -z "${AEDE_AUDIO_RELEASE:-}" ]]; then
    export AEDE_AUDIO_RELEASE="$(node -e 'process.stdout.write(require("node:fs").readFileSync(".audio-source/selection.json","utf8").trim())')"
fi
if [[ "$no_native_build" == 1 ]]; then
    node --input-type=module - <<'JS'
import { readFileSync } from "node:fs";
const selected = JSON.parse(process.env.AEDE_AUDIO_RELEASE);
const embedded = JSON.parse(readFileSync("src-tauri/binaries/versions.json", "utf8"));
if (embedded.audio_revision !== selected.revision) {
  throw new Error("The existing engine and selected shared audio differ; no native-build validation cannot claim coherence.");
}
JS
fi
transfer_engine_triple="$(rustc -vV | sed -n 's/^host: //p')"
transfer_engine_suffix=""
if [[ "$transfer_engine_triple" == *-windows-* ]]; then transfer_engine_suffix=".exe"; fi
export PHEMIOS_TRANSFER_ENGINE="$PWD/src-tauri/binaries/phemios-aede-$transfer_engine_triple$transfer_engine_suffix"
cargo fmt --all -- --check
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
    export PHEMIOS_REQUIRE_FFMPEG=1
fi
cargo test --workspace --locked
if [[ "$(uname -s)" == Linux ]]; then
    cargo test -p phemios-glib-regression --release --locked
    node scripts/macro-regression.mjs --fetch
fi
cargo clippy --workspace --all-targets --locked -- -D warnings
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps --locked
if [[ "$web" == 1 ]]; then
    node scripts/build-site.mjs --reuse-technical --reuse-web
else
    node scripts/build-site.mjs --reuse-technical
fi
if [[ "$no_native_build" == 0 ]]; then
    cargo build --workspace --locked
fi
