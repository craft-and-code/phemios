# Browser client and shared WebAssembly audio

## Scope

Phémios includes an explicit browser product alongside the desktop application. `npm run web:dev` and `npm run web:build` enable it. Ordinary `npm run dev` remains the non-authenticating fictional component/application preview; Tauri retains the native bridge. The browser product reuses the existing catalogue, queue, transport controller and views. No separate catalogue/query engine is introduced.

The initial profile offers Albums/Cover Flow, artist and track browsing, catalogue filters, the transient queue, transport, volume, favourites/ratings/tags and interface preferences. Native-only sources, devices and administration are unavailable or hidden. This is an initial Web profile, not complete desktop feature parity.

## Shared audio boundary

The browser's progressive media decoder feeds an AudioWorklet with stereo floating-point blocks. `crates/phemios-web-audio` adapts the same published `aede-audio` DSP used by the native projects through the approved `wasm-bindgen` dependency. It provides app gain/ramping and guarded output; browser format/rate adaptation is outside the DSP. There is no JavaScript replacement DSP and no bit-perfect claim. Normalization and crossfade are unavailable in this profile.

The Rust adapter allocates one fixed 8,192-sample buffer per worklet instance outside rendering. Interleaving and processing reuse it. Only primitive functions cross the WASM boundary, avoiding generated class exception imports that require `TextDecoder`, which AudioWorklet globals need not expose. No catalogue, token, filesystem or native audio device lives in WASM. One AudioContext/worklet chain is reused across visits. Stop removes the media source, revokes owned Blob URLs and suspends the context. Pause/Stop/source replacement retire pending visit preparations; commands return while connecting so cancellation stays available.

Build preparation uses the existing official latest-published-stable Aède selection, fetches locked inputs and builds only the adapter. `web-audio/wasm/provenance.json` records the selected shared-audio SHA and binding version. Generated bindings/WASM and build output are ignored. There is no embedded engine/App compilation in either Web command.

## Demonstration and attribution

The static demonstration includes ten unchanged recordings under CC BY 4.0: seven Scott Buckley singles and one track from each of Chris Zabriskie’s **Cylinders**, **Undercover Vampire Policeman** and **Divider**. Ten distinct releases/covers exercise Cover Flow without inventing extra albums or authors. Chris Zabriskie’s albums contain only the selected track, not the complete original release. The original three covers are preserved; seven additional covers use the same original geometric artwork style. Their official pages, download sources, license and SHA-256 values are in `web-public/web-demo/credits.json` and `ATTRIBUTION.txt`. Custom demonstration covers are Phémios artwork, not claimed original album covers. Catalogue titles, durations, file properties and bounded waveform envelopes correspond to those real recordings. No fictional lyrics or artist collaborations are attributed to the musician.

Attribution is accessible from the sidebar on every page. About 93 MiB of music is hosted separately under `web-public`; desktop `public/` and native packaging do not include this music or the WASM runtime. Opening the catalogue does not download the whole demo audio library: the selected track uses the browser's media/range requests. Demo annotations are process-only. Presentation settings use the existing isolated synthetic-demo profile. Reset retires playback and removes only that demo profile, then reloads. It does not delete server music, real-account profiles or all browser storage.

## Desktop and Web delivery

Both products use the same Solid views and published shared-audio source. UI changes therefore reach both builds when their platform capabilities permit them; a new native IPC operation still needs an explicit browser adapter or unavailable control. Their build artifacts remain separate: `npm run tauri build` builds the native frontend/engine/App, whereas `npm run web:build` builds the WASM adapter and browser frontend. A native App build does **not** currently trigger a Web build. A release workflow can run both paths from one revision without bundling demo audio or WASM in the desktop installer. Branch merging does not itself couple these commands or guarantee conflict-free future changes.

## Personal Aède connection

The Web interface and Aède API must share one origin. There is no cross-origin address field or generic browser proxy. Login uses the existing named-account API. Bearer tokens remain in process memory, travel only in Authorization headers and are never put into media URLs, browser storage or logs. Reload needs a fresh login. Logout clears local identity and aborts outstanding requests before attempting bounded remote token revocation. A failed network revocation cannot retain the local session. Late login tokens are never adopted and receive a best-effort separate revocation.

Catalogue synchronization uses existing presentation pages with one consistent scan stamp and total, bounded to 100,000 rows per entity and 16 MiB aggregate JSON. Personal media currently uses Aède's original-export plan and authenticated download, retaining at most one original file of up to **64 MiB** for the current visit. It is decoded through a revocable in-memory Blob URL. Replacing/stopping the visit revokes it, and aborted or retired plan/download results cannot start playback. This first route needs a browser-supported codec; it is not progressive authenticated PCM, shared listening-history accounting or a browser bit-perfect output. Album listening marks are disabled. Supervised accounts are refused at login; desktop remains the supported parental playback route. Existing live account/parental reads still retire unavailable/revoked playback.

