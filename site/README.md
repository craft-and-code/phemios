# Phémios website and user manual

The separate static French/English website introduces the desktop experience and links a task-oriented user manual, Storybook, Rustdoc and frontend declarations. It uses the approved local SVG wordmark, system fonts and actual UI screenshots with fictional content. It contains no analytics, cookies, external asset requests or contact forms. Storybook is an isolated browser sandbox; its fixtures do not open accounts, invoke native capabilities or play real audio.

## Generate and preview

```sh
npm run site:build
npm run site:check
python3 -m http.server 1439 --bind 127.0.0.1 --directory dist-site
```

Open `http://127.0.0.1:1439/`. English is under `en/`; the manual starts at `docs/fr/` or `docs/en/`. Storybook, Rustdoc and TypeScript documentation are copied into `components/`, `rust/` and `typescript/`. Relative navigation also supports a project subdirectory. Serve `dist-site`, not the source `site` folder: the latter intentionally contains no generated manual or technical output.

`site:build` generates the existing TypeScript declarations, Storybook and warning-denied workspace Rustdoc, then assembles and checks the site. It does not compile or bundle the native application executable. It uses locked/offline Cargo resolution and requires the already installed repository development dependencies. For content-only iteration after these outputs exist, use `node scripts/build-site.mjs --reuse-technical`; the checker still refuses missing technical entry points. Never use that shortcut to claim fresh technical documentation.

## GitHub Pages deployment

The production URL is <https://craft-and-code.github.io/phemios/>. It becomes available after the first successful deployment; adding the workflow alone does not publish the local preview.

The separate [GitHub Pages workflow](../.github/workflows/pages.yml) runs on pushes to `main` and can be dispatched manually on `main`. Other branches and release tags do not deploy the website. Its build job has read-only repository/Pages permissions; only the dependent deployment job receives `pages: write` and `id-token: write`, through the `github-pages` environment. Deployments are serialized without interrupting an active publication.

The Ubuntu 22.04 builder installs the native prerequisites, uses Node.js 24 and stable Rust, installs locked npm dependencies, and prepares the latest published stable Aède engine through the existing build policy. This preparation supplies the genuine sidecar and version metadata required by workspace Rustdoc; it does not launch the App or an engine server, compile an App installer, publish an application release or change repository pins on GitHub. The selected release/SHA is retained in the run log. The workflow runs the website/manual tests and `npm run build` to supply the frontend assets required by the native Rustdoc context on a clean checkout. It then generates fresh Storybook, Rustdoc and frontend documentation with `npm run site:build`, and checks the assembled output before uploading only `dist-site/`. The application frontend built for Rustdoc is not the uploaded website.

One-time repository setup: in **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. An administrator can instead create the Pages configuration with `gh api --method POST repos/craft-and-code/phemios/pages -f build_type=workflow`; for an existing site, inspect its configuration before changing it. This setting prepares Pages without dispatching the workflow or uploading site content.

After reviewing the site and committing/pushing this workflow to `main`, the push starts publication. To redeploy the committed `main` explicitly, use **Actions → GitHub Pages → Run workflow**, or:

```sh
gh workflow run pages.yml --repo craft-and-code/phemios --ref main
```

Check the `build` and `deploy` jobs and their deployment URL. A failed build/check must not be treated as a publication. Workflow syntax and local Mac generation checks are separate from an actual Ubuntu/GitHub-hosted execution. No personal access token or custom domain is needed for this project URL; do not deploy the repository root or the raw `site/` directory.

## Edit the content

- `site/index.html` and `site/en/index.html`: matching homepage editions; update them together.
- `site/styles.css`: shared visual language and responsive homepage.
- `docs/manual/manifest.json`: paired chapter titles, summaries and order.
- `docs/manual/fr/` and `docs/manual/en/`: canonical user-facing Markdown. This deliberately supports a small authored Markdown subset: headings, paragraphs, ordered/unordered lists, HTTPS/relative links, emphasis and fenced code; HTML stays literal. Chapter `.md` links become `.html`.
- `site/manual.css` and `site/manual.js`: manual layout and local title/summary chapter filtering. Search is chapter navigation, not full-text article search.
- `scripts/site-content.mjs`: shared manual templates and renderer; `scripts/check-site.mjs`: authored-page links, fragments, metadata and technical-output checks.
- [Screenshot provenance](assets/screens/README.md): approved capture sources and fictional data boundaries.

User operations stay in this manual. Backend commands, server administration and domain contracts link to Aède; detailed audio-analysis interpretation links to FlacCompagnon. Repository/developer documentation stays separate.

`npm test` exercises both generated manual editions and renderer safety; `npm run site:check` additionally verifies the assembled real technical outputs. The complete `tools/check.sh` gate assembles the website after generating its technical documentation. Before release, check homepage/manual at desktop and narrow widths, chapter search, language continuity, keyboard focus and a bundled Storybook story. The site's generated output belongs in `dist-site/` and is ignored by Git.

The homepage links to the verified [GitHub releases page](https://github.com/craft-and-code/phemios/releases) for published installers. Release publication remains a separate user-authorized step; the desktop build never deploys the website.
