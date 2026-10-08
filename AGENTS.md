# Phémios — Codex instructions

Follow `CLAUDE.md`. At the start of a task read `docs/coding/current-state.md` and the relevant design documentation. Inspect existing abstractions before changing code.

Keep Rust unit tests in sibling `*_tests.rs` files declared with `#[cfg(test)]` and `#[path = "..."]`. Keep TypeScript tests and fixtures in separate test-only files. Preserve test behavior when moving suites; check orphaned tests.

Run `tools/check.sh` before every commit. Never claim native, cross-platform, audio or server acceptance without executing the corresponding checks. Markdown has no maximum line length.
