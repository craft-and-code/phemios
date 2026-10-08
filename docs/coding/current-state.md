# Phémios — Current state

The desktop foundation is initialized with SolidJS, TypeScript, Vite and Tauri 2, in a dedicated repository. Rust client policies and Tauri wiring are separate; IPC is centralized and versioned. Browser preview is explicitly distinct from native execution. No Aède server, audio backend or copy destination is connected yet.

Current task: configure the project and implement the first offline library shell with draggable year/alphabet ranges. Follow `docs/design/roadmap.md` and `docs/design/interface.md`.

The authoritative gate is `tools/check.sh`; native bundling uses `npm run build:native`. Cross-platform execution, minimum Rust-version acceptance and physical output remain unverified until separately run. Lockfiles record the actual dependencies.