For production, serve `dist-web/` and a narrowly routed `/api/` reverse proxy at one HTTPS origin. The public demo cannot reach a visitor's private loopback Aède automatically. Resetting the demo is separate from installing/configuring that personal host. No browser operation scans an arbitrary local music folder or starts an Aède process.

`scripts/serve-web.mjs` supplies a small optional **loopback-only** host for evaluation: `npm run web:serve -- --aede http://127.0.0.1:8787`. The upstream is fixed at process startup, accepts HTTPS or explicit loopback HTTP, and rejects URL credentials/paths. It does not discover servers, save credentials, follow redirects, relax TLS validation or expose a public listener. Host/Origin checks reject foreign browser origins and rebinding authorities. The gateway forwards only required authentication/content/range headers, bounds request/response bytes and time, and cancels the upstream when a client leaves. Static range requests remain confined to the public output. For a privately trusted HTTPS Aède certificate, configure the Node trust store with `NODE_EXTRA_CA_CERTS=/path/to/public-ca.pem`; never disable certificate verification.

## Build and verification

Prerequisites: the existing Node/Cargo toolchains, the `wasm32-unknown-unknown` Rust standard library and `wasm-bindgen-cli 0.2.129` matching the locked Rust crate:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked
npm ci
npm run web:dev
```

The development demo opens at `http://127.0.0.1:1440/#/albums`. This initial Web profile disables hot replacement to retain a single page-owned audio/session lifecycle; reload the browser after source edits. To generate and serve distributable static files:

```sh
npm run web:build
npm run web:test
npm run web:serve
```

The static host defaults to `http://127.0.0.1:1441`. Use `--port` to choose another loopback port. In Settings → Libraries choose **Use my library** when the host has a configured Aède upstream; **Return to the demo** switches back. A trusted HTTPS deployment is needed outside loopback because AudioWorklet requires a secure context. No service-worker offline installation is provisioned. The website’s GitHub Pages workflow assembles the public demo at `demo/` after a push to `main`; deployment is confirmed only by its successful hosted run.

`PHEMIOS_WASM_BINDGEN` selects an explicitly installed matching binding executable. Advanced non-rustup toolchains can opt into `PHEMIOS_WASM_BUILD_STD=1` with the required Rust standard sources, Cargo build-std support and WASM linker; these are toolchain prerequisites, not bundled product dependencies. Web commands fail explicitly if preparation cannot verify the stable source or binding tool. They do not silently use an older/generated DSP.

Run `npm test`, strict App/component TypeScript, lint/format and `cargo test -p phemios-web-audio --locked --offline` for software contracts. After generating WASM, `npm run web:test` executes the actual binary for unity/gain/mute/invalid-block admission; it is separate so an ordinary desktop test run does not require generated Web artifacts. Browser checks must cover demo Play/Pause/Stop, queue/seek/volume, and a disposable real Aède login/catalogue/playback/logout. Record browser transport evidence separately from acoustic, mobile and installed native acceptance. Do not infer full browser codec/platform support from a single development browser.

## Public website demo

`npm run web:build:demo` builds a dedicated public profile with relative asset URLs, suitable for `/phemios/demo/` as well as a local `demo/` subdirectory. It forces demonstration mode even if browser storage contains a personal-mode choice. Settings links to installation/self-hosting instructions and never presents an Aède credential form; the bridge also refuses personal login/mode commands. A GitHub Pages deployment has no private Aède API and cannot reach the visitor’s home server. Personal same-origin access stays available in the separate `web:build`/`web:serve` profile.

`site:build` builds this demo and copies it into `dist-site/demo/` along with the existing homepage, bilingual manual and technical documentation. `--reuse-web` is an explicit local shortcut: the builder and site checker still require public-profile metadata, coherent WASM provenance, relative assets and all ten unchanged credited recordings/covers. The public demo does not place its audio into native installers. The Pages workflow selects one published Aède revision for both native documentation and WASM, installs the WASM target/matching bindings, checks the real generated DSP and uploads the assembled site. No new Aède release tag is needed.

For review without rebuilding native executables, `tools/check.sh --web --no-native-build` runs the Web build, behavioral/type/lint checks, Rust tests/Clippy/Rustdoc, component documentation and assembled-site validation against the existing embedded engine. It omits engine preparation and the final native executable build; it does not claim refreshed engine/App or installer acceptance. The default gate retains its native build steps.
