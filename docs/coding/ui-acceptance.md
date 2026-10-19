# UI acceptance and remaining checks

## Evidence boundaries

Browser previews and component stories use fictional catalogues. They establish layout and interaction behavior, not native IPC, physical sound, device compatibility or provider availability. Native macOS observations are distinct from software tests. Earlier individual-pass observations live in Git rather than a growing chronological log.

## Retained host observations

- Native account tests exercised source-specific connection/logout, isolated private annotations, pinned local HTTPS and public profile import. A browser preview does not imply a logged-in account.
- Artist portrait/cards/editorial rows, monochrome logos, full-height hit targets, sharp available banners and fallback backgrounds were checked on the development host. Editorial rows prefer backgrounds; cards remain portrait-first. Play retains its triangle rather than a loader.
- Cover Flow browser checks cover keyboard/drag/range navigation, resident positions, transitions and bounded rendered nodes. Fast-scroll artwork readiness remains a separate constraint; do not replace retention with an unverified eviction policy.
- Shared headers, pagination, empty states, contextual account notices and disconnected header removal were checked with real components. Disconnected History and personal workspaces reserve no empty header footprint. Tags/queue can admit either source; the Playback drawer remains independent.
- Native album checks exposed actual FLAC diagnostics. Integrity slots align OK/KO/neutral dash without shifting titles; KO disclosure remains inline. Stored analyses and transient decode verdicts remain distinct.
- Native radio directory results loaded without Aède, and isolated macOS playback reached its playing state at zero application volume. This is admission evidence, not acoustic or universal station compatibility. Provider outages were observed separately.
- Saved encyclopedia readers retain a TOC, contained return-to-top action and bottom page padding for long text; a tall fictional-article browser check demonstrated the layout requirement.
- Transfer destination/selection panes and converted filename previews were checked independently of physical-device acceptance. A detected iPod is not proof of a successful firmware-specific transfer.

## Manual regression checklist

1. Check a fresh/offline launch, source login/logout and account replacement while a private read, download or job is pending. Verify old data/feedback never reappears.
2. Exercise narrow/wide windows, long titles, empty/populated pages, fixed headers, bottom padding and shared arrow pagination. Verify fields/buttons, refresh loaders/cancellation, tooltips, focus and keyboard shortcuts.
3. Test queue append/repeated occurrences, clear/removal/reorder, drag ghost/placement, stopped replay, drawer retention and exact row lyric actions. Navigation must not cancel application-owned lyric batches.
4. Test album/track navigation, intrinsic-size cover enlargement, shared sizing/default reset, filters/collections and deliberate saved preferences.
5. Test actual output changes, DSP selection/preloads, seek/pause/Stop, volume restore, repeat/shuffle and screen inhibition through pause/stop. Use the [audio contract](../design/audio-continuity.md); a visual playing state is not listening acceptance.
6. Test radio failover/live codecs, podcast pause/resume/download/listened evidence, permitted CD/CUE images and real portable-player transfer/ejection with disposable data.
7. Validate real provider keys/quotas, licences and safe biography links without publishing credentials; validate saved articles and backup/import under different accounts.

## Still requiring their own environments

Native Windows/Linux and minimum-toolchain execution, optical drive permissions, physical gapless/DAC output, HQPlayer and LAN renderer interoperability, network-mount changes, iPod/MTP firmware variants and sustained artwork working-set behavior need explicit acceptance. Signing/notarization and installing every generated platform package remain release tasks. No complete component coverage, platform certification or absence-of-bugs claim follows from the earlier UI checks.

## Procedures

Use [frontend documentation](frontend-documentation.md) for strict types, tests, Storybook and full-gate commands; [current state](current-state.md) records the latest qualified checkpoints. Keep new observations only when they change a durable limit, acceptance result or reproduction procedure.
