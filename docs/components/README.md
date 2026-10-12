# Phémios component explorer

This development-only Storybook mounts the actual SolidJS presentation components and application CSS. It is separate from the Tauri entry point and native application bundle. Scenarios use fictional values and in-memory callbacks; they do not load accounts, request services, play audio, invoke Tauri or write downloaded files.

## Run and build

From the repository root, run `npm run components:dev`, then open `http://127.0.0.1:6006`. The listener is loopback-only, opens no browser automatically and refuses an occupied port. Storybook telemetry and version checks are disabled. Stop it with Ctrl+C.

`npm run components:check` applies the application's strict TypeScript rules and builds the separate static explorer into `dist-docs/components/`. That check is part of `tools/check.sh`. `npm run components:build` only creates the static output. Nothing under this directory is imported by the production application. The ordinary unit suites remain authoritative for controller, account and native policy behavior.

## Explore real states

The Controls panel edits component props. Stateful scenarios retain their own in-memory values and expose a readout; changing Controls updates those values. The language toolbar applies FR/EN only within this browser preview and never saves a preference.

The explorer now imports 35 real components in 85 scenarios. Controls include cover sizing, histogram rails, filters, rich notes, radio search and role help; status primitives include loaders, empty results, counts, downloads and dismissible feedback. Data scenarios include adaptive statistic values, integrity evidence, analysis charts and paginated tables. Media scenarios include the real globe/country explorer, relation graph, particle scenes, 24 frequency bands, radio wave and fixed footer presentation.

The [complete component inventory](coverage.md) records all 75 component modules, including account/native wrappers that are not yet standalone scenarios. Coverage is explicit: showing a primitive inside a wrapper does not establish acceptance of the connected workflow. These remaining surfaces need typed presentation props before they can enter the explorer without a real account.

Nineteen `play` scenarios exercise feedback dismissal; pointer, keyboard and disabled cover-size reset; Enter-versus-comma/backspace tags; download success/cancellation/Stop hover; radio footer geometry; Enter submission; histogram keyboard movement; asynchronous table pagination, bundled globe boundary loading, individual lyric Stop and recovery from a transient radio sampler failure restoration of the account cover-size default, in-button subscription activity and explicit personal-rating column mapping. They run when their stories open in Storybook; static compilation alone does not execute browser interactions.

The import-boundary plugin refuses the native platform layer, Tauri imports, LibraryProvider and application startup. The dedicated Vite configuration excludes environment files and public-directory discovery, apart from the existing fictional landscape referenced by the shared CSS and the explicitly mapped local country boundaries and exposes no prefixed environment values. The preview's content policy blocks external connections and media. A scenario requiring native data should first extract a typed presentation surface with explicit props, then use fictional fixtures here. Do not mount the full library provider or replace a real component with a copied imitation.

## Add a story

1. Add `stories/Component.stories.tsx`, importing its actual implementation from `src/components/`.
2. Describe its contracts and meaningful states with `Meta`/`StoryObj` from `storybook-solidjs-vite`. Keep fixtures under `fixtures/` and use local signals for controlled behavior.
3. Add a `play` function with `storybook/test` only for behavior that can be exercised without account, filesystem, audio or network operations. Keep failure, cancellation and stale-owner scenarios explicit where relevant.
4. Run `npm run components:check`, the affected behavioral tests, and inspect the story in a browser. Do not claim browser interaction acceptance from a static build.

The explorer uses pinned development dependencies. Solid support is community maintained; its adapter currently declares Vite 8 and Solid 1.9 compatibility. See [Solid Storybook integration](https://github.com/solidjs-community/storybook), [Vite builder](https://storybook.js.org/docs/builders/vite) and [interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing).
