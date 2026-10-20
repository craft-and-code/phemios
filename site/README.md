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
